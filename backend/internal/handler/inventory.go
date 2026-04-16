package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"vendor-api/internal/db"
)

// InventoryHandler handles vendor inventory APIs.
type InventoryHandler struct {
	db *db.DB
}

// NewInventoryHandler creates an inventory handler.
func NewInventoryHandler(database *db.DB) *InventoryHandler {
	return &InventoryHandler{db: database}
}

// CreateInventoryRequest is the body for POST /api/inventory.
type CreateInventoryRequest struct {
	VendorPhone        string `json:"vendorPhone"`
	ProductID          string `json:"productId"`
	SKUID              string `json:"skuId"`
	Category           string `json:"category"`
	Size               string `json:"size"`
	PurchasePriceCents *int64 `json:"purchasePriceCents"`
	DesiredPayoutCents *int64 `json:"desiredPayoutCents"`
	ListedPriceCents   *int64 `json:"listedPriceCents"`
	FinalPayoutCents   *int64 `json:"finalPayoutCents"`
	ProfitLossCents    *int64 `json:"profitLossCents"`
	PairLocation       string `json:"pairLocation"`
	Availability       string `json:"availability"`
	BoxCondition       string `json:"boxCondition"`
	ProductQty         string `json:"productQty"`
	PurchaseDate       string `json:"purchaseDate"` // YYYY-MM-DD or empty
	PlaceOfPurchase    string `json:"placeOfPurchase"`
}

// CreateInventory handles POST /api/inventory.
func (h *InventoryHandler) CreateInventory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req CreateInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.VendorPhone = strings.TrimSpace(req.VendorPhone)
	req.ProductID = strings.TrimSpace(req.ProductID)
	req.Category = strings.TrimSpace(strings.ToLower(req.Category))
	if req.VendorPhone == "" || req.ProductID == "" || req.Category == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "vendorPhone, productId, and category required"})
		return
	}
	size := strings.TrimSpace(req.Size)
	if size == "" {
		size = "OneSize"
	}
	var purchaseDate *time.Time
	if req.PurchaseDate != "" {
		if t, err := time.Parse("2006-01-02", req.PurchaseDate); err == nil {
			purchaseDate = &t
		}
	}
	var pairLoc, avail, boxCond, productQty, placeOfPurchase *string
	if req.PairLocation != "" {
		pairLoc = &req.PairLocation
	}
	if req.Availability != "" {
		avail = &req.Availability
	}
	if req.BoxCondition != "" {
		boxCond = &req.BoxCondition
	}
	if req.ProductQty != "" {
		productQty = &req.ProductQty
	}
	if req.PlaceOfPurchase != "" {
		placeOfPurchase = &req.PlaceOfPurchase
	}
	row := db.VendorInventoryRow{
		VendorPhone:        req.VendorPhone,
		ProductID:          req.ProductID,
		SKUID:              ptrTrim(req.SKUID),
		Category:           req.Category,
		Size:               size,
		PurchasePriceCents: req.PurchasePriceCents,
		DesiredPayoutCents: req.DesiredPayoutCents,
		ListedPriceCents:   req.ListedPriceCents,
		FinalPayoutCents:   req.FinalPayoutCents,
		ProfitLossCents:    req.ProfitLossCents,
		PairLocation:       pairLoc,
		Availability:       avail,
		BoxCondition:       boxCond,
		ProductQty:         productQty,
		QuantityRemaining:  db.ParseListingQuantityFromProductQty(productQty),
		PurchaseDate:       purchaseDate,
		PlaceOfPurchase:    placeOfPurchase,
		ListingStatus:      "save_for_later",
		SoldOut:            false,
	}
	created, err := h.db.CreateVendorInventory(r.Context(), row)
	if err != nil {
		log.Printf("[inventory] create error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not save inventory"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":     true,
		"message":     "Saved",
		"inventoryId": created.InventoryID,
		"id":          created.ID,
	})
}

// GetInventoryResponse for GET /api/inventory.
type GetInventoryResponse struct {
	Success   bool                   `json:"success"`
	Message   string                 `json:"message,omitempty"`
	Inventory *db.VendorInventoryRow `json:"inventory,omitempty"`
}

