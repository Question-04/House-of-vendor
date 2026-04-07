package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

)

// AdminUserRow is a vendor user with onboarding snapshot for admin list.
type AdminUserRow struct {
	ID                     int64      `db:"id" json:"id"`
	Phone                  string     `db:"phone" json:"phone"`
	CreatedAt              time.Time  `db:"created_at" json:"createdAt"`
	FullName               *string    `db:"full_name" json:"fullName"`
	Email                  *string    `db:"email" json:"email"`
	ProfileStatus          *string    `db:"profile_status" json:"profileStatus"`
	VerificationStepStatus *string    `db:"verification_step_status" json:"verificationStepStatus"`
	AdminKycDecision       *string    `db:"admin_kyc_decision" json:"adminKycDecision"`
	VouchStepStatus        *string    `db:"vouch_step_status" json:"vouchStepStatus"`
	VouchReviewStatus      *string    `db:"vouch_review_status" json:"vouchReviewStatus"`
}

// AdminVerificationQueueRow is a submitted verification pending KYC review.
type AdminVerificationQueueRow struct {
	Phone             string     `db:"phone" json:"phone"`
	VendorUserID      int64      `db:"vendor_user_id" json:"vendorUserId"`
	StepStatus        string     `db:"step_status" json:"stepStatus"`
	SubmittedAt       *time.Time `db:"submitted_at" json:"submittedAt"`
	AadhaarFileName   string     `db:"aadhaar_file_name" json:"aadhaarFileName"`
	PanFileName       string     `db:"pan_file_name" json:"panFileName"`
	AadhaarDocCount   int        `db:"aadhaar_doc_count" json:"aadhaarDocCount"`
	PanDocCount       int        `db:"pan_doc_count" json:"panDocCount"`
	AdminKycDecision  *string    `db:"admin_kyc_decision" json:"adminKycDecision"`
}

// AdminVouchQueueRow is a vendor who completed vouches and awaits review.
type AdminVouchQueueRow struct {
	Phone         string `db:"phone" json:"phone"`
	VendorUserID  int64  `db:"vendor_user_id" json:"vendorUserId"`
	VouchCount    int    `db:"vouch_count" json:"vouchCount"`
	VendorName    string `db:"vendor_name" json:"vendorName"`
	ReviewStatus  string `db:"review_status" json:"reviewStatus"`
	StepStatus    string `db:"step_status" json:"stepStatus"`
}

// AdminStats holds dashboard counters.
type AdminStats struct {
	VendorUsers           int `json:"vendorUsers"`
	PendingKycReviews     int `json:"pendingKycReviews"`
	PendingVouchReviews   int `json:"pendingVouchReviews"`
	OpenTickets           int `json:"openTickets"`
	PendingProductRequests int `json:"pendingProductRequests"`
}

// VendorProductRequestRow is one product catalog request from a vendor.
type VendorProductRequestRow struct {
	ID           int            `db:"id" json:"id"`
	VendorPhone  string         `db:"vendor_phone" json:"vendorPhone"`
	ProductName  string         `db:"product_name" json:"productName"`
	Brand        sql.NullString `db:"brand" json:"-"`
	Category     sql.NullString `db:"category" json:"-"`
	Notes        sql.NullString `db:"notes" json:"-"`
	Status       string         `db:"status" json:"status"`
	AdminNotes   sql.NullString `db:"admin_notes" json:"-"`
	CreatedAt    time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time      `db:"updated_at" json:"updatedAt"`
	BrandOut     *string        `json:"brand,omitempty"`
	CategoryOut  *string        `json:"category,omitempty"`
	NotesOut     *string        `json:"notes,omitempty"`
	AdminNotesOut *string       `json:"adminNotes,omitempty"`
}

func scanProductRequest(r VendorProductRequestRow) VendorProductRequestRow {
	if r.Brand.Valid {
		r.BrandOut = &r.Brand.String
	}
	if r.Category.Valid {
		r.CategoryOut = &r.Category.String
	}
	if r.Notes.Valid {
		r.NotesOut = &r.Notes.String
	}
	if r.AdminNotes.Valid {
		r.AdminNotesOut = &r.AdminNotes.String
	}
	return r
}

