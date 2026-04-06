package db

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/lib/pq"
)

const VouchTarget = 30

var (
	ErrVouchLinkNotFound   = errors.New("vouch link not found")
	ErrVouchPhoneExists    = errors.New("voucher phone already used for this vendor")
	ErrSelfVouchNotAllowed = errors.New("self vouch is not allowed")
	ErrReapplyNotReady     = errors.New("reapply is not ready")
)

type VouchStatus struct {
	StepStatus   string     `json:"stepStatus"`
	ReviewStatus string     `json:"reviewStatus"`
	VouchCount   int        `json:"vouchCount"`
	Target       int        `json:"target"`
	ShareToken   string     `json:"shareToken"`
	VendorName   string     `json:"vendorName"`
	VendorUserID int64      `json:"vendorUserId"`
	ReapplyAfter *time.Time `json:"reapplyAfter,omitempty"`
}

type VouchSubmission struct {
	Name      string
	BrandName string
	Email     string
	Phone     string
	Source    string
}

func (d *DB) GetVouchStatusByPhone(ctx context.Context, phone string) (*VouchStatus, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}
	return d.getVouchStatusByUserID(ctx, user.ID)
}

func (d *DB) GetVouchStatusByToken(ctx context.Context, token string) (*VouchStatus, error) {
	var vendorUserID int64
	err := d.db.GetContext(ctx, &vendorUserID, `
		SELECT vendor_user_id
		FROM vendor_vouch_links
		WHERE share_token = $1 AND is_active = TRUE
	`, token)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrVouchLinkNotFound
	}
	if err != nil {
		return nil, err
	}
	return d.getVouchStatusByUserID(ctx, vendorUserID)
}

func (d *DB) EnsureVouchShareTokenByPhone(ctx context.Context, phone string) (string, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return "", err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return "", err
	}
	return d.ensureVouchShareToken(ctx, user.ID)
}

func (d *DB) SubmitVouchByToken(ctx context.Context, token string, entry VouchSubmission) (*VouchStatus, error) {
	var vendorUserID int64
	var vendorPhone string
	err := d.db.QueryRowContext(ctx, `
		SELECT vu.id, vu.phone
		FROM vendor_vouch_links vvl
		INNER JOIN vendor_users vu ON vu.id = vvl.vendor_user_id
		WHERE vvl.share_token = $1 AND vvl.is_active = TRUE
	`, token).Scan(&vendorUserID, &vendorPhone)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrVouchLinkNotFound
	}
	if err != nil {
		return nil, err
	}

	if normalizeDigits(entry.Phone) == normalizeDigits(vendorPhone) {
		return nil, ErrSelfVouchNotAllowed
	}

	if entry.Source == "" {
		entry.Source = "public_link"
	}

	_, err = d.db.ExecContext(ctx, `
		INSERT INTO vendor_vouch_entries
			(vendor_user_id, voucher_name, voucher_brand_name, voucher_email, voucher_phone, source, created_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7)
	`, vendorUserID, strings.TrimSpace(entry.Name), strings.TrimSpace(entry.BrandName), strings.TrimSpace(entry.Email), normalizeDigits(entry.Phone), entry.Source, time.Now())
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return nil, ErrVouchPhoneExists
		}
		return nil, err
	}

	if err := d.applyVouchStepStatus(ctx, vendorUserID); err != nil {
		return nil, err
	}
	return d.getVouchStatusByUserID(ctx, vendorUserID)
}

func (d *DB) AddDevVouchesByPhone(ctx context.Context, phone string, count int) (*VouchStatus, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}
	if count < 1 {
		count = 1
	}
	for i := 0; i < count; i++ {
		phoneSuffix := generateHex(5)
		voucherPhone := "91999" + phoneSuffix
		_, _ = d.db.ExecContext(ctx, `
			INSERT INTO vendor_vouch_entries
				(vendor_user_id, voucher_name, voucher_brand_name, voucher_email, voucher_phone, source, created_at)
			VALUES
				($1, $2, $3, $4, $5, $6, $7)
			ON CONFLICT (vendor_user_id, voucher_phone) DO NOTHING
		`, user.ID, "Dev Voucher "+generateHex(2), "Test Brand", "dev_"+generateHex(2)+"@mail.com", voucherPhone, "dev_seed", time.Now())
	}
	if err := d.applyVouchStepStatus(ctx, user.ID); err != nil {
		return nil, err
	}
	return d.getVouchStatusByUserID(ctx, user.ID)
}

