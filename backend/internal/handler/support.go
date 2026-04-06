package handler

import (
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

type SupportHandler struct {
	db       *db.DB
	uploader storage.Uploader
}

func NewSupportHandler(database *db.DB, uploader storage.Uploader) *SupportHandler {
	return &SupportHandler{db: database, uploader: uploader}
}

type CreateTicketRequest struct {
	VendorPhone string `json:"vendorPhone"`
	Category    string `json:"category"`
	OrderID     string `json:"orderId"`
	Subject     string `json:"subject"`
	Description string `json:"description"`
	Email       string `json:"email"`
	Priority    string `json:"priority"`
}

// Tickets handles GET (list) and POST (create) on /api/support/tickets.
func (h *SupportHandler) Tickets(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		h.listTickets(w, r)
		return
	}
	if r.Method == http.MethodPost {
		h.createTicket(w, r)
		return
	}
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (h *SupportHandler) listTickets(w http.ResponseWriter, r *http.Request) {
	phone := strings.TrimSpace(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	rows, err := h.db.ListSupportTickets(r.Context(), phone)
	if err != nil {
		log.Printf("[support] list error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load tickets"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "tickets": rows})
}

func (h *SupportHandler) createTicket(w http.ResponseWriter, r *http.Request) {
	var req CreateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.VendorPhone = strings.TrimSpace(req.VendorPhone)
	req.Category = strings.TrimSpace(req.Category)
	req.Subject = strings.TrimSpace(req.Subject)
	req.Description = strings.TrimSpace(req.Description)
	req.Email = strings.TrimSpace(req.Email)
	req.Priority = strings.TrimSpace(req.Priority)
	if req.VendorPhone == "" || req.Category == "" || req.Subject == "" || req.Description == "" || req.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "vendorPhone, category, subject, description, email required"})
		return
	}
	if req.Priority == "" {
		req.Priority = "Medium"
	}
	ticket, err := h.db.CreateSupportTicket(r.Context(), req.VendorPhone, req.Category, req.OrderID, req.Subject, req.Description, req.Email, req.Priority)
	if err != nil {
		log.Printf("[support] create error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not create ticket"})
		return
	}
	notifyTicketCreated(r.Context(), h.db, ticket)
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "ticket": ticket})
}

const supportDocMaxSize = 5 * 1024 * 1024

var supportDocMimes = map[string]bool{"image/jpeg": true, "image/jpg": true, "image/png": true, "application/pdf": true}

// UploadTicketDocs handles POST /api/support/tickets/upload (multipart: phone, ticketId, file(s)).
func (h *SupportHandler) UploadTicketDocs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.uploader == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"success": false, "message": "Upload not configured"})
		return
	}
	if err := r.ParseMultipartForm(supportDocMaxSize * 4); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid form"})
		return
	}
	phone := strings.TrimSpace(r.FormValue("phone"))
	ticketIDStr := strings.TrimSpace(r.FormValue("ticketId"))
	if phone == "" || ticketIDStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone and ticketId required"})
		return
	}
	ticketID, _ := strconv.Atoi(ticketIDStr)
	if ticketID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "invalid ticketId"})
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
		if header.Size > supportDocMaxSize {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "File too large (max 5MB): " + header.Filename})
			return
		}
		file, err := header.Open()
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not read file"})
			return
		}
		content, err := io.ReadAll(io.LimitReader(file, supportDocMaxSize+1))
		_ = file.Close()
		if err != nil || int64(len(content)) > supportDocMaxSize {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "File too large"})
			return
		}
		mime := header.Header.Get("Content-Type")
		if mime == "" {
			mime = http.DetectContentType(content)
		}
		if !supportDocMimes[mime] {
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
		objectKey := "support-docs/" + strconv.Itoa(ticketID) + "/" + time.Now().Format("20060102150405") + "_" + header.Filename + ext
		url, err := h.uploader.Upload(r.Context(), objectKey, content, mime)
		if err != nil {
			log.Printf("[support] upload doc error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not upload file"})
			return
		}
		if err := h.db.AppendTicketDocURL(r.Context(), ticketID, phone, url); err != nil {
			log.Printf("[support] append doc url error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not save document reference"})
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

const ticketDocPresignTTL = 3 * time.Minute

// TicketDocURL handles GET /api/support/tickets/doc-url — presigned GET for one attachment (vendor must own the ticket).
func (h *SupportHandler) TicketDocURL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.uploader == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"success": false, "message": "File access not configured"})
		return
	}
	phone := strings.TrimSpace(r.URL.Query().Get("phone"))
	ticketIDStr := strings.TrimSpace(r.URL.Query().Get("ticketId"))
	indexStr := strings.TrimSpace(r.URL.Query().Get("index"))
	if phone == "" || ticketIDStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone and ticketId required"})
		return
	}
	ticketID, err := strconv.Atoi(ticketIDStr)
	if err != nil || ticketID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "invalid ticketId"})
		return
	}
	idx, err := strconv.Atoi(indexStr)
	if err != nil || idx < 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "valid index required"})
		return
	}
	ticket, err := h.db.GetTicketByID(r.Context(), ticketID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Ticket not found"})
			return
		}
		log.Printf("[support] doc-url get ticket: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load ticket"})
		return
	}
	if ticket.VendorPhone != phone {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Ticket not found"})
		return
	}
	if idx >= len(ticket.DocURLs) {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Attachment not found"})
		return
	}
	ref := strings.TrimSpace(ticket.DocURLs[idx])
	if ref == "" {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Attachment not found"})
		return
	}
	u, err := h.uploader.PresignGetURL(r.Context(), ref, ticketDocPresignTTL)
	if err != nil {
		if storage.IsInvalidStoredRef(err) {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid file reference"})
			return
		}
		log.Printf("[support] doc-url presign: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not open file"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":          true,
		"url":              u,
		"expiresInSeconds": int(ticketDocPresignTTL.Seconds()),
	})
}

type UpdateTicketStatusRequest struct {
	TicketID int    `json:"ticketId"`
	Status   string `json:"status"`
}

// UpdateTicketStatus handles POST /api/support/tickets/status.
func (h *SupportHandler) UpdateTicketStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req UpdateTicketStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	req.Status = strings.TrimSpace(req.Status)
	if req.TicketID <= 0 || req.Status == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "ticketId and status required"})
		return
	}
	switch req.Status {
	case "Open", "In Progress", "Resolved", "Closed":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "status must be Open, In Progress, Resolved, or Closed"})
		return
	}
	ticket, err := h.db.GetTicketByID(r.Context(), req.TicketID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Ticket not found"})
			return
		}
		log.Printf("[support] get ticket error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load ticket"})
		return
	}
	oldStatus := ticket.Status
	if err := h.db.UpdateTicketStatus(r.Context(), req.TicketID, req.Status); err != nil {
		log.Printf("[support] update status error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update ticket status"})
		return
	}
	if oldStatus != req.Status {
		notifyTicketStatus(r.Context(), h.db, ticket.VendorPhone, ticket.TicketCode, ticket.ID, req.Status)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}
