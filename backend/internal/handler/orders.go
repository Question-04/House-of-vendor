package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vendor-api/internal/db"
	"vendor-api/internal/storage"
)

// OrdersHandler handles vendor orders APIs.
type OrdersHandler struct {
	db                  *db.DB
	uploader            storage.Uploader
	hopAdminVendorPhone string
}

// NewOrdersHandler creates an orders handler. uploader may be nil (doc upload disabled).
func NewOrdersHandler(database *db.DB, uploader storage.Uploader, hopAdminVendorPhone string) *OrdersHandler {
	return &OrdersHandler{
		db:                  database,
		uploader:            uploader,
		hopAdminVendorPhone: strings.TrimSpace(hopAdminVendorPhone),
	}
}

// ListOrders handles GET /api/orders?phone=.
func (h *OrdersHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	phone := strings.TrimSpace(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	rows, err := h.db.ListVendorOrders(r.Context(), phone)
	if err != nil {
		log.Printf("[orders] list error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load orders"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "orders": rows})
}

// OrderDecisionRequest for POST /api/orders/decision.
type OrderDecisionRequest struct {
	VendorPhone string `json:"vendorPhone"`
	OrderID     int    `json:"orderId"`
	Decision    string `json:"decision"` // "accept" | "reject"
}

// OrderDecision handles POST /api/orders/decision.
func (h *OrdersHandler) OrderDecision(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req OrderDecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.VendorPhone = strings.TrimSpace(req.VendorPhone)
	if req.VendorPhone == "" || req.OrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "vendorPhone and orderId required"})
		return
	}
	decision := strings.TrimSpace(strings.ToLower(req.Decision))
	var newStatus string
	switch decision {
	case "accept":
		newStatus = "waiting_pickup"
	case "reject":
		newStatus = "rejected"
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "decision must be accept or reject"})
		return
	}
	beforeDecision, err := h.db.GetVendorOrderByID(r.Context(), req.OrderID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Order not found"})
			return
		}
		log.Printf("[orders] decision load order: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load order"})
		return
	}
	if beforeDecision == nil || beforeDecision.VendorPhone != req.VendorPhone {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Order not found"})
		return
	}
	updated, err := h.db.UpdateVendorOrderIfPending(r.Context(), req.OrderID, req.VendorPhone, newStatus)
	if err != nil {
		log.Printf("[orders] decision error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update order"})
		return
	}
	if updated == nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"success": false,
			"code":    "ORDER_NOT_PENDING",
			"message": "Order is no longer pending (e.g. buyer cancelled on main site or already accepted/rejected).",
		})
		return
	}
	if newStatus == "rejected" {
		if err := h.db.RestoreInventoryForRejectedOrCancelledOrder(r.Context(), updated); err != nil {
			log.Printf("[orders] restore inventory after vendor reject: %v", err)
		}
	}
	if newStatus == "waiting_pickup" {
		if row, err := h.db.GetVendorOrderByID(r.Context(), req.OrderID); err == nil && row != nil {
			notifyOrderAccepted(r.Context(), h.db, row)
		}
	}
	// No in-app notification when vendor rejects an order (by design).
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// OrderTrackingRequest for POST /api/orders/tracking.
type OrderTrackingRequest struct {
	VendorPhone     string `json:"vendorPhone"`
	OrderID         int    `json:"orderId"`
	ShippingPartner string `json:"shippingPartner"`
	TrackingID      string `json:"trackingId"`
	PickupDate      string `json:"pickupDate"` // YYYY-MM-DD or empty
}