func (d *DB) SetVouchReviewDecisionByPhone(ctx context.Context, phone string, decision string, cooldownDays int) (*VouchStatus, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}
	now := time.Now()
	switch strings.ToLower(strings.TrimSpace(decision)) {
	case "approve", "approved":
		_, err = d.db.ExecContext(ctx, `
			UPDATE vendor_vouch_step
			SET step_status = $2,
				review_status = 'approved',
				review_decided_at = $3,
				reapply_after = NULL,
				completed_at = COALESCE(completed_at, $3),
				updated_at = $3
			WHERE vendor_user_id = $1
		`, user.ID, StepCompleted, now)
	case "disapprove", "reject", "rejected":
		if cooldownDays <= 0 {
			cooldownDays = 90
		}
		reapplyAfter := now.AddDate(0, 0, cooldownDays)
		_, err = d.db.ExecContext(ctx, `
			UPDATE vendor_vouch_step
			SET step_status = $2,
				review_status = 'rejected',
				review_decided_at = $3,
				reapply_after = $4,
				completed_at = COALESCE(completed_at, $3),
				updated_at = $3
			WHERE vendor_user_id = $1
		`, user.ID, StepCompleted, now, reapplyAfter)
	default:
		return nil, errors.New("invalid decision")
	}
	if err != nil {
		return nil, err
	}
	return d.getVouchStatusByUserID(ctx, user.ID)
}

func (d *DB) ResetRejectedVouchForReapplyByPhone(ctx context.Context, phone string) (*OnboardingStatus, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}

	var reviewStatus string
	var reapplyAfter sql.NullTime
	err = d.db.QueryRowContext(ctx, `
		SELECT review_status, reapply_after
		FROM vendor_vouch_step
		WHERE vendor_user_id = $1
	`, user.ID).Scan(&reviewStatus, &reapplyAfter)
	if err != nil {
		return nil, err
	}
	if reviewStatus != "rejected" || (reapplyAfter.Valid && time.Now().Before(reapplyAfter.Time)) {
		return nil, ErrReapplyNotReady
	}

	now := time.Now()
	tx, err := d.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err = tx.ExecContext(ctx, `DELETE FROM vendor_vouch_entries WHERE vendor_user_id = $1`, user.ID); err != nil {
		return nil, err
	}

	if _, err = tx.ExecContext(ctx, `
		UPDATE vendor_verification_step SET
			step_status = $2,
			completed_at = NULL,
			submitted_at = NULL,
			aadhaar_file_url = '',
			aadhaar_file_name = '',
			aadhaar_file_mime = '',
			aadhaar_file_size = 0,
			pan_file_url = '',
			pan_file_name = '',
			pan_file_mime = '',
			pan_file_size = 0,
			updated_at = $3
		WHERE vendor_user_id = $1
	`, user.ID, StepPending, now); err != nil {
		return nil, err
	}

	if _, err = tx.ExecContext(ctx, `
		UPDATE vendor_vouch_step SET
			step_status = $2,
			review_status = 'pending',
			review_decided_at = NULL,
			reapply_after = NULL,
			completed_at = NULL,
			updated_at = $3
		WHERE vendor_user_id = $1
	`, user.ID, StepPending, now); err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}
	return d.getStatusByUserID(ctx, user.ID)
}

func (d *DB) FastForwardRejectedCooldownByPhone(ctx context.Context, phone string) (*VouchStatus, error) {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return nil, err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return nil, err
	}

	now := time.Now()
	_, err = d.db.ExecContext(ctx, `
		UPDATE vendor_vouch_step
		SET review_status = 'rejected',
			step_status = $2,
			review_decided_at = COALESCE(review_decided_at, $3),
			reapply_after = $4,
			completed_at = COALESCE(completed_at, $3),
			updated_at = $3
		WHERE vendor_user_id = $1
	`, user.ID, StepCompleted, now, now.Add(-1*time.Minute))
	if err != nil {
		return nil, err
	}
	return d.getVouchStatusByUserID(ctx, user.ID)
}

