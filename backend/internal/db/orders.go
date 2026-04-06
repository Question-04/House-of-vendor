package db

import (
	"context"
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// VendorOrderRow represents one row in vendor_orders.
type VendorOrderRow struct {
	ID                    int            `db:"id" json:"id"`
	VendorPhone           string         `db:"vendor_phone" json:"vendorPhone"`
	InventoryID           *int           `db:"inventory_id" json:"inventoryId"`
	ProductID             string         `db:"product_id" json:"productId"`
	Category              string         `db:"category" json:"category"`
	Size                  string         `db:"size" json:"size"`
	ProductName           *string        `db:"product_name" json:"productName"`
	ProductImageURL       *string        `db:"product_image_url" json:"productImageUrl"`
	ExternalOrderID       string         `db:"external_order_id" json:"externalOrderId"`
	OrderDate             time.Time      `db:"order_date" json:"orderDate"`
	ShippingAddress       *string        `db:"shipping_address" json:"shippingAddress"`
	Status                string         `db:"status" json:"status"`
	ShippingPartner       *string        `db:"shipping_partner" json:"shippingPartner"`
	TrackingID            *string        `db:"tracking_id" json:"trackingId"`
	PickupDate            *time.Time     `db:"pickup_date" json:"pickupDate"`
	VerificationStatus    *string        `db:"verification_status" json:"verificationStatus"`
	PayoutCents           *int64         `db:"payout_cents" json:"payoutCents"`
	ProfitLossCents       *int64         `db:"profit_loss_cents" json:"profitLossCents"`
	PaymentWindowFrom     *time.Time     `db:"payment_window_from" json:"paymentWindowFrom"`
	PaymentWindowTo       *time.Time     `db:"payment_window_to" json:"paymentWindowTo"`
	PayoutBy              *string        `db:"payout_by" json:"payoutBy"`
	ReverificationDocURLs pq.StringArray `db:"reverification_doc_urls" json:"reverificationDocUrls"`
	PayoutReleasedAt      *time.Time     `db:"payout_released_at" json:"payoutReleasedAt"`
	PayoutReleasedBy      *string        `db:"payout_released_by" json:"payoutReleasedBy"`
	RejectionReason       *string        `db:"rejection_reason" json:"rejectionReason"`
	OrderQuantity         int            `db:"order_quantity" json:"orderQuantity"`
	CreatedAt             time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt             time.Time      `db:"updated_at" json:"updatedAt"`
}

// ListVendorOrders returns all orders for a vendor, newest first.
func (d *DB) ListVendorOrders(ctx context.Context, vendorPhone string) ([]VendorOrderRow, error) {
	query := `SELECT vo.id, vo.vendor_phone, vo.inventory_id, vo.product_id, vo.category, vo.size, vo.product_name, vo.product_image_url,
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
		) inv_latest ON TRUE
		WHERE vo.vendor_phone = $1
		ORDER BY vo.created_at DESC`
	var rows []VendorOrderRow
	err := d.db.SelectContext(ctx, &rows, query, vendorPhone)
	return rows, err
}

// GetVendorOrderByID returns one order by id; caller must verify vendor_phone if needed.
func (d *DB) GetVendorOrderByID(ctx context.Context, id int) (*VendorOrderRow, error) {
	query := `SELECT vo.id, vo.vendor_phone, vo.inventory_id, vo.product_id, vo.category, vo.size, vo.product_name, vo.product_image_url,
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
		) inv_latest ON TRUE
		WHERE vo.id = $1`
	var row VendorOrderRow
	err := d.db.GetContext(ctx, &row, query, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// GetVendorOrderByVendorAndExternal returns one order by (vendor_phone, external_order_id).
func (d *DB) GetVendorOrderByVendorAndExternal(ctx context.Context, vendorPhone, externalOrderID string) (*VendorOrderRow, error) {
	return getVendorOrderByVendorAndExternal(ctx, d.db, vendorPhone, externalOrderID)
}

func getVendorOrderByVendorAndExternal(ctx context.Context, ext sqlx.ExtContext, vendorPhone, externalOrderID string) (*VendorOrderRow, error) {
	query := `SELECT vo.id, vo.vendor_phone, vo.inventory_id, vo.product_id, vo.category, vo.size, vo.product_name, vo.product_image_url,
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
		) inv_latest ON TRUE
		WHERE vo.vendor_phone = $1 AND vo.external_order_id = $2
		ORDER BY vo.id ASC
		LIMIT 1`
	var row VendorOrderRow
	err := sqlx.GetContext(ctx, ext, &row, query, vendorPhone, externalOrderID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &row, nil
}

// GetVendorOrderByVendorAndExternalTx is the transaction variant of the same lookup.
func (d *DB) GetVendorOrderByVendorAndExternalTx(ctx context.Context, tx *sqlx.Tx, vendorPhone, externalOrderID string) (*VendorOrderRow, error) {
	return getVendorOrderByVendorAndExternal(ctx, tx, vendorPhone, externalOrderID)
}

func insertVendorOrder(ctx context.Context, ext sqlx.ExtContext, row *VendorOrderRow) error {
	oq := row.OrderQuantity
	if oq < 1 {
		oq = 1
	}
	query := `INSERT INTO vendor_orders (
		vendor_phone, inventory_id, product_id, category, size, product_name, product_image_url,
		external_order_id, order_date, shipping_address, status, verification_status, payout_cents, order_quantity
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'in_progress', $12, $13)
	RETURNING id, vendor_phone, inventory_id, product_id, category, size, product_name, product_image_url,
		external_order_id, order_date, shipping_address, status, shipping_partner, tracking_id, pickup_date,
		verification_status, payout_cents, profit_loss_cents, payment_window_from, payment_window_to, payout_by,
		payout_released_at, payout_released_by, rejection_reason, order_quantity, created_at, updated_at`
	return sqlx.GetContext(ctx, ext, row, query,
		row.VendorPhone, row.InventoryID, row.ProductID, row.Category, row.Size,
		row.ProductName, row.ProductImageURL, row.ExternalOrderID, row.OrderDate,
		row.ShippingAddress, row.Status, row.PayoutCents, oq,
	)
}

// CreateVendorOrder inserts an order (e.g. from main site) and returns the row.
func (d *DB) CreateVendorOrder(ctx context.Context, row VendorOrderRow) (*VendorOrderRow, error) {
	if err := insertVendorOrder(ctx, d.db, &row); err != nil {
		return nil, err
	}
	return &row, nil
}

// CreateVendorOrderTx inserts an order inside an existing transaction (e.g. with stock reserve).
func (d *DB) CreateVendorOrderTx(ctx context.Context, tx *sqlx.Tx, row VendorOrderRow) (*VendorOrderRow, error) {
	if err := insertVendorOrder(ctx, tx, &row); err != nil {
		return nil, err
	}
	return &row, nil
}

// UpdateVendorOrderStatus sets status and updated_at.
func (d *DB) UpdateVendorOrderStatus(ctx context.Context, id int, vendorPhone string, status string) error {
	query := `UPDATE vendor_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND vendor_phone = $3`
	_, err := d.db.ExecContext(ctx, query, status, id, vendorPhone)
	return err
}

// UpdateVendorOrderIfPending moves status from pending to newStatus; returns nil if no row matched (wrong vendor, not pending, or missing).
func (d *DB) UpdateVendorOrderIfPending(ctx context.Context, id int, vendorPhone, newStatus string) (*VendorOrderRow, error) {
	var row VendorOrderRow
	err := d.db.GetContext(ctx, &row, `
		UPDATE vendor_orders
		SET status = $1, updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND vendor_phone = $3 AND status = 'pending'
		RETURNING id, vendor_phone, inventory_id, product_id, category, size, product_name, product_image_url,
			external_order_id, order_date, shipping_address, status, shipping_partner, tracking_id, pickup_date,
			verification_status, payout_cents, profit_loss_cents, payment_window_from, payment_window_to, payout_by,
			reverification_doc_urls, payout_released_at, payout_released_by, rejection_reason, order_quantity, created_at, updated_at
	`, newStatus, id, vendorPhone)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &row, nil
}

// UpdateVendorOrderTracking sets shipping_partner, tracking_id, pickup_date, status = in_transit, updated_at.
func (d *DB) UpdateVendorOrderTracking(ctx context.Context, id int, vendorPhone string, shippingPartner, trackingID string, pickupDate *time.Time) error {
	query := `UPDATE vendor_orders SET shipping_partner = $1, tracking_id = $2, pickup_date = $3, status = 'in_transit', updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND vendor_phone = $5`
	_, err := d.db.ExecContext(ctx, query, nullStr(shippingPartner), nullStr(trackingID), pickupDate, id, vendorPhone)
	return err
}

// AppendReverificationDocURL appends a URL to reverification_doc_urls and updates updated_at.
func (d *DB) AppendReverificationDocURL(ctx context.Context, id int, vendorPhone string, docURL string) error {
	query := `UPDATE vendor_orders SET reverification_doc_urls = array_append(COALESCE(reverification_doc_urls, '{}'), $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND vendor_phone = $3`
	_, err := d.db.ExecContext(ctx, query, docURL, id, vendorPhone)
	return err
}

// UpdateVendorOrderVerificationStatus sets verification_status (dashboard use: real_and_authentic, needs_docs, rejected).
func (d *DB) UpdateVendorOrderVerificationStatus(ctx context.Context, id int, status string) error {
	query := `UPDATE vendor_orders SET verification_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := d.db.ExecContext(ctx, query, status, id)
	return err
}

// SetVendorOrderCompleted sets status = completed, profit_loss_cents, updated_at.
func (d *DB) SetVendorOrderCompleted(ctx context.Context, id int, profitLossCents *int64) error {
	query := `UPDATE vendor_orders SET status = 'completed', profit_loss_cents = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := d.db.ExecContext(ctx, query, profitLossCents, id)
	return err
}

// SetVendorOrderPaymentPending sets status = payment_pending, profit_loss_cents, payment_window_from/to, payout_by, updated_at.
func (d *DB) SetVendorOrderPaymentPending(ctx context.Context, id int, from, to *time.Time, payoutBy *string, profitLossCents *int64) error {
	query := `UPDATE vendor_orders SET status = 'payment_pending', payment_window_from = $1, payment_window_to = $2, payout_by = $3, profit_loss_cents = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`
	_, err := d.db.ExecContext(ctx, query, from, to, payoutBy, profitLossCents, id)
	return err
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