// OrderTracking handles POST /api/orders/tracking.
func (h *OrdersHandler) OrderTracking(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req OrderTrackingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.VendorPhone = strings.TrimSpace(req.VendorPhone)
	if req.VendorPhone == "" || req.OrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "vendorPhone and orderId required"})
		return
	}
	var pickupDate *time.Time
	if req.PickupDate != "" {
		if t, err := time.Parse("2006-01-02", req.PickupDate); err == nil {
			pickupDate = &t
		}
	}
	before, err := h.db.GetVendorOrderByID(r.Context(), req.OrderID)
	if err != nil || before == nil || before.VendorPhone != req.VendorPhone {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Order not found"})
		return
	}
	wasInTransit := before.Status == "in_transit"
	if err := h.db.UpdateVendorOrderTracking(r.Context(), req.OrderID, req.VendorPhone, req.ShippingPartner, req.TrackingID, pickupDate); err != nil {
		log.Printf("[orders] tracking error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update tracking"})
		return
	}
	if row, err := h.db.GetVendorOrderByID(r.Context(), req.OrderID); err == nil && row != nil {
		if !wasInTransit {
			notifyOrderShipped(r.Context(), h.db, row)
		} else {
			notifyOrderTrackingUpdated(r.Context(), h.db, row)
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// MarkDeliveredRequest for POST /api/orders/mark-delivered.
type MarkDeliveredRequest struct {
	VendorPhone string `json:"vendorPhone"`
	OrderID     int    `json:"orderId"`
}

// MarkDelivered handles POST /api/orders/mark-delivered.
func (h *OrdersHandler) MarkDelivered(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req MarkDeliveredRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.VendorPhone = strings.TrimSpace(req.VendorPhone)
	if req.VendorPhone == "" || req.OrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "vendorPhone and orderId required"})
		return
	}
	before, err := h.db.GetVendorOrderByID(r.Context(), req.OrderID)
	if err != nil || before == nil || before.VendorPhone != req.VendorPhone {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Order not found"})
		return
	}
	alreadyVerification := before.Status == "verification"
	if err := h.db.UpdateVendorOrderStatus(r.Context(), req.OrderID, req.VendorPhone, "verification"); err != nil {
		log.Printf("[orders] mark-delivered error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update order"})
		return
	}
	if !alreadyVerification {
		if row, err := h.db.GetVendorOrderByID(r.Context(), req.OrderID); err == nil && row != nil {
			notifyOrderInVerification(r.Context(), h.db, row)
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

const orderDocMaxSize = 5 * 1024 * 1024 // 5 MB
var orderDocMimes = map[string]bool{"image/jpeg": true, "image/jpg": true, "image/png": true, "application/pdf": true}

// UploadOrderDocs handles POST /api/orders/upload-docs (multipart: phone, orderId, file(s)).
func (h *OrdersHandler) UploadOrderDocs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.uploader == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"success": false, "message": "Upload not configured"})
		return
	}
	if err := r.ParseMultipartForm(orderDocMaxSize * 4); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid form"})
		return
	}
	phone := strings.TrimSpace(r.FormValue("phone"))
	orderIDStr := strings.TrimSpace(r.FormValue("orderId"))
	if phone == "" || orderIDStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone and orderId required"})
		return
	}
	orderID, _ := strconv.Atoi(orderIDStr)
	if orderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "invalid orderId"})
		return
	}
	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		files = r.MultipartForm.File["file"]
	}
	if len(files) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "No file (use 'file' or 'files')"})
		return
	}
	for _, header := range files {
		if header.Size > orderDocMaxSize {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "File too large (max 5MB): " + header.Filename})
			return
		}
		file, err := header.Open()
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not read file"})
			return
		}
		content, err := io.ReadAll(io.LimitReader(file, orderDocMaxSize+1))
		_ = file.Close()
		if err != nil || int64(len(content)) > orderDocMaxSize {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "File too large"})
			return
		}
		mime := header.Header.Get("Content-Type")
		if mime == "" {
			mime = http.DetectContentType(content)
		}
		if !orderDocMimes[mime] {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Only JPG, PNG, PDF allowed"})
			return
		}
		ext := ".pdf"
		if strings.HasPrefix(mime, "image/") {
			ext = ".jpg"
			if strings.Contains(mime, "png") {
				ext = ".png"
			}
		}
		objectKey := "order-docs/" + strconv.Itoa(orderID) + "/" + time.Now().Format("20060102150405") + "_" + header.Filename + ext
		url, err := h.uploader.Upload(r.Context(), objectKey, content, mime)
		if err != nil {
			log.Printf("[orders] upload doc error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not upload file"})
			return
		}
		if err := h.db.AppendReverificationDocURL(r.Context(), orderID, phone, url); err != nil {
			log.Printf("[orders] append doc url error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not save document reference"})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// SetVerificationRequest for POST /api/orders/set-verification (dev/dashboard: set verification and move to completed when verified).