func (d *DB) getVouchStatusByUserID(ctx context.Context, vendorUserID int64) (*VouchStatus, error) {
	if _, err := d.ensureVouchShareToken(ctx, vendorUserID); err != nil {
		return nil, err
	}

	var out VouchStatus
	out.Target = VouchTarget
	out.VendorUserID = vendorUserID

	if err := d.db.GetContext(ctx, &out.VouchCount, `SELECT COUNT(1) FROM vendor_vouch_entries WHERE vendor_user_id = $1`, vendorUserID); err != nil {
		return nil, err
	}
	if err := d.db.GetContext(ctx, &out.StepStatus, `SELECT step_status FROM vendor_vouch_step WHERE vendor_user_id = $1`, vendorUserID); err != nil {
		return nil, err
	}
	var reapplyAfter sql.NullTime
	if err := d.db.QueryRowContext(ctx, `
		SELECT review_status, reapply_after
		FROM vendor_vouch_step
		WHERE vendor_user_id = $1
	`, vendorUserID).Scan(&out.ReviewStatus, &reapplyAfter); err != nil {
		return nil, err
	}
	if reapplyAfter.Valid {
		out.ReapplyAfter = &reapplyAfter.Time
	}
	if err := d.db.GetContext(ctx, &out.ShareToken, `SELECT share_token FROM vendor_vouch_links WHERE vendor_user_id = $1`, vendorUserID); err != nil {
		return nil, err
	}
	_ = d.db.GetContext(ctx, &out.VendorName, `SELECT full_name FROM vendor_profile_step WHERE vendor_user_id = $1`, vendorUserID)

	return &out, nil
}

func (d *DB) ensureVouchShareToken(ctx context.Context, vendorUserID int64) (string, error) {
	var token string
	err := d.db.GetContext(ctx, &token, `
		SELECT share_token
		FROM vendor_vouch_links
		WHERE vendor_user_id = $1
	`, vendorUserID)
	if err == nil {
		return token, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}

	for i := 0; i < 8; i++ {
		token = "v" + generateHex(10)
		_, insertErr := d.db.ExecContext(ctx, `
			INSERT INTO vendor_vouch_links
				(vendor_user_id, share_token, is_active, created_at, updated_at)
			VALUES
				($1, $2, TRUE, $3, $3)
			ON CONFLICT (vendor_user_id) DO NOTHING
		`, vendorUserID, token, time.Now())
		if insertErr != nil {
			var pqErr *pq.Error
			if errors.As(insertErr, &pqErr) && pqErr.Code == "23505" {
				continue
			}
			return "", insertErr
		}

		err = d.db.GetContext(ctx, &token, `
			SELECT share_token
			FROM vendor_vouch_links
			WHERE vendor_user_id = $1
		`, vendorUserID)
		if err == nil {
			return token, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return "", err
		}
	}
	return "", errors.New("could not create vouch share token")
}

func (d *DB) applyVouchStepStatus(ctx context.Context, vendorUserID int64) error {
	var count int
	if err := d.db.GetContext(ctx, &count, `SELECT COUNT(1) FROM vendor_vouch_entries WHERE vendor_user_id = $1`, vendorUserID); err != nil {
		return err
	}

	now := time.Now()
	if count >= VouchTarget {
		_, err := d.db.ExecContext(ctx, `
			UPDATE vendor_vouch_step
			SET step_status = $2, completed_at = COALESCE(completed_at, $3), updated_at = $3
			WHERE vendor_user_id = $1
		`, vendorUserID, StepCompleted, now)
		return err
	}
	_, err := d.db.ExecContext(ctx, `
		UPDATE vendor_vouch_step
		SET step_status = $2,
			review_status = 'pending',
			review_decided_at = NULL,
			reapply_after = NULL,
			completed_at = NULL,
			updated_at = $3
		WHERE vendor_user_id = $1
	`, vendorUserID, StepPending, now)
	return err
}

func generateHex(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func normalizeDigits(input string) string {
	var out strings.Builder
	for _, c := range input {
		if c >= '0' && c <= '9' {
			out.WriteRune(c)
		}
	}
	return out.String()
}
