package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"golang.org/x/sync/errgroup"
	"vendor-api/internal/db"
)

// NotificationsHandler serves GET /api/notifications and POST /api/notifications/mark-read.
type NotificationsHandler struct {
	db *db.DB
}

func NewNotificationsHandler(database *db.DB) *NotificationsHandler {
	return &NotificationsHandler{db: database}
}

type notificationOut struct {
	ID          int64                  `json:"id"`
	VendorPhone string                 `json:"vendorPhone"`
	Category    string                 `json:"category"`
	Kind        string                 `json:"kind"`
	Title       string                 `json:"title"`
	Body        string                 `json:"body"`
	Meta        map[string]interface{} `json:"meta"`
	ReadAt      *string                `json:"readAt"`
	CreatedAt   string                 `json:"createdAt"`
}

// Notifications handles GET (list + unread count) and POST mark-read.
func (h *NotificationsHandler) Notifications(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.list(w, r)
	case http.MethodPost:
		h.markRead(w, r)
	case http.MethodDelete:
		h.deleteOne(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *NotificationsHandler) list(w http.ResponseWriter, r *http.Request) {
	phone := strings.TrimSpace(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	ctx := r.Context()
	var rows []db.VendorNotificationRow
	var unread int64
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		var err error
		rows, err = h.db.ListVendorNotifications(gctx, phone, 200)
		if err != nil {
			log.Printf("[notifications] list: %v", err)
		}
		return err
	})
	g.Go(func() error {
		var err error
		unread, err = h.db.CountUnreadVendorNotifications(gctx, phone)
		if err != nil {
			log.Printf("[notifications] count: %v", err)
			unread = 0
		}
		return nil
	})
	if err := g.Wait(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load notifications"})
		return
	}
	out := make([]notificationOut, 0, len(rows))
	for _, row := range rows {
		var meta map[string]interface{}
		if len(row.Meta) > 0 {
			_ = json.Unmarshal(row.Meta, &meta)
		}
		if meta == nil {
			meta = map[string]interface{}{}
		}
		var readPtr *string
		if row.ReadAt != nil {
			s := row.ReadAt.UTC().Format("2006-01-02T15:04:05.000Z")
			readPtr = &s
		}
		out = append(out, notificationOut{
			ID: row.ID, VendorPhone: row.VendorPhone, Category: row.Category, Kind: row.Kind,
			Title: row.Title, Body: row.Body, Meta: meta, ReadAt: readPtr,
			CreatedAt: row.CreatedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true, "notifications": out, "unreadCount": unread,
	})
}

type markReadBody struct {
	Phone string `json:"phone"`
}

func (h *NotificationsHandler) markRead(w http.ResponseWriter, r *http.Request) {
	var body markReadBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	phone := strings.TrimSpace(body.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	if err := h.db.MarkAllVendorNotificationsRead(r.Context(), phone); err != nil {
		log.Printf("[notifications] mark read: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not update"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

type deleteNotificationBody struct {
	Phone string `json:"phone"`
	ID    int64  `json:"id"`
}

func (h *NotificationsHandler) deleteOne(w http.ResponseWriter, r *http.Request) {
	var body deleteNotificationBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid JSON"})
		return
	}
	phone := strings.TrimSpace(body.Phone)
	if phone == "" || body.ID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone and id required"})
		return
	}
	ok, err := h.db.DeleteVendorNotificationByID(r.Context(), phone, body.ID)
	if err != nil {
		log.Printf("[notifications] delete: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not delete"})
		return
	}
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Notification not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true})
}

// UnreadCount handles GET /api/notifications/unread-count?phone=
func (h *NotificationsHandler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	phone := strings.TrimSpace(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "phone required"})
		return
	}
	n, err := h.db.CountUnreadVendorNotifications(r.Context(), phone)
	if err != nil {
		log.Printf("[notifications] unread: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not count"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "unreadCount": n})
}
