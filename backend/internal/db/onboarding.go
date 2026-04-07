package db

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

var ErrVerificationFilesRequired = errors.New("aadhaar and pan files are required")

type StepStatus string

const (
	StepPending   StepStatus = "pending"
	StepCompleted StepStatus = "completed"
)

type NextStep string

const (
	NextStepProfile             NextStep = "profile"
	NextStepVerification        NextStep = "verification"
	NextStepGetVouch            NextStep = "get_vouch"
	NextStepVouchRejected       NextStep = "vouch_rejected"
	NextStepVerificationReapply NextStep = "verification_reapply"
	NextStepDone                NextStep = "done"
)

type ProfileStepData struct {
	FullName               string   `json:"fullName" db:"full_name"`
	Email                  string   `json:"email" db:"email"`
	PrimarySellingCategory string   `json:"primarySellingCategory" db:"primary_selling_category"`
	OtherCategories        []string `json:"otherCategories" db:"-"`
	City                   string   `json:"city" db:"city"`
	State                  string   `json:"state" db:"state"`
	FullAddress            string   `json:"fullAddress" db:"full_address"`
	Pincode                string   `json:"pincode" db:"pincode"`
	GSTRegistered          bool     `json:"gstRegistered" db:"gst_registered"`
	GSTNumber              string   `json:"gstNumber" db:"gst_number"`
	RegisteredFirmName     string   `json:"registeredFirmName" db:"registered_firm_name"`
}

type profileStepRow struct {
	FullName               string         `db:"full_name"`
	Email                  string         `db:"email"`
	PrimarySellingCategory string         `db:"primary_selling_category"`
	OtherCategoriesRaw     sql.NullString `db:"other_categories"`
	City                   string         `db:"city"`
	State                  string         `db:"state"`
	FullAddress            string         `db:"full_address"`
	Pincode                string         `db:"pincode"`
	GSTRegistered          bool           `db:"gst_registered"`
	GSTNumber              string         `db:"gst_number"`
	RegisteredFirmName     string         `db:"registered_firm_name"`
}

type OnboardingStatus struct {
	NextStep           NextStep   `json:"nextStep"`
	ProfileStatus      string     `json:"profileStatus"`
	VerificationStatus string     `json:"verificationStatus"`
	GetVouchStatus     string     `json:"getVouchStatus"`
	VouchReviewStatus  string     `json:"vouchReviewStatus"`
	VouchReapplyAfter  *time.Time `json:"vouchReapplyAfter,omitempty"`
}

type VerificationStepData struct {
	AadhaarDocuments []VerificationFileEntry `json:"aadhaarDocuments"`
	PanDocuments     []VerificationFileEntry `json:"panDocuments"`
	AadhaarFileURL   string                  `json:"aadhaarFileUrl"`
	AadhaarFileName  string                  `json:"aadhaarFileName"`
	AadhaarFileMIME  string                  `json:"aadhaarFileMime"`
	AadhaarFileSize  int64                   `json:"aadhaarFileSize"`
	PANFileURL       string                  `json:"panFileUrl"`
	PANFileName      string                  `json:"panFileName"`
	PANFileMIME      string                  `json:"panFileMime"`
	PANFileSize      int64                   `json:"panFileSize"`
	StepStatus       string                  `json:"stepStatus"`
}

type verificationStepRow struct {
	AadhaarDocumentsRaw []byte `db:"aadhaar_documents"`
	PanDocumentsRaw     []byte `db:"pan_documents"`
	AadhaarFileURL      string `db:"aadhaar_file_url"`
	AadhaarFileName     string `db:"aadhaar_file_name"`
	AadhaarFileMIME     string `db:"aadhaar_file_mime"`
	AadhaarFileSize     int64  `db:"aadhaar_file_size"`
	PANFileURL          string `db:"pan_file_url"`
	PANFileName         string `db:"pan_file_name"`
	PANFileMIME         string `db:"pan_file_mime"`
	PANFileSize         int64  `db:"pan_file_size"`
	StepStatus          string `db:"step_status"`
}