type SetVerificationRequest struct {
	VendorPhone        string `json:"vendorPhone"`
	OrderID            int    `json:"orderId"`
	VerificationStatus string `json:"verificationStatus"` // "real_and_authentic" | "needs_docs" | "rejected"
}

// SetVerification handles POST /api/orders/set-verification.
// When verificationStatus is real_and_authentic, also sets order status to completed so it moves to the next step.
func (h *OrdersHandler) SetVerification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req SetVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.VendorPhone = strings.TrimSpace(req.VendorPhone)
	status := strings.TrimSpace(strings.ToLower(req.VerificationStatus))
	if req.VendorPhone == "" || req.OrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "vendorPhone and orderId required"})
		return
	}
	switch status {
	case "real_and_authentic", "needs_docs", "rejected":
		// ok
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "verificationStatus must be real_and_authentic, needs_docs, or rejected"})
		return
	}
	before, err := h.db.GetVendorOrderByID(r.Context(), req.OrderID)
	if err != nil || before == nil || before.VendorPhone != req.VendorPhone {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Order not found"})
		return
	}
	prevVer := verificationStatusNorm(before.VerificationStatus)
	if err := h.db.UpdateVendorOrderVerificationStatus(r.Context(), req.OrderID, status); err != nil {
		log.Printf("[orders] set-verification error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update verification"})
		return
	}
	if prevVer != status {
		row := before
		switch status {
		case "needs_docs":
			notifyOrderVerificationNeedsDocs(r.Context(), h.db, row.VendorPhone, row.ID, row.ProductName, row.ProductID)
		case "real_and_authentic":
			notifyOrderVerificationApproved(r.Context(), h.db, row.VendorPhone, row.ID, row.ProductName, row.ProductID)
		case "rejected":
			notifyOrderVerificationRejectedByTeam(r.Context(), h.db, row.VendorPhone, row.ID, row.ProductName, row.ProductID)
		}
	}
	if status == "real_and_authentic" {
		profitLoss := profitLossForOrderPaymentPending(r.Context(), h.db, req.OrderID)
		if err := h.db.SetVendorOrderPaymentPending(r.Context(), req.OrderID, nil, nil, nil, profitLoss); err != nil {
			log.Printf("[orders] set-verification move to payment_pending error: %v", err)
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// MarkPaymentDoneRequest for POST /api/orders/mark-payment-done (dev/dashboard).
type MarkPaymentDoneRequest struct {
	VendorPhone string `json:"vendorPhone"`
	OrderID     int    `json:"orderId"`
}

// MarkPaymentDone marks a payment_pending order as completed (payment done).
func (h *OrdersHandler) MarkPaymentDone(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req MarkPaymentDoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.VendorPhone = strings.TrimSpace(req.VendorPhone)
	if req.VendorPhone == "" || req.OrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "vendorPhone and orderId required"})
		return
	}
	before, _ := h.db.GetVendorOrderByID(r.Context(), req.OrderID)
	if err := h.db.UpdateVendorOrderStatus(r.Context(), req.OrderID, req.VendorPhone, "completed"); err != nil {
		log.Printf("[orders] mark-payment-done error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update order"})
		return
	}
	if before != nil && before.Status != "completed" {
		if row, err := h.db.GetVendorOrderByID(r.Context(), req.OrderID); err == nil && row != nil {
			notifyOrderPaymentCompleted(r.Context(), h.db, row)
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// CreateOrderFromMainRequest for POST /api/orders/create-from-main (called by main site when customer places order).
type CreateOrderFromMainRequest struct {
	VendorPhone     string `json:"vendorPhone"`
	InventoryID     *int   `json:"inventoryId"`
	ProductID       string `json:"productId"`
	Category        string `json:"category"`
	Size            string `json:"size"`
	ProductName     string `json:"productName"`
	ProductImageURL string `json:"productImageUrl"`
	ExternalOrderID string `json:"externalOrderId"`
	ShippingAddress string `json:"shippingAddress"`
	PayoutCents     int64  `json:"payoutCents"`
	Quantity        int    `json:"quantity"` // units to sell (default 1); decrements vendor_inventory.quantity_remaining when inventoryId is set
}

// CreateOrderFromMain handles POST /api/orders/create-from-main.
func (h *OrdersHandler) CreateOrderFromMain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req CreateOrderFromMainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.VendorPhone = strings.TrimSpace(req.VendorPhone)
	req.ProductID = strings.TrimSpace(req.ProductID)
	req.Category = strings.TrimSpace(strings.ToLower(req.Category))
	req.ExternalOrderID = strings.TrimSpace(req.ExternalOrderID)
	if req.ProductID == "" || req.Category == "" || req.ExternalOrderID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "productId, category, externalOrderId required"})
		return
	}
	size := strings.TrimSpace(req.Size)
	if size == "" {
		size = "OneSize"
	}
	var productName, productImageURL, shippingAddr *string
	if req.ProductName != "" {
		productName = &req.ProductName
	}
	if req.ProductImageURL != "" {
		productImageURL = &req.ProductImageURL
	}
	if req.ShippingAddress != "" {
		shippingAddr = &req.ShippingAddress
	}
	var payoutPtr *int64
	if req.PayoutCents != 0 {
		payoutPtr = &req.PayoutCents
	}
	inventoryID := req.InventoryID
	if inventoryID != nil && *inventoryID == 0 {
		inventoryID = nil // avoid FK lookup for 0; store NULL
	}
	if inventoryID == nil || *inventoryID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "inventoryId is required for secure vendor routing"})
		return
	}
	qty := req.Quantity
	if qty < 1 {
		qty = 1
	}
	if qty > 1000 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "quantity must be between 1 and 1000"})
		return
	}
	row := db.VendorOrderRow{
		VendorPhone:     req.VendorPhone,
		InventoryID:     inventoryID,
		ProductID:       req.ProductID,
		Category:        req.Category,
		Size:            size,
		ProductName:     productName,
		ProductImageURL: productImageURL,
		ExternalOrderID: req.ExternalOrderID,
		OrderDate:       time.Now().UTC(),
		ShippingAddress: shippingAddr,
		Status:          "pending",
		PayoutCents:     payoutPtr,
		OrderQuantity:   qty,
	}
	ctx := r.Context()
	invRow, invErr := h.db.GetVendorInventoryByInventoryID(ctx, *inventoryID)
	if invErr != nil {
		log.Printf("[orders] create-from-main load inventory: %v", invErr)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not validate selected listing"})
		return
	}
	if invRow == nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Selected inventory listing not found"})
		return
	}
	if invRow.ProductID != req.ProductID || strings.TrimSpace(strings.ToLower(invRow.Category)) != req.Category {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Selected inventory does not match product/category"})
		return
	}
	// Never trust client vendorPhone; resolve vendor from inventory server-side.
	resolvedVendorPhone := strings.TrimSpace(invRow.VendorPhone)
	if req.Category == "handbags" && h.hopAdminVendorPhone != "" {
		// Handbags route to HoP admin vendor account.
		resolvedVendorPhone = h.hopAdminVendorPhone
	}
	if resolvedVendorPhone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not resolve vendor for selected listing"})
		return
	}
	row.VendorPhone = resolvedVendorPhone

	// Idempotency: retries with same vendor+externalOrderId return the existing order.
	if existing, err := h.db.GetVendorOrderByVendorAndExternal(ctx, resolvedVendorPhone, req.ExternalOrderID); err == nil && existing != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "orderId": existing.ID, "idempotent": true})
		return
	}

	tx, err := h.db.BeginTxx(ctx, nil)
	if err != nil {
		log.Printf("[orders] create-from-main begin tx: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not create order"})
		return
	}
	defer func() { _ = tx.Rollback() }()

	reserved, rerr := h.db.TryReserveInventoryUnits(ctx, tx, *inventoryID, resolvedVendorPhone, qty)
	if rerr != nil {
		log.Printf("[orders] create-from-main reserve stock: %v", rerr)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not reserve stock"})
		return
	}
	if reserved == nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"success": false,
			"code":    "OUT_OF_STOCK",
			"message": "This listing has no stock left or is no longer available. Refresh prices and try again.",
		})
		return
	}

	created, err := h.db.CreateVendorOrderTx(ctx, tx, row)
	if err != nil {
		if isDuplicateExternalOrderErr(err) {
			// Another concurrent request already inserted this externalOrderId.
			if existing, gerr := h.db.GetVendorOrderByVendorAndExternal(ctx, resolvedVendorPhone, req.ExternalOrderID); gerr == nil && existing != nil {
				writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "orderId": existing.ID, "idempotent": true})
				return
			}
		}
		log.Printf("[orders] create-from-main error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not create order"})
		return
	}
	if err := tx.Commit(); err != nil {
		log.Printf("[orders] create-from-main commit: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not create order"})
		return
	}
	notifyOrderNew(ctx, h.db, created)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "orderId": created.ID})
}

