package handler

import (
	"encoding/json"
	"net/http"

	"vendor-api/internal/config"
	"vendor-api/internal/db"
	"vendor-api/internal/msg91"
	"vendor-api/internal/storage"
)

// OTPHandler handles send, verify, resend OTP.
type OTPHandler struct {
	cfg     *config.Config
	msg     *msg91.Client
	db      *db.DB
	storage storage.Uploader
}

// NewOTPHandler creates OTP handler.
func NewOTPHandler(cfg *config.Config, msg *msg91.Client, database *db.DB, uploader storage.Uploader) *OTPHandler {
	return &OTPHandler{cfg: cfg, msg: msg, db: database, storage: uploader}
}

// SendOTPRequest body.
type SendOTPRequest struct {
	Phone string `json:"phone"`
}

// SendOTPResponse body.
type SendOTPResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// SendOTP sends OTP to the given phone (with country code, e.g. 919876543210).
func (h *OTPHandler) SendOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req SendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, SendOTPResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, SendOTPResponse{Success: false, Message: "Phone number is required"})
		return
	}

	// Magic OTP mode: don't call MSG91, just acknowledge. User can then enter MAGIC_OTP to verify.
	if h.cfg.EnableMagicOTP && h.cfg.MagicOTP != "" {
		_, _ = h.db.CreateUser(r.Context(), phone)
		writeJSON(w, http.StatusOK, SendOTPResponse{Success: true, Message: "OTP sent (magic mode)"})
		return
	}

	if h.cfg.MSG91AuthKey == "" {
		writeJSON(w, http.StatusInternalServerError, SendOTPResponse{Success: false, Message: "OTP service not configured"})
		return
	}
	resp, err := h.msg.SendOTP(phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, SendOTPResponse{Success: false, Message: "Failed to send OTP"})
		return
	}
	if resp.Type != "success" {
		writeJSON(w, http.StatusBadRequest, SendOTPResponse{Success: false, Message: "Could not send OTP. Try resend."})
		return
	}
	_, _ = h.db.CreateUser(r.Context(), phone)
	writeJSON(w, http.StatusOK, SendOTPResponse{Success: true, Message: "OTP sent"})
}

// VerifyOTPRequest body.
type VerifyOTPRequest struct {
	Phone string `json:"phone"`
	OTP   string `json:"otp"`
}

// VerifyOTPResponse body.
type VerifyOTPResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Token   string `json:"token,omitempty"` // optional session token for later
}

// VerifyOTP verifies OTP for the phone.
func (h *OTPHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, VerifyOTPResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" || req.OTP == "" {
		writeJSON(w, http.StatusBadRequest, VerifyOTPResponse{Success: false, Message: "Phone and OTP are required"})
		return
	}

	// Magic OTP: accept configured OTP for testing without SMS.
	if h.cfg.EnableMagicOTP && h.cfg.MagicOTP != "" {
		if req.OTP == h.cfg.MagicOTP {
			user, _ := h.db.RecordPhoneLoginSuccess(r.Context(), phone)
			_ = user
			writeJSON(w, http.StatusOK, VerifyOTPResponse{Success: true, Message: "Verified"})
			return
		}
		writeJSON(w, http.StatusBadRequest, VerifyOTPResponse{Success: false, Message: "OTP is not matching"})
		return
	}

	if h.cfg.MSG91AuthKey == "" {
		writeJSON(w, http.StatusInternalServerError, VerifyOTPResponse{Success: false, Message: "OTP service not configured"})
		return
	}
	resp, err := h.msg.VerifyOTP(phone, req.OTP)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, VerifyOTPResponse{Success: false, Message: "Verification failed"})
		return
	}
	if resp.Type != "success" {
		writeJSON(w, http.StatusBadRequest, VerifyOTPResponse{Success: false, Message: "OTP is not matching"})
		return
	}
	user, _ := h.db.RecordPhoneLoginSuccess(r.Context(), phone)
	_ = user
	writeJSON(w, http.StatusOK, VerifyOTPResponse{Success: true, Message: "Verified"})
}

// ResendOTPRequest body.
type ResendOTPRequest struct {
	Phone string `json:"phone"`
}

// ResendOTP resends OTP.
func (h *OTPHandler) ResendOTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req ResendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, SendOTPResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, SendOTPResponse{Success: false, Message: "Phone number is required"})
		return
	}

	if h.cfg.EnableMagicOTP && h.cfg.MagicOTP != "" {
		writeJSON(w, http.StatusOK, SendOTPResponse{Success: true, Message: "OTP sent (magic mode)"})
		return
	}

	if h.cfg.MSG91AuthKey == "" {
		writeJSON(w, http.StatusInternalServerError, SendOTPResponse{Success: false, Message: "OTP service not configured"})
		return
	}
	resp, err := h.msg.ResendOTP(phone, "text")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, SendOTPResponse{Success: false, Message: "Failed to resend OTP"})
		return
	}
	if resp.Type != "success" {
		writeJSON(w, http.StatusBadRequest, SendOTPResponse{Success: false, Message: "Could not resend OTP"})
		return
	}
	writeJSON(w, http.StatusOK, SendOTPResponse{Success: true, Message: "OTP sent"})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// normalizePhone ensures country code (default India 91 if 10 digits).
func normalizePhone(phone string) string {
	var digits string
	for _, c := range phone {
		if c >= '0' && c <= '9' {
			digits += string(c)
		}
	}
	if len(digits) == 10 {
		return "91" + digits
	}
	if len(digits) >= 10 {
		return digits
	}
	return ""
}