// InsertAdminAudit appends one audit row.
func (d *DB) InsertAdminAudit(ctx context.Context, actorEmail, action, resourceType, resourceID string, metadata map[string]interface{}) error {
	var metaJSON []byte
	var err error
	if metadata == nil {
		metaJSON = []byte("{}")
	} else {
		metaJSON, err = json.Marshal(metadata)
		if err != nil {
			return err
		}
	}
	_, err = d.db.ExecContext(ctx, `
		INSERT INTO admin_audit_log (actor_email, action, resource_type, resource_id, metadata, created_at)
		VALUES ($1, $2, $3, $4, $5::jsonb, $6)
	`, actorEmail, action, resourceType, resourceID, metaJSON, time.Now().UTC())
	return err
}

// GetAdminStats returns aggregate counts for the admin overview.
func (d *DB) GetAdminStats(ctx context.Context) (*AdminStats, error) {
	var s AdminStats
	if err := d.db.GetContext(ctx, &s.VendorUsers, `SELECT COUNT(1) FROM vendor_users`); err != nil {
		return nil, err
	}
	if err := d.db.GetContext(ctx, &s.PendingKycReviews, `
		SELECT COUNT(1) FROM vendor_verification_step
		WHERE step_status = 'completed' AND admin_kyc_decision IS NULL
	`); err != nil {
		return nil, err
	}
	if err := d.db.GetContext(ctx, &s.PendingVouchReviews, `
		SELECT COUNT(1)
		FROM vendor_vouch_step vv
		WHERE vv.review_status = 'pending'
		  AND (
		    vv.step_status = 'completed'
		    OR (SELECT COUNT(1) FROM vendor_vouch_entries vve WHERE vve.vendor_user_id = vv.vendor_user_id) >= $1
		  )
	`, VouchTarget); err != nil {
		return nil, err
	}
	if err := d.db.GetContext(ctx, &s.OpenTickets, `
		SELECT COUNT(1) FROM support_tickets WHERE status IN ('Open', 'In Progress')
	`); err != nil {
		return nil, err
	}
	if err := d.db.GetContext(ctx, &s.PendingProductRequests, `
		SELECT COUNT(1) FROM vendor_product_requests WHERE status IN ('pending', 'in_review')
	`); err != nil {
		return nil, err
	}
	return &s, nil
}