// CancelOrderFromMainRequest for POST /api/orders/cancel-from-main (main site: buyer cancels before vendor accepts).
type CancelOrderFromMainRequest struct {
	OrderID int `json:"orderId"`
}

// CancelOrderFromMain rejects the order if still pending and notifies the vendor.
func (h *OrdersHandler) CancelOrderFromMain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req CancelOrderFromMainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	if req.OrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "orderId required"})
		return
	}
	ctx := r.Context()
	existing, err := h.db.GetVendorOrderByID(ctx, req.OrderID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{
				"success": false,
				"code":    "ORDER_NOT_FOUND",
				"message": "Order not found",
			})
			return
		}
		log.Printf("[orders] cancel-from-main load: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not cancel order"})
		return
	}
	if existing == nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{
			"success": false,
			"code":    "ORDER_NOT_FOUND",
			"message": "Order not found",
		})
		return
	}
	if existing.Status != "pending" {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"success": false,
			"code":    "NOT_CANCELLABLE",
			"message": "Order is not pending; it cannot be cancelled from main.",
		})
		return
	}
	updated, err := h.db.CancelVendorOrderIfPending(ctx, req.OrderID, "cancelled_by_customer")
	if err != nil {
		log.Printf("[orders] cancel-from-main error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not cancel order"})
		return
	}
	if updated == nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"success": false,
			"code":    "NOT_CANCELLABLE",
			"message": "Order is no longer pending (race with vendor action).",
		})
		return
	}
	if err := h.db.RestoreInventoryForRejectedOrCancelledOrder(r.Context(), updated); err != nil {
		log.Printf("[orders] restore inventory after customer cancel: %v", err)
	}
	notifyOrderCustomerCancelled(r.Context(), h.db, updated)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "cancelled": true})
}

// profitLossForOrderPaymentPending is per-unit inventory P&L × order line quantity (for multi-qty listings).
func profitLossForOrderPaymentPending(ctx context.Context, database *db.DB, orderID int) *int64 {
	o, err := database.GetVendorOrderByID(ctx, orderID)
	if err != nil || o == nil {
		return nil
	}
	q := o.OrderQuantity
	if q <= 0 {
		q = 1
	}
	if o.InventoryID != nil && *o.InventoryID > 0 {
		inv, ierr := database.GetVendorInventoryByInventoryID(ctx, *o.InventoryID)
		if ierr == nil && inv != nil {
			return db.OrderLineProfitLossCents(inv, q)
		}
	}
	if o.ProfitLossCents != nil && q > 1 {
		v := *o.ProfitLossCents * int64(q)
		return &v
	}
	return o.ProfitLossCents
}

func isDuplicateExternalOrderErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key value violates unique constraint") &&
		strings.Contains(msg, "ux_vendor_orders_vendor_external")
}
