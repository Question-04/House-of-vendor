package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// VendorNotificationRow is one in-app notification for a vendor.
type VendorNotificationRow struct {
	ID          int64      `db:"id" json:"id"`
	VendorPhone string     `db:"vendor_phone" json:"vendorPhone"`
	Category    string     `db:"category" json:"category"`
	Kind        string     `db:"kind" json:"kind"`
	Title       string     `db:"title" json:"title"`
	Body        string     `db:"body" json:"body"`
	Meta        []byte     `db:"meta" json:"-"`
	ReadAt      *time.Time `db:"read_at" json:"readAt"`
	CreatedAt   time.Time  `db:"created_at" json:"createdAt"`
}

// VendorNotificationOutboxRow is one queued notification waiting to be delivered.
type VendorNotificationOutboxRow struct {
	ID          int64     `db:"id"`
	VendorPhone string    `db:"vendor_phone"`
	Category    string    `db:"category"`
	Kind        string    `db:"kind"`
	Title       string    `db:"title"`
	Body        string    `db:"body"`
	Meta        []byte    `db:"meta"`
	Attempts    int       `db:"attempts"`
	CreatedAt   time.Time `db:"created_at"`
}

// InsertVendorNotification stores a notification for the vendor.
func (d *DB) InsertVendorNotification(ctx context.Context, vendorPhone, category, kind, title, body string, meta map[string]interface{}) error {
	if meta == nil {
		meta = map[string]interface{}{}
	}
	b, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	_, err = d.db.ExecContext(ctx, `
		INSERT INTO vendor_notifications (vendor_phone, category, kind, title, body, meta)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb)
	`, vendorPhone, category, kind, title, body, string(b))
	return err
}

// EnqueueVendorNotification stores a notification in outbox for async delivery.
func (d *DB) EnqueueVendorNotification(ctx context.Context, vendorPhone, category, kind, title, body string, meta map[string]interface{}) error {
	if meta == nil {
		meta = map[string]interface{}{}
	}
	b, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	_, err = d.db.ExecContext(ctx, `
		INSERT INTO vendor_notification_outbox (vendor_phone, category, kind, title, body, meta)
		VALUES ($1, $2, $3, $4, $5, $6::jsonb)
	`, vendorPhone, category, kind, title, body, string(b))
	return err
}