func verificationStepDataFromRow(row verificationStepRow) (VerificationStepData, error) {
	aadhaarDocs, err := parseVerificationDocsJSON(row.AadhaarDocumentsRaw)
	if err != nil {
		return VerificationStepData{}, err
	}
	panDocs, err := parseVerificationDocsJSON(row.PanDocumentsRaw)
	if err != nil {
		return VerificationStepData{}, err
	}
	aadhaarDocs = mergeLegacySingleDoc(aadhaarDocs, row.AadhaarFileURL, row.AadhaarFileName, row.AadhaarFileMIME, row.AadhaarFileSize)
	panDocs = mergeLegacySingleDoc(panDocs, row.PANFileURL, row.PANFileName, row.PANFileMIME, row.PANFileSize)
	if aadhaarDocs == nil {
		aadhaarDocs = []VerificationFileEntry{}
	}
	if panDocs == nil {
		panDocs = []VerificationFileEntry{}
	}
	u1, n1, m1, s1 := firstDocLegacyFields(aadhaarDocs)
	u2, n2, m2, s2 := firstDocLegacyFields(panDocs)
	return VerificationStepData{
		AadhaarDocuments: aadhaarDocs,
		PanDocuments:     panDocs,
		AadhaarFileURL:   u1,
		AadhaarFileName:  n1,
		AadhaarFileMIME:  m1,
		AadhaarFileSize:  s1,
		PANFileURL:       u2,
		PANFileName:      n2,
		PANFileMIME:      m2,
		PANFileSize:      s2,
		StepStatus:       row.StepStatus,
	}, nil
}

func (d *DB) ensureStepRows(ctx context.Context, vendorUserID int64) error {
	now := time.Now()
	_, err := d.db.ExecContext(ctx, `
		INSERT INTO vendor_profile_step
			(vendor_user_id, step_status, created_at, updated_at)
		VALUES
			($1, $2, $3, $3)
		ON CONFLICT (vendor_user_id) DO NOTHING
	`, vendorUserID, StepPending, now)
	if err != nil {
		return err
	}

	_, err = d.db.ExecContext(ctx, `
		INSERT INTO vendor_verification_step
			(vendor_user_id, step_status, created_at, updated_at)
		VALUES
			($1, $2, $3, $3)
		ON CONFLICT (vendor_user_id) DO NOTHING
	`, vendorUserID, StepPending, now)
	if err != nil {
		return err
	}

	_, err = d.db.ExecContext(ctx, `
		INSERT INTO vendor_vouch_step
			(vendor_user_id, step_status, created_at, updated_at)
		VALUES
			($1, $2, $3, $3)
		ON CONFLICT (vendor_user_id) DO NOTHING
	`, vendorUserID, StepPending, now)
	return err
}

func (d *DB) getStatusByUserID(ctx context.Context, vendorUserID int64) (*OnboardingStatus, error) {
	var profileStatus, verificationStatus, vouchStatus, vouchReviewStatus string
	var adminKycDecision sql.NullString
	var reapplyAfter sql.NullTime

	if err := d.db.GetContext(ctx, &profileStatus, `SELECT step_status FROM vendor_profile_step WHERE vendor_user_id = $1`, vendorUserID); err != nil {
		return nil, err
	}
	if err := d.db.GetContext(ctx, &verificationStatus, `SELECT step_status FROM vendor_verification_step WHERE vendor_user_id = $1`, vendorUserID); err != nil {
		return nil, err
	}
	if err := d.db.GetContext(ctx, &adminKycDecision, `SELECT admin_kyc_decision FROM vendor_verification_step WHERE vendor_user_id = $1`, vendorUserID); err != nil {
		return nil, err
	}
	if err := d.db.GetContext(ctx, &vouchStatus, `SELECT step_status FROM vendor_vouch_step WHERE vendor_user_id = $1`, vendorUserID); err != nil {
		return nil, err
	}
	if err := d.db.QueryRowContext(ctx, `
		SELECT review_status, reapply_after
		FROM vendor_vouch_step
		WHERE vendor_user_id = $1
	`, vendorUserID).Scan(&vouchReviewStatus, &reapplyAfter); err != nil {
		return nil, err
	}

	nextStep := NextStepProfile
	kycDecision := strings.TrimSpace(strings.ToLower(adminKycDecision.String))
	switch {
	case profileStatus != string(StepCompleted):
		nextStep = NextStepProfile
	case verificationStatus != string(StepCompleted):
		nextStep = NextStepVerification
	case kycDecision == "needs_resubmit":
		nextStep = NextStepVerification
	case vouchStatus != string(StepCompleted):
		nextStep = NextStepGetVouch
	case vouchReviewStatus == "approved":
		nextStep = NextStepDone
	case vouchReviewStatus == "rejected":
		if reapplyAfter.Valid && time.Now().Before(reapplyAfter.Time) {
			nextStep = NextStepVouchRejected
		} else {
			nextStep = NextStepVerificationReapply
		}
	default:
		nextStep = NextStepGetVouch
	}

	var reapplyAfterPtr *time.Time
	if reapplyAfter.Valid {
		reapplyAfterPtr = &reapplyAfter.Time
	}

	return &OnboardingStatus{
		NextStep:           nextStep,
		ProfileStatus:      profileStatus,
		VerificationStatus: verificationStatus,
		GetVouchStatus:     vouchStatus,
		VouchReviewStatus:  vouchReviewStatus,
		VouchReapplyAfter:  reapplyAfterPtr,
	}, nil
}

