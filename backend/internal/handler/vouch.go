package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vendor-api/internal/db"
)

type vouchStatusResponse struct {
	Success      bool   `json:"success"`
	Message      string `json:"message"`
	VouchCount   int    `json:"vouchCount"`
	Target       int    `json:"target"`
	ShareToken   string `json:"shareToken,omitempty"`
	ShareURL     string `json:"shareUrl,omitempty"`
	StepStatus   string `json:"stepStatus,omitempty"`
	ReviewStatus string `json:"reviewStatus,omitempty"`
	ProgressText string `json:"progressText,omitempty"`
	VendorName   string `json:"vendorName,omitempty"`
	ReapplyAfter string `json:"reapplyAfter,omitempty"`
}

type vouchGenerateRequest struct {
	Phone string `json:"phone"`
}

type submitPublicVouchRequest struct {
	Token     string `json:"token"`
	Name      string `json:"name"`
	BrandName string `json:"brandName"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
}

type devVouchAddRequest struct {
	Phone string `json:"phone"`
	Count int    `json:"count"`
}

type devReviewDecisionRequest struct {
	Phone    string `json:"phone"`
	Decision string `json:"decision"`
}

type vouchReapplyRequest struct {
	Phone string `json:"phone"`
}

type devCooldownEndRequest struct {
	Phone string `json:"phone"`
}

func (h *OTPHandler) GetVouchStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	phone := normalizePhone(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Phone is required"})
		return
	}
	status, err := h.db.GetVouchStatusByPhone(r.Context(), phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, vouchStatusResponse{Success: false, Message: "Could not load vouch status"})
		return
	}
	writeJSON(w, http.StatusOK, toVouchStatusResponse(h.cfg.FrontendBaseURL, status, "Status loaded"))
}

func (h *OTPHandler) GenerateVouchLink(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req vouchGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Phone is required"})
		return
	}
	if _, err := h.db.EnsureVouchShareTokenByPhone(r.Context(), phone); err != nil {
		writeJSON(w, http.StatusInternalServerError, vouchStatusResponse{Success: false, Message: "Could not generate share link"})
		return
	}
	status, err := h.db.GetVouchStatusByPhone(r.Context(), phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, vouchStatusResponse{Success: false, Message: "Could not load vouch status"})
		return
	}
	writeJSON(w, http.StatusOK, toVouchStatusResponse(h.cfg.FrontendBaseURL, status, "Vouch link ready"))
}

func (h *OTPHandler) GetPublicVouchInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Token is required"})
		return
	}

	status, err := h.db.GetVouchStatusByToken(r.Context(), token)
	if err != nil {
		if errors.Is(err, db.ErrVouchLinkNotFound) {
			writeJSON(w, http.StatusNotFound, vouchStatusResponse{Success: false, Message: "This vouch link is invalid or inactive"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, vouchStatusResponse{Success: false, Message: "Could not load vouch link"})
		return
	}

	writeJSON(w, http.StatusOK, toVouchStatusResponse(h.cfg.FrontendBaseURL, status, "Link loaded"))
}

func (h *OTPHandler) SubmitPublicVouch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req submitPublicVouchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Invalid request"})
		return
	}
	if strings.TrimSpace(req.Token) == "" {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Token is required"})
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.BrandName) == "" || strings.TrimSpace(req.Email) == "" {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Please fill all required details"})
		return
	}
	phoneDigits := digitsOnly(req.Phone)
	if len(phoneDigits) < 10 {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Phone number is required"})
		return
	}

	status, err := h.db.SubmitVouchByToken(r.Context(), strings.TrimSpace(req.Token), db.VouchSubmission{
		Name:      req.Name,
		BrandName: req.BrandName,
		Email:     req.Email,
		Phone:     phoneDigits,
		Source:    "public_link",
	})
	if err != nil {
		switch {
		case errors.Is(err, db.ErrVouchLinkNotFound):
			writeJSON(w, http.StatusNotFound, vouchStatusResponse{Success: false, Message: "This vouch link is invalid or inactive"})
		case errors.Is(err, db.ErrVouchPhoneExists):
			writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "This phone number already vouched for this vendor"})
		case errors.Is(err, db.ErrSelfVouchNotAllowed):
			writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Self vouch is not allowed"})
		default:
			writeJSON(w, http.StatusInternalServerError, vouchStatusResponse{Success: false, Message: "Could not submit vouch"})
		}
		return
	}
	writeJSON(w, http.StatusOK, toVouchStatusResponse(h.cfg.FrontendBaseURL, status, "Thanks! Your vouch is recorded"))
}

func (h *OTPHandler) AddDevVouches(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if strings.EqualFold(h.cfg.AppEnv, "production") {
		writeJSON(w, http.StatusForbidden, vouchStatusResponse{Success: false, Message: "Dev endpoint disabled in production"})
		return
	}
	if strings.TrimSpace(h.cfg.DevFileAccessKey) == "" {
		writeJSON(w, http.StatusForbidden, vouchStatusResponse{Success: false, Message: "Dev endpoint is not configured"})
		return
	}
	if r.Header.Get("X-DEV-KEY") != h.cfg.DevFileAccessKey {
		writeJSON(w, http.StatusUnauthorized, vouchStatusResponse{Success: false, Message: "Invalid dev access key"})
		return
	}

	var req devVouchAddRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Phone is required"})
		return
	}
	if req.Count <= 0 {
		req.Count = 1
	}
	status, err := h.db.AddDevVouchesByPhone(r.Context(), phone, req.Count)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, vouchStatusResponse{Success: false, Message: "Could not add dev vouches"})
		return
	}
	writeJSON(w, http.StatusOK, toVouchStatusResponse(h.cfg.FrontendBaseURL, status, "Dev vouches added"))
}

// SetDevVouchReviewDecision is for local/dev only (X-DEV-KEY). Production reviews use POST /api/admin/vouch/review with admin JWT.
func (h *OTPHandler) SetDevVouchReviewDecision(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if strings.EqualFold(h.cfg.AppEnv, "production") {
		writeJSON(w, http.StatusForbidden, vouchStatusResponse{Success: false, Message: "Dev endpoint disabled in production"})
		return
	}
	if strings.TrimSpace(h.cfg.DevFileAccessKey) == "" {
		writeJSON(w, http.StatusForbidden, vouchStatusResponse{Success: false, Message: "Dev endpoint is not configured"})
		return
	}
	if r.Header.Get("X-DEV-KEY") != h.cfg.DevFileAccessKey {
		writeJSON(w, http.StatusUnauthorized, vouchStatusResponse{Success: false, Message: "Invalid dev access key"})
		return
	}

	var req devReviewDecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Phone is required"})
		return
	}

	status, err := h.db.SetVouchReviewDecisionByPhone(r.Context(), phone, req.Decision, 90)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Could not set review decision"})
		return
	}
	writeJSON(w, http.StatusOK, toVouchStatusResponse(h.cfg.FrontendBaseURL, status, "Review decision updated"))
}

func (h *OTPHandler) ReapplyAfterRejection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req vouchReapplyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Phone is required"})
		return
	}

	status, err := h.db.ResetRejectedVouchForReapplyByPhone(r.Context(), phone)
	if err != nil {
		if errors.Is(err, db.ErrReapplyNotReady) {
			writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Reapply is available after the cooldown period"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, onboardingStatusResponse{Success: false, Message: "Could not reset reapply status"})
		return
	}

	writeJSON(w, http.StatusOK, onboardingStatusResponse{
		Success:           true,
		Message:           "Reapply started",
		NextStep:          string(status.NextStep),
		ProfileOK:         status.ProfileStatus == "completed",
		VerifyOK:          status.VerificationStatus == "completed",
		GetVouchOK:        status.GetVouchStatus == "completed",
		VouchReviewStatus: status.VouchReviewStatus,
		VouchReapplyAfter: status.VouchReapplyAfter,
	})
}

func (h *OTPHandler) EndDevRejectedCooldown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if strings.EqualFold(h.cfg.AppEnv, "production") {
		writeJSON(w, http.StatusForbidden, vouchStatusResponse{Success: false, Message: "Dev endpoint disabled in production"})
		return
	}
	if strings.TrimSpace(h.cfg.DevFileAccessKey) == "" {
		writeJSON(w, http.StatusForbidden, vouchStatusResponse{Success: false, Message: "Dev endpoint is not configured"})
		return
	}
	if r.Header.Get("X-DEV-KEY") != h.cfg.DevFileAccessKey {
		writeJSON(w, http.StatusUnauthorized, vouchStatusResponse{Success: false, Message: "Invalid dev access key"})
		return
	}

	var req devCooldownEndRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, vouchStatusResponse{Success: false, Message: "Phone is required"})
		return
	}

	status, err := h.db.FastForwardRejectedCooldownByPhone(r.Context(), phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, vouchStatusResponse{Success: false, Message: "Could not end cooldown"})
		return
	}
	writeJSON(w, http.StatusOK, toVouchStatusResponse(h.cfg.FrontendBaseURL, status, "Cooldown ended for testing"))
}

func toVouchStatusResponse(frontendBaseURL string, status *db.VouchStatus, message string) vouchStatusResponse {
	base := strings.TrimRight(frontendBaseURL, "/")
	shareURL := ""
	if status.ShareToken != "" {
		shareURL = base + "/vouch/" + status.ShareToken
	}

	progressText := strconv.Itoa(status.VouchCount) + "/" + strconv.Itoa(status.Target) + " Vouches received"
	return vouchStatusResponse{
		Success:      true,
		Message:      message,
		VouchCount:   status.VouchCount,
		Target:       status.Target,
		ShareToken:   status.ShareToken,
		ShareURL:     shareURL,
		StepStatus:   status.StepStatus,
		ReviewStatus: status.ReviewStatus,
		ProgressText: progressText,
		VendorName:   status.VendorName,
		ReapplyAfter: formatTime(status.ReapplyAfter),
	}
}

func formatTime(v *time.Time) string {
	if v == nil {
		return ""
	}
	return v.UTC().Format(time.RFC3339)
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, ch := range s {
		if ch >= '0' && ch <= '9' {
			b.WriteRune(ch)
		}
	}
	return b.String()
}
