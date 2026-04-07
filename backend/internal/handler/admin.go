package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vendor-api/internal/config"
	"vendor-api/internal/db"
	"vendor-api/internal/storage"

	"github.com/golang-jwt/jwt/v5"
)

// AdminHandler serves /api/admin/* behind JWT or internal secret.
type AdminHandler struct {
	cfg      *config.Config
	db       *db.DB
	uploader storage.Uploader
}

// NewAdminHandler creates the admin API handler.
func NewAdminHandler(cfg *config.Config, database *db.DB, uploader storage.Uploader) *AdminHandler {
	return &AdminHandler{cfg: cfg, db: database, uploader: uploader}
}

type adminJWTClaims struct {
	Email string `json:"email"`
	Phone string `json:"phone"`
	jwt.RegisteredClaims
}

func (h *AdminHandler) authenticate(r *http.Request) (actorEmail string, ok bool) {
	if sec := strings.TrimSpace(h.cfg.AdminInternalSecret); sec != "" {
		if strings.TrimSpace(r.Header.Get("X-Admin-Internal-Secret")) == sec {
			return "internal", true
		}
	}
	secret := strings.TrimSpace(h.cfg.AdminJWTSecret)
	if secret == "" {
		return "", false
	}
	raw := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(raw) < 8 || !strings.EqualFold(raw[:7], "Bearer ") {
		return "", false
	}
	tokenStr := strings.TrimSpace(raw[7:])
	claims := &adminJWTClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return "", false
	}

	// Prefer phone allowlist (MSG91-based admin login).
	if strings.TrimSpace(claims.Phone) != "" {
		phone := normalizePhone(strings.TrimSpace(claims.Phone))
		if phone == "" {
			return "", false
		}
		if h.allowPhone(phone) {
			return phone, true
		}
		return "", false
	}

	// Backward compatibility: email allowlist (Google-based admin login).
	email := strings.TrimSpace(strings.ToLower(claims.Email))
	if email == "" {
		return "", false
	}
	if !h.allowEmail(email) {
		return "", false
	}
	return claims.Email, true
}

func (h *AdminHandler) allowEmail(emailLower string) bool {
	list := strings.TrimSpace(h.cfg.AdminEmailAllowlist)
	if list == "" {
		return false
	}
	for _, part := range strings.Split(list, ",") {
		if strings.TrimSpace(strings.ToLower(part)) == emailLower {
			return true
		}
	}
	return false
}

func (h *AdminHandler) allowPhone(phoneNormalized string) bool {
	list := strings.TrimSpace(h.cfg.AdminPhoneAllowlist)
	if list == "" {
		return false
	}
	phoneNormalized = normalizePhone(phoneNormalized)
	if phoneNormalized == "" {
		return false
	}
	for _, part := range strings.Split(list, ",") {
		p := normalizePhone(strings.TrimSpace(part))
		if p != "" && p == phoneNormalized {
			return true
		}
	}
	return false
}

// ServeHTTP routes /api/admin/*.
func (h *AdminHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	actor, ok := h.authenticate(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]interface{}{"success": false, "message": "Unauthorized"})
		return
	}
	ctx := r.Context()
	p := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/admin"), "/")

	switch {
	case r.Method == http.MethodGet && (p == "" || p == "stats"):
		h.handleStats(w, r, ctx, actor)
	case r.Method == http.MethodGet && p == "users":
		h.handleUsers(w, r, ctx)
	case r.Method == http.MethodGet && p == "verification/queue":
		h.handleVerificationQueue(w, r, ctx)
	case r.Method == http.MethodPost && p == "verification/review":
		h.handleVerificationReview(w, r, ctx, actor)
	case r.Method == http.MethodGet && p == "vouch/queue":
		h.handleVouchQueue(w, r, ctx)
	case r.Method == http.MethodGet && strings.HasPrefix(p, "vouch/entries"):
		h.handleVouchEntries(w, r, ctx)
	case r.Method == http.MethodPost && p == "vouch/review":
		h.handleVouchReview(w, r, ctx, actor)
	case r.Method == http.MethodPost && p == "vouch/skip-cooldown":
		h.handleVouchSkipCooldown(w, r, ctx, actor)
	case r.Method == http.MethodGet && p == "orders":
		h.handleOrdersList(w, r, ctx)
	case r.Method == http.MethodGet && p == "orders/detail":
		h.handleOrderDetail(w, r, ctx)
	case r.Method == http.MethodPost && p == "orders/set-verification":
		h.handleOrderSetVerification(w, r, ctx, actor)
	case r.Method == http.MethodPost && p == "orders/mark-payment-done":
		h.handleOrderMarkPayment(w, r, ctx, actor)
	case r.Method == http.MethodPost && p == "orders/release-payout":
		h.handleOrderReleasePayout(w, r, ctx, actor)
	case r.Method == http.MethodPost && p == "orders/cancel":
		h.handleOrderCancel(w, r, ctx, actor)
	case r.Method == http.MethodGet && p == "tickets":
		h.handleTickets(w, r, ctx)
	case r.Method == http.MethodPost && p == "tickets/status":
		h.handleTicketStatus(w, r, ctx, actor)
	case r.Method == http.MethodPost && p == "presign":
		h.handlePresign(w, r, ctx, actor)
	case r.Method == http.MethodGet && p == "product-requests":
		h.handleProductRequestsList(w, r, ctx)
	case r.Method == http.MethodPost && p == "product-requests/status":
		h.handleProductRequestStatus(w, r, ctx, actor)
	case r.Method == http.MethodPost && p == "product-requests/mark-catalog-added":
		h.handleProductRequestMarkCatalogAdded(w, r, ctx, actor)
	default:
		http.Error(w, "not found", http.StatusNotFound)
	}
}

