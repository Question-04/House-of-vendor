package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"
)

// TryReserveInventoryUnits atomically decrements quantity_remaining for a live listing.
// Returns nil, nil when no row matched (wrong vendor, not list_now, sold out, or insufficient stock).
func (d *DB) TryReserveInventoryUnits(ctx context.Context, ext sqlx.ExtContext, businessInventoryID int, vendorPhone string, qty int) (*VendorInventoryRow, error) {
	if qty <= 0 || businessInventoryID <= 0 || strings.TrimSpace(vendorPhone) == "" {
		return nil, nil
	}
	vendorPhone = strings.TrimSpace(vendorPhone)
	query := `UPDATE vendor_inventory SET
		quantity_remaining = quantity_remaining - $1,
		sold_out = ((quantity_remaining - $1) <= 0),
		updated_at = CURRENT_TIMESTAMP
	WHERE inventory_id = $2 AND vendor_phone = $3
		AND listing_status = 'list_now'
		AND (sold_out IS NOT TRUE)
		AND quantity_remaining >= $1
	RETURNING id, inventory_id, vendor_phone, product_id, category, size,
		purchase_price_cents, desired_payout_cents, listed_price_cents, final_payout_cents, profit_loss_cents,
		pair_location, availability, box_condition, product_qty, purchase_date, place_of_purchase,
		listing_status, sold_out, quantity_remaining, created_at, updated_at`
	var row VendorInventoryRow
	err := sqlx.GetContext(ctx, ext, &row, query, qty, businessInventoryID, vendorPhone)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &row, nil
}

// RestoreInventoryUnits adds units back to a listing (e.g. order cancelled or rejected).
func (d *DB) RestoreInventoryUnits(ctx context.Context, ext sqlx.ExtContext, businessInventoryID int, vendorPhone string, qty int) error {
	if qty <= 0 || businessInventoryID <= 0 || strings.TrimSpace(vendorPhone) == "" {
		return nil
	}
	_, err := ext.ExecContext(ctx, `
		UPDATE vendor_inventory SET
			quantity_remaining = quantity_remaining + $1,
			sold_out = FALSE,
			updated_at = CURRENT_TIMESTAMP
		WHERE inventory_id = $2 AND vendor_phone = $3
	`, qty, businessInventoryID, strings.TrimSpace(vendorPhone))
	return err
}

// RestoreInventoryForRejectedOrCancelledOrder returns stock for an order that had reserved inventory.
func (d *DB) RestoreInventoryForRejectedOrCancelledOrder(ctx context.Context, order *VendorOrderRow) error {
	if order == nil || order.InventoryID == nil || *order.InventoryID <= 0 {
		return nil
	}
	qty := order.OrderQuantity
	if qty <= 0 {
		qty = 1
	}
	return d.RestoreInventoryUnits(ctx, d.db, *order.InventoryID, order.VendorPhone, qty)
}

// OrderLineProfitLossCents returns per-order-line P&L using inventory per-unit profit × order_quantity.
func OrderLineProfitLossCents(inv *VendorInventoryRow, orderQty int) *int64 {
	if inv == nil || inv.ProfitLossCents == nil {
		return nil
	}
	if orderQty <= 0 {
		orderQty = 1
	}
	total := *inv.ProfitLossCents * int64(orderQty)
	return &total
}

// ParseListingQuantityFromProductQty parses a positive integer from vendor "quantity" text (e.g. "20", "20 pairs").
func ParseListingQuantityFromProductQty(s *string) int {
	if s == nil {
		return 1
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return 1
	}
	var n int
	if _, err := fmt.Sscanf(t, "%d", &n); err != nil || n < 1 {
		return 1
	}
	if n > 100000 {
		return 100000
	}
	return n
}
