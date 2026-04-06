package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"vendor-api/internal/db"
	"vendor-api/internal/storage"
)

type onboardingStatusResponse struct {
	Success           bool       `json:"success"`
	Message           string     `json:"message"`
	NextStep          string     `json:"nextStep,omitempty"`
	ProfileOK         bool       `json:"profileCompleted,omitempty"`
	VerifyOK          bool       `json:"verificationCompleted,omitempty"`
	GetVouchOK        bool       `json:"getVouchCompleted,omitempty"`
	VouchReviewStatus string     `json:"vouchReviewStatus,omitempty"`
	VouchReapplyAfter *time.Time `json:"vouchReapplyAfter,omitempty"`
}

func (h *OTPHandler) GetOnboardingStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	phone := normalizePhone(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Phone is required"})
		return
	}

	status, err := h.db.GetOnboardingStatusByPhone(r.Context(), phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, onboardingStatusResponse{Success: false, Message: "Could not load status"})
		return
	}

	writeJSON(w, http.StatusOK, onboardingStatusResponse{
		Success:           true,
		Message:           "Status loaded",
		NextStep:          string(status.NextStep),
		ProfileOK:         status.ProfileStatus == "completed",
		VerifyOK:          status.VerificationStatus == "completed",
		GetVouchOK:        status.GetVouchStatus == "completed",
		VouchReviewStatus: status.VouchReviewStatus,
		VouchReapplyAfter: status.VouchReapplyAfter,
	})
}

type saveProfileRequest struct {
	Phone                  string          `json:"phone"`
	FullName               string          `json:"fullName"`
	Email                  string          `json:"email"`
	PrimarySellingCategory string          `json:"primarySellingCategory"`
	OtherCategories        json.RawMessage `json:"otherCategories"`
	City                   string          `json:"city"`
	State                  string          `json:"state"`
	FullAddress            string          `json:"fullAddress"`
	Pincode                string          `json:"pincode"`
	GSTRegistered          bool            `json:"gstRegistered"`
	GSTNumber              string          `json:"gstNumber"`
	RegisteredFirmName     string          `json:"registeredFirmName"`
}

func parseOtherCategoriesFromRequest(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil {
		return arr
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return db.DecodeOtherCategoriesStored(s)
	}
	return nil
}

type profileResponse struct {
	Success bool               `json:"success"`
	Message string             `json:"message"`
	Profile db.ProfileStepData `json:"profile"`
}

type verificationResponse struct {
	Success      bool                    `json:"success"`
	Message      string                  `json:"message"`
	Verification db.VerificationStepData `json:"verification"`
}

type verificationFileURLResponse struct {
	Success          bool   `json:"success"`
	Message          string `json:"message"`
	URL              string `json:"url,omitempty"`
	ExpiresInSeconds int    `json:"expiresInSeconds,omitempty"`
}

func (h *OTPHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	phone := normalizePhone(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, profileResponse{Success: false, Message: "Phone is required"})
		return
	}

	profile, err := h.db.GetProfileStepByPhone(r.Context(), phone)
	if err != nil {
		log.Printf("[profile] GetProfileStepByPhone error: %v", err)
		writeJSON(w, http.StatusInternalServerError, profileResponse{Success: false, Message: "Could not load profile", Profile: db.ProfileStepData{}})
		return
	}

	writeJSON(w, http.StatusOK, profileResponse{
		Success: true,
		Message: "Profile loaded",
		Profile: *profile,
	})
}

func (h *OTPHandler) SaveProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req saveProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Invalid request"})
		return
	}

	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Phone is required"})
		return
	}

	primaryCat := strings.TrimSpace(req.PrimarySellingCategory)
	if strings.TrimSpace(req.FullName) == "" ||
		strings.TrimSpace(req.Email) == "" ||
		primaryCat == "" ||
		strings.TrimSpace(req.City) == "" ||
		strings.TrimSpace(req.State) == "" ||
		strings.TrimSpace(req.FullAddress) == "" ||
		strings.TrimSpace(req.Pincode) == "" {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Please fill all required profile fields"})
		return
	}
	if !db.IsAllowedProfileLabel(primaryCat) {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Invalid primary selling category"})
		return
	}

	if req.GSTRegistered && (strings.TrimSpace(req.GSTNumber) == "" || strings.TrimSpace(req.RegisteredFirmName) == "") {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Please fill GST Number and Registered Firm Name"})
		return
	}

	status, err := h.db.SaveProfileStep(r.Context(), phone, db.ProfileStepData{
		FullName:               strings.TrimSpace(req.FullName),
		Email:                  strings.TrimSpace(req.Email),
		PrimarySellingCategory: primaryCat,
		OtherCategories:        parseOtherCategoriesFromRequest(req.OtherCategories),
		City:                   strings.TrimSpace(req.City),
		State:                  strings.TrimSpace(req.State),
		FullAddress:            strings.TrimSpace(req.FullAddress),
		Pincode:                strings.TrimSpace(req.Pincode),
		GSTRegistered:          req.GSTRegistered,
		GSTNumber:              strings.TrimSpace(req.GSTNumber),
		RegisteredFirmName:     strings.TrimSpace(req.RegisteredFirmName),
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, onboardingStatusResponse{Success: false, Message: "Could not save profile"})
		return
	}

	writeJSON(w, http.StatusOK, onboardingStatusResponse{
		Success:           true,
		Message:           "Profile saved",
		NextStep:          string(status.NextStep),
		ProfileOK:         status.ProfileStatus == "completed",
		VerifyOK:          status.VerificationStatus == "completed",
		GetVouchOK:        status.GetVouchStatus == "completed",
		VouchReviewStatus: status.VouchReviewStatus,
		VouchReapplyAfter: status.VouchReapplyAfter,
	})
}