func (h *AdminHandler) handleStats(w http.ResponseWriter, r *http.Request, ctx context.Context, _ string) {
	s, err := h.db.GetAdminStats(ctx)
	if err != nil {
		log.Printf("[admin] stats: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load stats"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "stats": s})
}

func (h *AdminHandler) handleUsers(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	rows, err := h.db.ListAdminUsers(ctx, limit, offset)
	if err != nil {
		log.Printf("[admin] users: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load users"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "users": rows})
}

func (h *AdminHandler) handleVerificationQueue(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	rows, err := h.db.ListVerificationQueue(ctx)
	if err != nil {
		log.Printf("[admin] verification queue: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load queue"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "items": rows})
}

type adminVerificationReviewBody struct {
	Phone    string `json:"phone"`
	Decision string `json:"decision"`
	Notes    string `json:"notes"`
}

func (h *AdminHandler) handleVerificationReview(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminVerificationReviewBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	phone := normalizePhone(body.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	if err := h.db.SetAdminKycReview(ctx, phone, body.Decision, body.Notes, actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Vendor not found or no verification row"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": err.Error()})
		return
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "kyc_review", "verification", phone, map[string]interface{}{
		"decision": body.Decision, "notes": body.Notes,
	})
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AdminHandler) handleVouchQueue(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	rows, err := h.db.ListVouchReviewQueue(ctx)
	if err != nil {
		log.Printf("[admin] vouch queue: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load queue"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "items": rows})
}

func (h *AdminHandler) handleVouchEntries(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	phone := normalizePhone(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	entries, err := h.db.GetVouchEntriesForPhone(ctx, phone, 80)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load entries"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "entries": entries})
}

type adminVouchReviewBody struct {
	Phone    string `json:"phone"`
	Decision string `json:"decision"`
}

func (h *AdminHandler) handleVouchReview(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminVouchReviewBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	phone := normalizePhone(body.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	decision := strings.TrimSpace(strings.ToLower(body.Decision))
	switch decision {
	case "needs_resubmit":
		if err := h.db.AdminRequestKYCResubmissionByPhone(ctx, phone); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not mark resubmission"})
			return
		}
	default:
		if _, err := h.db.SetVouchReviewDecisionByPhone(ctx, phone, decision, 90); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not apply decision"})
			return
		}
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "vouch_review", "vouch", phone, map[string]interface{}{"decision": decision})
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

type adminSkipCooldownBody struct {
	Phone string `json:"phone"`
}

func (h *AdminHandler) handleVouchSkipCooldown(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminSkipCooldownBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	phone := normalizePhone(body.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	_, err := h.db.FastForwardRejectedCooldownByPhone(ctx, phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not skip cooldown"})
		return
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "vouch_skip_cooldown", "vouch", phone, nil)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AdminHandler) handleOrdersList(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	rows, err := h.db.AdminListAllOrders(ctx, limit, offset, status)
	if err != nil {
		log.Printf("[admin] orders: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load orders"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "orders": rows})
}

func (h *AdminHandler) handleOrderDetail(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	idStr := r.URL.Query().Get("id")
	id, _ := strconv.Atoi(idStr)
	if id <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "id required"})
		return
	}
	row, err := h.db.GetVendorOrderByID(ctx, id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Order not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "order": row})
}

type adminOrderIDBody struct {
	OrderID            int    `json:"orderId"`
	VendorPhone        string `json:"vendorPhone"`
	VerificationStatus string `json:"verificationStatus"`
}

