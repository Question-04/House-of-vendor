package handler

import (
	"encoding/json"
	"net/http"
)

// VerifyTokenRequest body: access token from MSG91 widget + phone for our DB.
type VerifyTokenRequest struct {
	AccessToken string `json:"accessToken"`
	Phone      string `json:"phone"`
}

// VerifyTokenResponse body.
type VerifyTokenResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	NextStep   string `json:"nextStep,omitempty"`
	ProfileOK  bool   `json:"profileCompleted,omitempty"`
	VerifyOK   bool   `json:"verificationCompleted,omitempty"`
	GetVouchOK bool   `json:"getVouchCompleted,omitempty"`
}

// VerifyToken verifies the JWT from MSG91 OTP Widget via control.msg91.com API.
func (h *OTPHandler) VerifyToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req VerifyTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, VerifyTokenResponse{Success: false, Message: "Invalid request"})
		return
	}
	if req.AccessToken == "" {
		writeJSON(w, http.StatusBadRequest, VerifyTokenResponse{Success: false, Message: "Access token is required"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, VerifyTokenResponse{Success: false, Message: "Phone is required"})
		return
	}

	if h.cfg.MSG91AuthKey == "" {
		writeJSON(w, http.StatusInternalServerError, VerifyTokenResponse{Success: false, Message: "OTP service not configured"})
		return
	}
	resp, err := h.msg.VerifyAccessToken(req.AccessToken)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, VerifyTokenResponse{Success: false, Message: "Verification failed"})
		return
	}
	if resp.Type != "success" {
		writeJSON(w, http.StatusBadRequest, VerifyTokenResponse{Success: false, Message: "Invalid or expired token"})
		return
	}
	_, _ = h.db.RecordPhoneLoginSuccess(r.Context(), phone)
	status, err := h.db.GetOnboardingStatusByPhone(r.Context(), phone)
	if err != nil {
		writeJSON(w, http.StatusOK, VerifyTokenResponse{Success: true, Message: "Verified"})
		return
	}
	writeJSON(w, http.StatusOK, VerifyTokenResponse{
		Success:    true,
		Message:    "Verified",
		NextStep:   string(status.NextStep),
		ProfileOK:  status.ProfileStatus == "completed",
		VerifyOK:   status.VerificationStatus == "completed",
		GetVouchOK: status.GetVouchStatus == "completed",
	})
}