func (h *OTPHandler) GetVerification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	phone := normalizePhone(r.URL.Query().Get("phone"))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "Phone is required"})
		return
	}

	verification, err := h.db.GetVerificationStepByPhone(r.Context(), phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, verificationResponse{Success: false, Message: "Could not load verification"})
		return
	}
	writeJSON(w, http.StatusOK, verificationResponse{
		Success:      true,
		Message:      "Verification loaded",
		Verification: *verification,
	})
}

func verificationMultipartFileHeaders(r *http.Request) []*multipart.FileHeader {
	if r.MultipartForm == nil {
		return nil
	}
	if fs := r.MultipartForm.File["files"]; len(fs) > 0 {
		return fs
	}
	return r.MultipartForm.File["file"]
}

func (h *OTPHandler) uploadOneKYCPart(ctx context.Context, docType string, header *multipart.FileHeader) (db.VerificationFileEntry, error) {
	var zero db.VerificationFileEntry
	if header.Size > 5*1024*1024 {
		return zero, errors.New("file size must be <= 5MB")
	}
	file, err := header.Open()
	if err != nil {
		return zero, err
	}
	defer file.Close()

	buffer := make([]byte, 512)
	n, _ := file.Read(buffer)
	if _, err := file.Seek(0, 0); err != nil {
		return zero, err
	}
	mimeType := http.DetectContentType(buffer[:n])
	if !isAllowedDocumentMime(mimeType) {
		return zero, errors.New("only JPG, PNG, PDF allowed")
	}

	content, err := io.ReadAll(io.LimitReader(file, 5*1024*1024+1))
	if err != nil {
		return zero, err
	}
	if len(content) > 5*1024*1024 {
		return zero, errors.New("file size must be <= 5MB")
	}

	ext := safeExtFromNameOrMime(header.Filename, mimeType)
	objectKey := generateUploadName(docType) + ext
	fileURL, err := h.storage.Upload(ctx, objectKey, content, mimeType)
	if err != nil {
		return zero, err
	}
	return db.VerificationFileEntry{
		URL:      fileURL,
		FileName: header.Filename,
		MIME:     mimeType,
		Size:     header.Size,
	}, nil
}

func (h *OTPHandler) UploadVerificationFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(12 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "Invalid upload payload"})
		return
	}

	phone := normalizePhone(r.FormValue("phone"))
	docType := strings.TrimSpace(strings.ToLower(r.FormValue("docType")))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "Phone is required"})
		return
	}
	if docType != "aadhaar" && docType != "pan" {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "docType must be aadhaar or pan"})
		return
	}

	headers := verificationMultipartFileHeaders(r)
	if len(headers) == 0 {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "At least one file is required"})
		return
	}
	if len(headers) > db.MaxKYCFilesPerDocType {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "At most 2 files per document type"})
		return
	}

	var entries []db.VerificationFileEntry
	for _, header := range headers {
		entry, err := h.uploadOneKYCPart(r.Context(), docType, header)
		if err != nil {
			msg := err.Error()
			if strings.Contains(msg, "5MB") {
				writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "Each file must be 5MB or smaller"})
				return
			}
			if strings.Contains(msg, "JPG") {
				writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "Only JPG, PNG or PDF files are allowed"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, verificationResponse{Success: false, Message: "Could not process upload"})
			return
		}
		entries = append(entries, entry)
	}

	verification, err := h.db.SaveVerificationDocumentSlots(r.Context(), phone, docType, entries)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, verificationResponse{Success: false, Message: "Could not save verification file"})
		return
	}
	writeJSON(w, http.StatusOK, verificationResponse{
		Success:      true,
		Message:      "File uploaded",
		Verification: *verification,
	})
}

type removeVerificationDocRequest struct {
	Phone   string `json:"phone"`
	DocType string `json:"docType"`
	Index   int    `json:"index"`
}