func (h *AdminHandler) handleOrderSetVerification(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminOrderIDBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	body.VendorPhone = strings.TrimSpace(body.VendorPhone)
	status := strings.TrimSpace(strings.ToLower(body.VerificationStatus))
	if body.OrderID <= 0 || body.VendorPhone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "orderId and vendorPhone required"})
		return
	}
	switch status {
	case "real_and_authentic", "needs_docs", "rejected":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "verificationStatus must be real_and_authentic, needs_docs, or rejected"})
		return
	}
	before, err := h.db.GetVendorOrderByID(ctx, body.OrderID)
	if err != nil || before == nil || before.VendorPhone != body.VendorPhone {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Order not found for this vendor"})
		return
	}
	prevVer := verificationStatusNorm(before.VerificationStatus)
	if err := h.db.UpdateVendorOrderVerificationStatus(ctx, body.OrderID, status); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update verification"})
		return
	}
	if prevVer != status {
		row := before
		switch status {
		case "needs_docs":
			notifyOrderVerificationNeedsDocs(ctx, h.db, row.VendorPhone, row.ID, row.ProductName, row.ProductID)
		case "real_and_authentic":
			notifyOrderVerificationApproved(ctx, h.db, row.VendorPhone, row.ID, row.ProductName, row.ProductID)
		case "rejected":
			notifyOrderVerificationRejectedByTeam(ctx, h.db, row.VendorPhone, row.ID, row.ProductName, row.ProductID)
		}
	}
	if status == "real_and_authentic" {
		profitLoss := profitLossForOrderPaymentPending(ctx, h.db, body.OrderID)
		if err := h.db.SetVendorOrderPaymentPending(ctx, body.OrderID, nil, nil, nil, profitLoss); err != nil {
			log.Printf("[admin] set-verification payment_pending: %v", err)
		}
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "order_set_verification", "order", strconv.Itoa(body.OrderID), map[string]interface{}{
		"verificationStatus": body.VerificationStatus, "vendorPhone": body.VendorPhone,
	})
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

type adminOrderPaymentBody struct {
	OrderID     int    `json:"orderId"`
	VendorPhone string `json:"vendorPhone"`
}

func (h *AdminHandler) handleOrderMarkPayment(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminOrderPaymentBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	body.VendorPhone = strings.TrimSpace(body.VendorPhone)
	if body.OrderID <= 0 || body.VendorPhone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "orderId and vendorPhone required"})
		return
	}
	before, _ := h.db.GetVendorOrderByID(ctx, body.OrderID)
	if err := h.db.UpdateVendorOrderStatus(ctx, body.OrderID, body.VendorPhone, "completed"); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update order"})
		return
	}
	if before != nil && before.Status != "completed" {
		if row, err := h.db.GetVendorOrderByID(ctx, body.OrderID); err == nil && row != nil {
			notifyOrderPaymentCompleted(ctx, h.db, row)
		}
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "order_mark_payment", "order", strconv.Itoa(body.OrderID), nil)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

type adminReleasePayoutBody struct {
	OrderID int `json:"orderId"`
}

func (h *AdminHandler) handleOrderReleasePayout(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminReleasePayoutBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	if body.OrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "orderId required"})
		return
	}
	if err := h.db.AdminReleasePayout(ctx, body.OrderID, actor); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Order not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not release payout"})
		return
	}
	if row, err := h.db.GetVendorOrderByID(ctx, body.OrderID); err == nil && row != nil {
		notifyOrderPayoutReleased(ctx, h.db, row)
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "order_release_payout", "order", strconv.Itoa(body.OrderID), nil)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

type adminCancelBody struct {
	OrderID int `json:"orderId"`
}

func (h *AdminHandler) handleOrderCancel(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminCancelBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	if body.OrderID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "orderId required"})
		return
	}
	row, _ := h.db.GetVendorOrderByID(ctx, body.OrderID)
	prevStatus := ""
	if row != nil {
		prevStatus = row.Status
	}
	if err := h.db.AdminRejectOrderWithReason(ctx, body.OrderID, "cancelled_by_admin"); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Order not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not cancel order"})
		return
	}
	if row != nil && prevStatus != "completed" && prevStatus != "rejected" {
		if err := h.db.RestoreInventoryForRejectedOrCancelledOrder(ctx, row); err != nil {
			log.Printf("[admin] restore inventory after cancel: %v", err)
		}
	}
	if row != nil {
		notifyOrderAdminCancelled(ctx, h.db, row)
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "order_cancel", "order", strconv.Itoa(body.OrderID), nil)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