// GetInventory handles GET /api/inventory?phone=&productId=&category=.
func (h *InventoryHandler) GetInventory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	phone := strings.TrimSpace(r.URL.Query().Get("phone"))
	productID := strings.TrimSpace(r.URL.Query().Get("productId"))
	category := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("category")))
	if phone == "" || productID == "" || category == "" {
		writeJSON(w, http.StatusBadRequest, GetInventoryResponse{Success: false, Message: "phone, productId, and category required"})
		return
	}
	row, err := h.db.GetVendorInventoryByProduct(r.Context(), phone, productID, category)
	if err != nil {
		log.Printf("[inventory] get error: %v", err)
		writeJSON(w, http.StatusInternalServerError, GetInventoryResponse{Success: false, Message: "Could not load inventory"})
		return
	}
	if row == nil {
		writeJSON(w, http.StatusOK, GetInventoryResponse{Success: true, Inventory: nil})
		return
	}
	writeJSON(w, http.StatusOK, GetInventoryResponse{Success: true, Inventory: row})
}

// UpdateListingStatusRequest for PATCH /api/inventory/listing-status.
type UpdateListingStatusRequest struct {
	VendorPhone    string `json:"vendorPhone"`
	InventoryRowID int    `json:"id"`            // table primary key (id)
	ListingStatus  string `json:"listingStatus"` // "save_for_later" | "list_now"
}

// UpdateListingStatus handles PATCH /api/inventory/listing-status.
func (h *InventoryHandler) UpdateListingStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch && r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req UpdateListingStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	status := strings.TrimSpace(strings.ToLower(req.ListingStatus))
	if status != "save_for_later" && status != "list_now" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "listingStatus must be save_for_later or list_now"})
		return
	}
	if req.InventoryRowID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "id required"})
		return
	}
	err := h.db.UpdateVendorInventoryListingStatus(r.Context(), req.InventoryRowID, status)
	if err != nil {
		log.Printf("[inventory] update status error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "Updated"})
}

// ListInventoryResponse for GET /api/inventory/list.
type ListInventoryResponse struct {
	Success   bool                 `json:"success"`
	Message   string               `json:"message,omitempty"`
	Inventory []InventoryListItem  `json:"inventory,omitempty"`
}

// InventoryListItem is one vendor_inventory row plus an optional catalog ProductCard (batch-loaded).
type InventoryListItem struct {
	db.VendorInventoryRow
	Product *db.ProductCard `json:"product,omitempty"`
}

// ListInventory handles GET /api/inventory/list?phone=.
func (h *InventoryHandler) ListInventory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	phone := strings.TrimSpace(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, ListInventoryResponse{Success: false, Message: "phone required"})
		return
	}
	rows, err := h.db.ListVendorInventory(r.Context(), phone)
	if err != nil {
		log.Printf("[inventory] list error: %v", err)
		writeJSON(w, http.StatusInternalServerError, ListInventoryResponse{Success: false, Message: "Could not load inventory"})
		return
	}
	pairs := make([]struct{ Category, ProductID string }, 0, len(rows))
	for _, row := range rows {
		pairs = append(pairs, struct{ Category, ProductID string }{Category: row.Category, ProductID: row.ProductID})
	}
	cardMap, batchErr := h.db.GetProductCardsBatch(r.Context(), pairs)
	if batchErr != nil {
		log.Printf("[inventory] batch product cards: %v", batchErr)
		cardMap = nil
	}
	out := make([]InventoryListItem, 0, len(rows))
	for _, row := range rows {
		item := InventoryListItem{VendorInventoryRow: row}
		if cardMap != nil {
			key := db.ProductCardBatchKey(row.Category, row.ProductID)
			if p, ok := cardMap[key]; ok {
				pc := p
				item.Product = &pc
			}
		}
		out = append(out, item)
	}
	writeJSON(w, http.StatusOK, ListInventoryResponse{Success: true, Inventory: out})
}