func (h *OTPHandler) RemoveVerificationDoc(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req removeVerificationDocRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "Invalid request"})
		return
	}
	phone := normalizePhone(req.Phone)
	docType := strings.TrimSpace(strings.ToLower(req.DocType))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "Phone is required"})
		return
	}
	if docType != "aadhaar" && docType != "pan" {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "docType must be aadhaar or pan"})
		return
	}
	verification, err := h.db.RemoveVerificationDocAt(r.Context(), phone, docType, req.Index)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, verificationResponse{Success: false, Message: "Could not remove file"})
		return
	}
	writeJSON(w, http.StatusOK, verificationResponse{
		Success:      true,
		Message:      "Removed",
		Verification: *verification,
	})
}

type submitVerificationRequest struct {
	Phone string `json:"phone"`
}

func (h *OTPHandler) SubmitVerification(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req submitVerificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Invalid request"})
		return
	}

	phone := normalizePhone(req.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: "Phone is required"})
		return
	}

	status, err := h.db.SubmitVerificationStep(r.Context(), phone)
	if err != nil {
		msg := "Could not submit verification"
		if errors.Is(err, db.ErrVerificationFilesRequired) {
			msg = "Please upload at least one Aadhaar file and one PAN file"
		}
		writeJSON(w, http.StatusBadRequest, onboardingStatusResponse{Success: false, Message: msg})
		return
	}

	writeJSON(w, http.StatusOK, onboardingStatusResponse{
		Success:           true,
		Message:           "Verification submitted",
		NextStep:          string(status.NextStep),
		ProfileOK:         status.ProfileStatus == "completed",
		VerifyOK:          status.VerificationStatus == "completed",
		GetVouchOK:        status.GetVouchStatus == "completed",
		VouchReviewStatus: status.VouchReviewStatus,
		VouchReapplyAfter: status.VouchReapplyAfter,
	})
}

func (h *OTPHandler) GetVerificationFileURLDev(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if strings.EqualFold(h.cfg.AppEnv, "production") {
		writeJSON(w, http.StatusForbidden, verificationFileURLResponse{Success: false, Message: "Dev file endpoint disabled in production"})
		return
	}
	if strings.TrimSpace(h.cfg.DevFileAccessKey) == "" {
		writeJSON(w, http.StatusForbidden, verificationFileURLResponse{Success: false, Message: "Dev file endpoint is not configured"})
		return
	}
	if r.Header.Get("X-DEV-KEY") != h.cfg.DevFileAccessKey {
		writeJSON(w, http.StatusUnauthorized, verificationFileURLResponse{Success: false, Message: "Invalid dev access key"})
		return
	}

	phone := normalizePhone(r.URL.Query().Get("phone"))
	docType := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("docType")))
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, verificationFileURLResponse{Success: false, Message: "Phone is required"})
		return
	}
	if docType != "aadhaar" && docType != "pan" {
		writeJSON(w, http.StatusBadRequest, verificationFileURLResponse{Success: false, Message: "docType must be aadhaar or pan"})
		return
	}

	verification, err := h.db.GetVerificationStepByPhone(r.Context(), phone)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, verificationFileURLResponse{Success: false, Message: "Could not load verification"})
		return
	}

	idx := 0
	if s := strings.TrimSpace(r.URL.Query().Get("index")); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v >= 0 {
			idx = v
		}
	}
	var refs []string
	if docType == "aadhaar" {
		for _, e := range verification.AadhaarDocuments {
			if strings.TrimSpace(e.URL) != "" {
				refs = append(refs, strings.TrimSpace(e.URL))
			}
		}
	} else {
		for _, e := range verification.PanDocuments {
			if strings.TrimSpace(e.URL) != "" {
				refs = append(refs, strings.TrimSpace(e.URL))
			}
		}
	}
	if idx < 0 || idx >= len(refs) {
		writeJSON(w, http.StatusNotFound, verificationFileURLResponse{Success: false, Message: "File not uploaded yet"})
		return
	}
	storedRef := refs[idx]

	url, err := h.storage.PresignGetURL(r.Context(), storedRef, 5*time.Minute)
	if err != nil {
		if storage.IsInvalidStoredRef(err) {
			writeJSON(w, http.StatusBadRequest, verificationFileURLResponse{Success: false, Message: "Stored file reference is invalid"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, verificationFileURLResponse{Success: false, Message: "Could not generate file URL"})
		return
	}

	writeJSON(w, http.StatusOK, verificationFileURLResponse{
		Success:          true,
		Message:          "URL generated",
		URL:              url,
		ExpiresInSeconds: 300,
	})
}

func generateUploadName(docType string) string {
	rb := make([]byte, 6)
	_, _ = rand.Read(rb)
	return "vendor_" + docType + "_" + time.Now().Format("20060102150405") + "_" + hex.EncodeToString(rb)
}

func isAllowedDocumentMime(mimeType string) bool {
	switch mimeType {
	case "image/jpeg", "image/jpg", "image/png", "application/pdf":
		return true
	default:
		return false
	}
}

func safeExtFromNameOrMime(fileName string, mimeType string) string {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".pdf":
		return ext
	}
	switch mimeType {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "application/pdf":
		return ".pdf"
	default:
		return ".bin"
	}
}