// ClaimVendorNotificationOutboxBatch atomically claims pending outbox rows for this worker.
func (d *DB) ClaimVendorNotificationOutboxBatch(ctx context.Context, batchSize int) ([]VendorNotificationOutboxRow, error) {
	if batchSize <= 0 || batchSize > 500 {
		batchSize = 100
	}
	var rows []VendorNotificationOutboxRow
	err := d.db.SelectContext(ctx, &rows, `
		WITH candidates AS (
			SELECT id
			FROM vendor_notification_outbox
			WHERE processed_at IS NULL
			  AND available_at <= CURRENT_TIMESTAMP
			  AND (locked_at IS NULL OR locked_at < CURRENT_TIMESTAMP - INTERVAL '30 seconds')
			ORDER BY id
			LIMIT $1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE vendor_notification_outbox o
		SET locked_at = CURRENT_TIMESTAMP,
		    attempts = o.attempts + 1
		FROM candidates c
		WHERE o.id = c.id
		RETURNING o.id, o.vendor_phone, o.category, o.kind, o.title, o.body, o.meta, o.attempts, o.created_at
	`, batchSize)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// MarkVendorNotificationOutboxProcessed marks one outbox item delivered.
func (d *DB) MarkVendorNotificationOutboxProcessed(ctx context.Context, id int64) error {
	_, err := d.db.ExecContext(ctx, `
		UPDATE vendor_notification_outbox
		SET processed_at = CURRENT_TIMESTAMP, locked_at = NULL, last_error = NULL
		WHERE id = $1
	`, id)
	return err
}

// RescheduleVendorNotificationOutbox retries one outbox item after a backoff.
func (d *DB) RescheduleVendorNotificationOutbox(ctx context.Context, id int64, attempt int, cause error) error {
	delay := time.Duration(1<<minInt(attempt, 6)) * time.Second // 2s..64s exponential backoff
	errMsg := ""
	if cause != nil {
		errMsg = truncateErr(cause.Error(), 800)
	}
	_, err := d.db.ExecContext(ctx, `
		UPDATE vendor_notification_outbox
		SET available_at = CURRENT_TIMESTAMP + ($2::text)::interval,
		    locked_at = NULL,
		    last_error = NULLIF($3, '')
		WHERE id = $1
	`, id, fmt.Sprintf("%d seconds", int(delay.Seconds())), errMsg)
	return err
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func truncateErr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

// ListVendorNotifications returns recent notifications for a vendor (newest first).
func (d *DB) ListVendorNotifications(ctx context.Context, vendorPhone string, limit int) ([]VendorNotificationRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	var rows []VendorNotificationRow
	err := d.db.SelectContext(ctx, &rows, `
		SELECT id, vendor_phone, category, kind, title, body, meta, read_at, created_at
		FROM vendor_notifications
		WHERE vendor_phone = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, vendorPhone, limit)
	return rows, err
}

// CountUnreadVendorNotifications returns how many notifications have read_at IS NULL.
func (d *DB) CountUnreadVendorNotifications(ctx context.Context, vendorPhone string) (int64, error) {
	var n int64
	err := d.db.GetContext(ctx, &n, `
		SELECT COUNT(1) FROM vendor_notifications
		WHERE vendor_phone = $1 AND read_at IS NULL
	`, vendorPhone)
	return n, err
}

// MarkAllVendorNotificationsRead sets read_at for all unread rows for this phone.
func (d *DB) MarkAllVendorNotificationsRead(ctx context.Context, vendorPhone string) error {
	_, err := d.db.ExecContext(ctx, `
		UPDATE vendor_notifications
		SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
		WHERE vendor_phone = $1 AND read_at IS NULL
	`, vendorPhone)
	return err
}

// DeleteVendorNotificationByID deletes one notification owned by vendor phone.
func (d *DB) DeleteVendorNotificationByID(ctx context.Context, vendorPhone string, notificationID int64) (bool, error) {
	res, err := d.db.ExecContext(ctx, `
		DELETE FROM vendor_notifications
		WHERE id = $1 AND vendor_phone = $2
	`, notificationID, vendorPhone)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

// CancelVendorOrderIfPending sets status rejected and rejection_reason when still pending; returns row if updated.
func (d *DB) CancelVendorOrderIfPending(ctx context.Context, orderID int, rejectionReason string) (*VendorOrderRow, error) {
	var row VendorOrderRow
	err := d.db.GetContext(ctx, &row, `
		UPDATE vendor_orders
		SET status = 'rejected', rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1 AND status = 'pending'
		RETURNING id, vendor_phone, inventory_id, product_id, category, size, product_name, product_image_url,
			external_order_id, order_date, shipping_address, status, shipping_partner, tracking_id, pickup_date,
			verification_status, payout_cents, profit_loss_cents, payment_window_from, payment_window_to, payout_by,
			reverification_doc_urls, payout_released_at, payout_released_by, rejection_reason, order_quantity, created_at, updated_at
	`, orderID, rejectionReason)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &row, nil
}

// AdminRejectOrderWithReason sets rejected + optional reason (no vendor_phone scope).
func (d *DB) AdminRejectOrderWithReason(ctx context.Context, orderID int, rejectionReason string) error {
	res, err := d.db.ExecContext(ctx, `
		UPDATE vendor_orders
		SET status = 'rejected', rejection_reason = COALESCE(NULLIF(TRIM($2), ''), rejection_reason), updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, orderID, rejectionReason)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