// UpdateSoldOutRequest for POST /api/inventory/mark-sold.
type UpdateSoldOutRequest struct {
	VendorPhone    string `json:"vendorPhone"`
	InventoryRowID int    `json:"id"`      // table primary key (id)
	SoldOut        *bool  `json:"soldOut"` // optional, defaults to true
}

// UpdateSoldOut marks an inventory row as sold or unsold.
func (h *InventoryHandler) UpdateSoldOut(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req UpdateSoldOutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	if req.InventoryRowID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "id required"})
		return
	}
	sold := true
	if req.SoldOut != nil {
		sold = *req.SoldOut
	}
	if err := h.db.UpdateVendorInventorySoldOut(r.Context(), req.InventoryRowID, sold); err != nil {
		log.Printf("[inventory] update sold_out error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update sold status"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "Updated"})
}

// DeleteInventoryRequest for POST /api/inventory/delete.
type DeleteInventoryRequest struct {
	VendorPhone    string `json:"vendorPhone"`
	InventoryRowID int    `json:"id"` // table primary key (id)
}

// DeleteInventory permanently deletes an inventory row.
func (h *InventoryHandler) DeleteInventory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req DeleteInventoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	if req.InventoryRowID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "id required"})
		return
	}
	if err := h.db.DeleteVendorInventory(r.Context(), req.InventoryRowID); err != nil {
		log.Printf("[inventory] delete error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not delete inventory"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// GetListings handles GET /api/listings?category=&skuId=&productId=&size= (for main site price feed).
// When size is omitted: returns all live listings for that product+category (all sizes), each with "size" so the main site can filter in the UI.
// When size is provided: returns only listings for that size.
// Response shape: { vendorId, vendorName?, price (INR), inventoryId?, size }.
func (h *InventoryHandler) GetListings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	skuID := strings.TrimSpace(r.URL.Query().Get("skuId"))
	productID := strings.TrimSpace(r.URL.Query().Get("productId"))
	category := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("category")))
	sizeParam := strings.TrimSpace(r.URL.Query().Get("size"))
	if category == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "category required"})
		return
	}
	normalizedSKU := db.NormalizeSKUID(ptrTrim(skuID))
	skuValid := normalizedSKU != nil
	// Handbags are SKU-first. Other categories continue productId matching.
	useSKUFirst := category == "handbags"
	if !useSKUFirst && productID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "productId required"})
		return
	}
	if useSKUFirst && !skuValid && productID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "skuId or productId required for handbags"})
		return
	}
	var rows []db.LiveListingRow
	var err error
	switch {
	case useSKUFirst && skuValid && sizeParam == "":
		rows, err = h.db.ListLiveListingsBySKUAllSizes(r.Context(), skuID, category)
	case useSKUFirst && skuValid && sizeParam != "":
		rows, err = h.db.ListLiveListingsBySKU(r.Context(), skuID, category, sizeParam)
	case sizeParam == "":
		// Fallback to productId (handbags without skuId, and all non-handbag categories).
		rows, err = h.db.ListLiveListingsAllSizes(r.Context(), productID, category)
	default:
		rows, err = h.db.ListLiveListings(r.Context(), productID, category, sizeParam)
	}
	if err != nil {
		log.Printf("[listings] list error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load listings"})
		return
	}
	// Map to main site contract: vendorId, price in INR, inventoryId, size (required for size grid).
	listings := make([]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		sizeVal := row.Size
		if sizeVal == "" {
			sizeVal = "OneSize"
		}
		listings = append(listings, map[string]interface{}{
			"vendorId":          row.VendorPhone,
			"vendorName":        "House of Plutus",
			"vendorDisplayName": "House of Plutus",
			"price":             row.ListedPriceCents / 100,
			"inventoryId":       row.InventoryID,
			"size":              sizeVal,
			"compareOnly":       false,
			"sourceKey":         "vendor",
			"vendorLogoUrl":     "",
			"quantityRemaining": row.QuantityRemaining,
			"skuId":             row.SKUID,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "vendorListings": listings})
}

func ptrTrim(v string) *string {
	t := strings.TrimSpace(v)
	if t == "" {
		return nil
	}
	return &t
}