// ListAdminUsers returns vendor users with profile/verification/vouch snapshot.
func (d *DB) ListAdminUsers(ctx context.Context, limit, offset int) ([]AdminUserRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var rows []AdminUserRow
	err := d.db.SelectContext(ctx, &rows, `
		SELECT
			vu.id,
			vu.phone,
			vu.created_at,
			vps.full_name,
			vps.email,
			vps.step_status AS profile_status,
			vvs.step_status AS verification_step_status,
			vvs.admin_kyc_decision,
			vvouch.step_status AS vouch_step_status,
			vvouch.review_status AS vouch_review_status
		FROM vendor_users vu
		LEFT JOIN vendor_profile_step vps ON vps.vendor_user_id = vu.id
		LEFT JOIN vendor_verification_step vvs ON vvs.vendor_user_id = vu.id
		LEFT JOIN vendor_vouch_step vvouch ON vvouch.vendor_user_id = vu.id
		ORDER BY vu.id DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	return rows, err
}

// ListVerificationQueue returns vendors with submitted docs and no admin KYC decision yet.
func (d *DB) ListVerificationQueue(ctx context.Context) ([]AdminVerificationQueueRow, error) {
	var rows []AdminVerificationQueueRow
	err := d.db.SelectContext(ctx, &rows, `
		SELECT
			vu.phone,
			vvs.vendor_user_id,
			vvs.step_status,
			vvs.submitted_at,
			vvs.aadhaar_file_name,
			vvs.pan_file_name,
			COALESCE(jsonb_array_length(COALESCE(vvs.aadhaar_documents, '[]'::jsonb)), 0) AS aadhaar_doc_count,
			COALESCE(jsonb_array_length(COALESCE(vvs.pan_documents, '[]'::jsonb)), 0) AS pan_doc_count,
			vvs.admin_kyc_decision
		FROM vendor_verification_step vvs
		INNER JOIN vendor_users vu ON vu.id = vvs.vendor_user_id
		WHERE vvs.step_status = 'completed' AND vvs.admin_kyc_decision IS NULL
		ORDER BY vvs.submitted_at DESC NULLS LAST, vu.id DESC
	`)
	return rows, err
}

// SetAdminKycReview sets KYC review outcome for a vendor phone.
func (d *DB) SetAdminKycReview(ctx context.Context, phone, decision, notes, reviewerEmail string) error {
	decision = strings.TrimSpace(strings.ToLower(decision))
	switch decision {
	case "approved", "rejected", "needs_resubmit":
	default:
		return errors.New("invalid kyc decision")
	}
	now := time.Now().UTC()
	res, err := d.db.ExecContext(ctx, `
		UPDATE vendor_verification_step AS vvs
		SET
			admin_kyc_decision = $1,
			admin_kyc_notes = $2,
			admin_kyc_reviewed_at = $3,
			admin_kyc_reviewed_by = $4,
			updated_at = $3
		FROM vendor_users vu
		WHERE vvs.vendor_user_id = vu.id AND vu.phone = $5
	`, decision, strings.TrimSpace(notes), now, reviewerEmail, phone)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ListVouchReviewQueue returns vendors awaiting vouch team review.
func (d *DB) ListVouchReviewQueue(ctx context.Context) ([]AdminVouchQueueRow, error) {
	var rows []AdminVouchQueueRow
	err := d.db.SelectContext(ctx, &rows, `
		SELECT
			vu.phone,
			vv.vendor_user_id,
			(SELECT COUNT(1) FROM vendor_vouch_entries vve WHERE vve.vendor_user_id = vv.vendor_user_id) AS vouch_count,
			COALESCE(vp.full_name, '') AS vendor_name,
			vv.review_status,
			vv.step_status
		FROM vendor_vouch_step vv
		INNER JOIN vendor_users vu ON vu.id = vv.vendor_user_id
		LEFT JOIN vendor_profile_step vp ON vp.vendor_user_id = vv.vendor_user_id
		WHERE vv.review_status = 'pending'
		  AND (
		    vv.step_status = 'completed'
		    OR (SELECT COUNT(1) FROM vendor_vouch_entries vve2 WHERE vve2.vendor_user_id = vv.vendor_user_id) >= $1
		  )
		ORDER BY vu.id DESC
	`, VouchTarget)
	return rows, err
}

// AdminRequestKYCResubmissionByPhone sends vendor back to verification and clears vouch progress.
func (d *DB) AdminRequestKYCResubmissionByPhone(ctx context.Context, phone string) error {
	user, err := d.GetUserByPhone(ctx, phone)
	if err != nil {
		return err
	}
	if err := d.ensureStepRows(ctx, user.ID); err != nil {
		return err
	}
	now := time.Now().UTC()
	tx, err := d.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM vendor_vouch_entries WHERE vendor_user_id = $1`, user.ID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE vendor_verification_step
		SET step_status = $2,
			admin_kyc_decision = 'needs_resubmit',
			admin_kyc_reviewed_at = $3,
			completed_at = NULL,
			submitted_at = NULL,
			updated_at = $3
		WHERE vendor_user_id = $1
	`, user.ID, StepPending, now); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE vendor_vouch_step
		SET step_status = $2,
			review_status = 'pending',
			review_decided_at = NULL,
			reapply_after = NULL,
			completed_at = NULL,
			updated_at = $3
		WHERE vendor_user_id = $1
	`, user.ID, StepPending, now); err != nil {
		return err
	}
	return tx.Commit()
}

// ListAllSupportTickets returns tickets across all vendors (newest first).
func (d *DB) ListAllSupportTickets(ctx context.Context, limit, offset int) ([]SupportTicketRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	var rows []SupportTicketRow
	err := d.db.SelectContext(ctx, &rows, `
		SELECT id, vendor_phone, ticket_code, category, order_id, subject, description, email, priority, status, doc_urls, created_at, updated_at
		FROM support_tickets
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`, limit, offset)
	return rows, err
}