func (d *DB) GetOnboardingStatusByPhone(ctx context.Context, phone string) (*OnboardingStatus, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}
	return d.getStatusByUserID(ctx, user.ID)
}

func (d *DB) SaveProfileStep(ctx context.Context, phone string, profile ProfileStepData) (*OnboardingStatus, error) {
	user, err := d.CreateUser(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}

	otherNormalized := NormalizeOtherCategoriesForSave(profile.OtherCategories, profile.PrimarySellingCategory)
	otherJSON := EncodeOtherCategoriesForDB(otherNormalized)

	now := time.Now()
	_, err = d.db.ExecContext(ctx, `
		UPDATE vendor_profile_step SET
			full_name = $2,
			email = $3,
			primary_selling_category = $4,
			other_categories = $5,
			city = $6,
			state = $7,
			full_address = $8,
			pincode = $9,
			gst_registered = $10,
			gst_number = $11,
			registered_firm_name = $12,
			step_status = $13,
			completed_at = $14,
			updated_at = $14
		WHERE vendor_user_id = $1
	`, user.ID, profile.FullName, profile.Email, profile.PrimarySellingCategory, otherJSON, profile.City, profile.State, profile.FullAddress, profile.Pincode, profile.GSTRegistered, profile.GSTNumber, profile.RegisteredFirmName, StepCompleted, now)
	if err != nil {
		return nil, err
	}

	return d.getStatusByUserID(ctx, user.ID)
}

func (d *DB) GetProfileStepByPhone(ctx context.Context, phone string) (*ProfileStepData, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// User not in DB yet (e.g. session from different flow). Lazy-create so profile fetch succeeds.
			user, err = d.CreateUser(ctx, phone)
			if err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}

	var row profileStepRow
	err = d.db.GetContext(ctx, &row, `
		SELECT
			full_name,
			email,
			primary_selling_category,
			other_categories,
			city,
			state,
			full_address,
			pincode,
			gst_registered,
			gst_number,
			registered_firm_name
		FROM vendor_profile_step
		WHERE vendor_user_id = $1
	`, user.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return &ProfileStepData{}, nil
	}
	if err != nil {
		return nil, err
	}
	raw := ""
	if row.OtherCategoriesRaw.Valid {
		raw = row.OtherCategoriesRaw.String
	}
	extras := DecodeOtherCategoriesStored(raw)
	extras = NormalizeOtherCategoriesForSave(extras, row.PrimarySellingCategory)
	if extras == nil {
		extras = []string{}
	}
	out := ProfileStepData{
		FullName:               row.FullName,
		Email:                  row.Email,
		PrimarySellingCategory: row.PrimarySellingCategory,
		OtherCategories:        extras,
		City:                   row.City,
		State:                  row.State,
		FullAddress:            row.FullAddress,
		Pincode:                row.Pincode,
		GSTRegistered:          row.GSTRegistered,
		GSTNumber:              row.GSTNumber,
		RegisteredFirmName:     row.RegisteredFirmName,
	}
	return &out, nil
}