func (h *AdminHandler) handleTickets(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	rows, err := h.db.ListAllSupportTickets(ctx, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load tickets"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "tickets": rows})
}

type adminTicketStatusBody struct {
	TicketID int    `json:"ticketId"`
	Status   string `json:"status"`
}

func (h *AdminHandler) handleTicketStatus(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminTicketStatusBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	if body.TicketID <= 0 || strings.TrimSpace(body.Status) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "ticketId and status required"})
		return
	}
	body.Status = strings.TrimSpace(body.Status)
	switch body.Status {
	case "Open", "In Progress", "Resolved", "Closed":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "status must be Open, In Progress, Resolved, or Closed"})
		return
	}
	ticket, err := h.db.GetTicketByID(ctx, body.TicketID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Ticket not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load ticket"})
		return
	}
	oldStatus := ticket.Status
	if err := h.db.UpdateTicketStatus(ctx, body.TicketID, body.Status); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not update ticket"})
		return
	}
	if oldStatus != body.Status {
		notifyTicketStatus(ctx, h.db, ticket.VendorPhone, ticket.TicketCode, ticket.ID, body.Status)
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "ticket_status", "ticket", strconv.Itoa(body.TicketID), map[string]interface{}{"status": body.Status})
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

type adminPresignBody struct {
	Phone   string `json:"phone"`
	DocType string `json:"docType"`
	URL     string `json:"url"`
	Index   int    `json:"index"` // optional; which file when multiple (Aadhaar/PAN front-back)
}

func (h *AdminHandler) handlePresign(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	if h.uploader == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"success": false, "message": "Storage not configured"})
		return
	}
	var body adminPresignBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	var ref string
	if strings.TrimSpace(body.URL) != "" {
		ref = strings.TrimSpace(body.URL)
	} else {
		phone := normalizePhone(body.Phone)
		dt := strings.ToLower(strings.TrimSpace(body.DocType))
		if phone == "" || (dt != "aadhaar" && dt != "pan") {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Provide url or phone+docType (aadhaar|pan)"})
			return
		}
		aadhaarRefs, panRefs, err := h.db.GetVerificationFileRefsByPhone(ctx, phone)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Could not load verification refs"})
			return
		}
		var refs []string
		if dt == "aadhaar" {
			refs = aadhaarRefs
		} else {
			refs = panRefs
		}
		if len(refs) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "No file uploaded for this document type"})
			return
		}
		idx := body.Index
		if idx < 0 || idx >= len(refs) {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid file index"})
			return
		}
		ref = refs[idx]
	}
	if ref == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "No file reference"})
		return
	}
	u, err := h.uploader.PresignGetURL(ctx, ref, 15*time.Minute)
	if err != nil {
		if storage.IsInvalidStoredRef(err) {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid file reference"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not presign URL"})
		return
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "presign_kyc", "storage", "", map[string]interface{}{"hasUrl": body.URL != ""})
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "url": u, "expiresInSeconds": int((15 * time.Minute).Seconds())})
}

func (h *AdminHandler) handleProductRequestsList(w http.ResponseWriter, r *http.Request, ctx context.Context) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	rows, err := h.db.ListVendorProductRequests(ctx, status, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load requests"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "requests": rows})
}

type adminProductReqStatusBody struct {
	ID         int    `json:"id"`
	Status     string `json:"status"`
	AdminNotes string `json:"adminNotes"`
}

func (h *AdminHandler) handleProductRequestStatus(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminProductReqStatusBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	if body.ID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "id required"})
		return
	}
	reqRow, err := h.db.GetVendorProductRequestByID(ctx, body.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Request not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load request"})
		return
	}
	oldStatus := reqRow.Status
	if err := h.db.UpdateVendorProductRequestStatus(ctx, body.ID, body.Status, body.AdminNotes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not update request"})
		return
	}
	if oldStatus != body.Status {
		switch strings.TrimSpace(strings.ToLower(body.Status)) {
		case "in_review":
			notifyProductRequestReview(ctx, h.db, reqRow.VendorPhone, reqRow.ProductName, body.ID)
		case "approved":
			notifyProductRequestApproved(ctx, h.db, reqRow.VendorPhone, reqRow.ProductName, body.ID)
		case "rejected":
			notifyProductRequestRejected(ctx, h.db, reqRow.VendorPhone, reqRow.ProductName, body.ID, body.AdminNotes)
		}
	}
	_ = h.db.InsertAdminAudit(ctx, actor, "product_request_status", "product_request", strconv.Itoa(body.ID), map[string]interface{}{"status": body.Status})
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

type adminProductReqIDBody struct {
	ID int `json:"id"`
}

func (h *AdminHandler) handleProductRequestMarkCatalogAdded(w http.ResponseWriter, r *http.Request, ctx context.Context, actor string) {
	var body adminProductReqIDBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	if body.ID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "id required"})
		return
	}
	reqRow, err := h.db.GetVendorProductRequestByID(ctx, body.ID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Request not found"})
		return
	}
	if err := h.db.UpdateVendorProductRequestStatus(ctx, body.ID, "catalog_added", ""); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not update request"})
		return
	}
	notifyProductCatalogAdded(ctx, h.db, reqRow.VendorPhone, reqRow.ProductName, body.ID)
	_ = h.db.InsertAdminAudit(ctx, actor, "product_request_catalog_added", "product_request", strconv.Itoa(body.ID), nil)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}