// AdminListAllOrders lists orders for every vendor (admin).
func (d *DB) AdminListAllOrders(ctx context.Context, limit, offset int, statusFilter string) ([]VendorOrderRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	base := `SELECT vo.id, vo.vendor_phone, vo.inventory_id, vo.product_id, vo.category, vo.size, vo.product_name, vo.product_image_url,
		vo.external_order_id, vo.order_date, vo.shipping_address, vo.status, vo.shipping_partner, vo.tracking_id, vo.pickup_date,
		vo.verification_status, vo.payout_cents, COALESCE(vo.profit_loss_cents, vi.profit_loss_cents, inv_latest.profit_loss_cents) AS profit_loss_cents,
		vo.payment_window_from, vo.payment_window_to, vo.payout_by,
		vo.reverification_doc_urls, vo.payout_released_at, vo.payout_released_by, vo.rejection_reason, vo.order_quantity, vo.created_at, vo.updated_at
		FROM vendor_orders vo
		LEFT JOIN vendor_inventory vi
		  ON (vo.inventory_id IS NOT NULL AND (vi.inventory_id = vo.inventory_id OR vi.id = vo.inventory_id))
		LEFT JOIN LATERAL (
		  SELECT v2.profit_loss_cents
		  FROM vendor_inventory v2
		  WHERE v2.vendor_phone = vo.vendor_phone
		    AND v2.product_id = vo.product_id
		    AND LOWER(TRIM(v2.category)) = LOWER(TRIM(vo.category))
		    AND TRIM(COALESCE(v2.size, 'OneSize')) = TRIM(COALESCE(vo.size, 'OneSize'))
		  ORDER BY v2.created_at DESC
		  LIMIT 1
		) inv_latest ON TRUE`
	var rows []VendorOrderRow
	var err error
	if strings.TrimSpace(statusFilter) != "" {
		err = d.db.SelectContext(ctx, &rows, base+` WHERE vo.status = $1 ORDER BY vo.created_at DESC LIMIT $2 OFFSET $3`, statusFilter, limit, offset)
	} else {
		err = d.db.SelectContext(ctx, &rows, base+` ORDER BY vo.created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	}
	return rows, err
}

// AdminUpdateVendorOrderStatus updates order status by id (no vendor scope).
func (d *DB) AdminUpdateVendorOrderStatus(ctx context.Context, orderID int, status string) error {
	res, err := d.db.ExecContext(ctx, `UPDATE vendor_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, status, orderID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// AdminReleasePayout marks payout as released for an order.
func (d *DB) AdminReleasePayout(ctx context.Context, orderID int, adminEmail string) error {
	now := time.Now().UTC()
	res, err := d.db.ExecContext(ctx, `
		UPDATE vendor_orders SET payout_released_at = $1, payout_released_by = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3
	`, now, adminEmail, orderID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ListVendorProductRequests returns product requests with optional status filter.
func (d *DB) ListVendorProductRequests(ctx context.Context, status string, limit, offset int) ([]VendorProductRequestRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	var rows []VendorProductRequestRow
	var err error
	if strings.TrimSpace(status) != "" {
		err = d.db.SelectContext(ctx, &rows, `
			SELECT id, vendor_phone, product_name, brand, category, notes, status, admin_notes, created_at, updated_at
			FROM vendor_product_requests
			WHERE status = $1
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3
		`, status, limit, offset)
	} else {
		err = d.db.SelectContext(ctx, &rows, `
			SELECT id, vendor_phone, product_name, brand, category, notes, status, admin_notes, created_at, updated_at
			FROM vendor_product_requests
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2
		`, limit, offset)
	}
	if err != nil {
		return nil, err
	}
	out := make([]VendorProductRequestRow, len(rows))
	for i := range rows {
		out[i] = scanProductRequest(rows[i])
	}
	return out, nil
}

// CreateVendorProductRequest inserts a request from a vendor.
func (d *DB) CreateVendorProductRequest(ctx context.Context, vendorPhone, productName, brand, category, notes string) (*VendorProductRequestRow, error) {
	var row VendorProductRequestRow
	err := d.db.GetContext(ctx, &row, `
		INSERT INTO vendor_product_requests (vendor_phone, product_name, brand, category, notes, status, created_at, updated_at)
		VALUES ($1, $2, NULLIF(TRIM($3),''), NULLIF(TRIM($4),''), NULLIF(TRIM($5),''), 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		RETURNING id, vendor_phone, product_name, brand, category, notes, status, admin_notes, created_at, updated_at
	`, vendorPhone, strings.TrimSpace(productName), brand, category, notes)
	if err != nil {
		return nil, err
	}
	r := scanProductRequest(row)
	return &r, nil
}

// UpdateVendorProductRequestStatus sets status and optional admin notes.
func (d *DB) UpdateVendorProductRequestStatus(ctx context.Context, id int, status, adminNotes string) error {
	status = strings.TrimSpace(strings.ToLower(status))
	switch status {
	case "pending", "in_review", "approved", "rejected", "catalog_added":
	default:
		return errors.New("invalid status")
	}
	res, err := d.db.ExecContext(ctx, `
		UPDATE vendor_product_requests
		SET status = $1, admin_notes = COALESCE(NULLIF(TRIM($2),''), admin_notes), updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, status, adminNotes, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetVendorProductRequestByID returns one product request row.
func (d *DB) GetVendorProductRequestByID(ctx context.Context, id int) (*VendorProductRequestRow, error) {
	var row VendorProductRequestRow
	err := d.db.GetContext(ctx, &row, `
		SELECT id, vendor_phone, product_name, brand, category, notes, status, admin_notes, created_at, updated_at
		FROM vendor_product_requests WHERE id = $1
	`, id)
	if err != nil {
		return nil, err
	}
	r := scanProductRequest(row)
	return &r, nil
}

// GetVerificationFileRefsByPhone returns stored R2 refs for KYC docs (admin presign), newest-first order preserved.
func (d *DB) GetVerificationFileRefsByPhone(ctx context.Context, phone string) (aadhaarRefs, panRefs []string, err error) {
	step, err := d.GetVerificationStepByPhone(ctx, phone)
	if err != nil {
		return nil, nil, err
	}
	for _, e := range step.AadhaarDocuments {
		if strings.TrimSpace(e.URL) != "" {
			aadhaarRefs = append(aadhaarRefs, strings.TrimSpace(e.URL))
		}
	}
	for _, e := range step.PanDocuments {
		if strings.TrimSpace(e.URL) != "" {
			panRefs = append(panRefs, strings.TrimSpace(e.URL))
		}
	}
	return aadhaarRefs, panRefs, nil
}

// GetVouchEntriesForPhone returns recent vouch entries for admin detail.
func (d *DB) GetVouchEntriesForPhone(ctx context.Context, phone string, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	var vuID int64
	if err := d.db.GetContext(ctx, &vuID, `SELECT id FROM vendor_users WHERE phone = $1`, phone); err != nil {
		return nil, err
	}
	type entry struct {
		ID              int64     `db:"id"`
		VoucherName     string    `db:"voucher_name"`
		VoucherBrand    string    `db:"voucher_brand_name"`
		VoucherEmail    string    `db:"voucher_email"`
		VoucherPhone    string    `db:"voucher_phone"`
		Source          string    `db:"source"`
		CreatedAt       time.Time `db:"created_at"`
	}
	var raw []entry
	err := d.db.SelectContext(ctx, &raw, `
		SELECT id, voucher_name, voucher_brand_name, voucher_email, voucher_phone, source, created_at
		FROM vendor_vouch_entries
		WHERE vendor_user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, vuID, limit)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, len(raw))
	for i, e := range raw {
		out[i] = map[string]interface{}{
			"id": e.ID, "voucherName": e.VoucherName, "voucherBrandName": e.VoucherBrand,
			"voucherEmail": e.VoucherEmail, "voucherPhone": e.VoucherPhone, "source": e.Source,
			"createdAt": e.CreatedAt.UTC().Format(time.RFC3339),
		}
	}
	return out, nil
}
