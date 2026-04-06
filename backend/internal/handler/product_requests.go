package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"vendor-api/internal/db"
)

// ProductRequestsHandler handles vendor-submitted catalog requests.
type ProductRequestsHandler struct {
	db *db.DB
}

// NewProductRequestsHandler creates the handler.
func NewProductRequestsHandler(database *db.DB) *ProductRequestsHandler {
	return &ProductRequestsHandler{db: database}
}

type createProductRequestBody struct {
	Phone       string `json:"phone"`
	ProductName string `json:"productName"`
	Brand       string `json:"brand"`
	Category    string `json:"category"`
	Notes       string `json:"notes"`
}

// Create handles POST /api/product-requests (vendor flow).
func (h *ProductRequestsHandler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body createProductRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	phone := normalizePhone(body.Phone)
	if phone == "" || strings.TrimSpace(body.ProductName) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone and productName required"})
		return
	}
	row, err := h.db.CreateVendorProductRequest(r.Context(), phone, body.ProductName, body.Brand, body.Category, body.Notes)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not save request"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "request": row})
}