func (d *DB) GetVerificationStepByPhone(ctx context.Context, phone string) (*VerificationStepData, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}

	var row verificationStepRow
	err = d.db.GetContext(ctx, &row, `
		SELECT
			COALESCE(aadhaar_documents, '[]'::jsonb) AS aadhaar_documents,
			COALESCE(pan_documents, '[]'::jsonb) AS pan_documents,
			aadhaar_file_url,
			aadhaar_file_name,
			aadhaar_file_mime,
			aadhaar_file_size,
			pan_file_url,
			pan_file_name,
			pan_file_mime,
			pan_file_size,
			step_status
		FROM vendor_verification_step
		WHERE vendor_user_id = $1
	`, user.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return &VerificationStepData{}, nil
	}
	if err != nil {
		return nil, err
	}
	// sqlx may return jsonb as []byte directly; normalize
	if len(row.AadhaarDocumentsRaw) == 0 {
		row.AadhaarDocumentsRaw = []byte("[]")
	}
	if len(row.PanDocumentsRaw) == 0 {
		row.PanDocumentsRaw = []byte("[]")
	}
	out, err := verificationStepDataFromRow(row)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// SaveVerificationDocumentSlots replaces all files for docType ("aadhaar" or "pan") with entries (max MaxKYCFilesPerDocType).
func (d *DB) SaveVerificationDocumentSlots(
	ctx context.Context,
	phone string,
	docType string,
	entries []VerificationFileEntry,
) (*VerificationStepData, error) {
	user, err := d.CreateUser(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}
	entries = trimVerificationDocs(entries)
	jsonBytes, err := marshalVerificationDocsJSON(entries)
	if err != nil {
		return nil, err
	}
	legURL, legName, legMIME, legSize := firstDocLegacyFields(entries)

	now := time.Now()
	switch docType {
	case "aadhaar":
		_, err = d.db.ExecContext(ctx, `
			UPDATE vendor_verification_step SET
				aadhaar_documents = $2::jsonb,
				aadhaar_file_url = $3,
				aadhaar_file_name = $4,
				aadhaar_file_mime = $5,
				aadhaar_file_size = $6,
				updated_at = $7
			WHERE vendor_user_id = $1
		`, user.ID, string(jsonBytes), legURL, legName, legMIME, legSize, now)
	case "pan":
		_, err = d.db.ExecContext(ctx, `
			UPDATE vendor_verification_step SET
				pan_documents = $2::jsonb,
				pan_file_url = $3,
				pan_file_name = $4,
				pan_file_mime = $5,
				pan_file_size = $6,
				updated_at = $7
			WHERE vendor_user_id = $1
		`, user.ID, string(jsonBytes), legURL, legName, legMIME, legSize, now)
	default:
		return nil, errors.New("invalid document type")
	}
	if err != nil {
		return nil, err
	}
	return d.GetVerificationStepByPhone(ctx, phone)
}

// RemoveVerificationDocAt removes one uploaded file by index (0-based) for docType.
func (d *DB) RemoveVerificationDocAt(ctx context.Context, phone string, docType string, index int) (*VerificationStepData, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}
	data, err := d.GetVerificationStepByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	var docs []VerificationFileEntry
	switch docType {
	case "aadhaar":
		docs = append([]VerificationFileEntry(nil), data.AadhaarDocuments...)
	case "pan":
		docs = append([]VerificationFileEntry(nil), data.PanDocuments...)
	default:
		return nil, errors.New("invalid document type")
	}
	if index < 0 || index >= len(docs) {
		return nil, errors.New("invalid file index")
	}
	docs = append(docs[:index], docs[index+1:]...)
	return d.SaveVerificationDocumentSlots(ctx, phone, docType, docs)
}

func (d *DB) SubmitVerificationStep(ctx context.Context, phone string) (*OnboardingStatus, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}

	step, err := d.GetVerificationStepByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if len(step.AadhaarDocuments) < 1 || len(step.PanDocuments) < 1 {
		return nil, ErrVerificationFilesRequired
	}

	now := time.Now()
	_, err = d.db.ExecContext(ctx, `
		UPDATE vendor_verification_step SET
			step_status = $2,
			submitted_at = $3,
			completed_at = $3,
			updated_at = $3
		WHERE vendor_user_id = $1
	`, user.ID, StepCompleted, now)
	if err != nil {
		return nil, err
	}
	return d.getStatusByUserID(ctx, user.ID)
}
