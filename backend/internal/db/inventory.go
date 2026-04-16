package db

import (
	"context"
	"database/sql"
	"regexp"
	"strings"
	"time"
)

// VendorInventoryRow represents one row in vendor_inventory after "Enter Details" is saved.
type VendorInventoryRow struct {
	ID                 int        `db:"id" json:"id"`
	InventoryID        int        `db:"inventory_id" json:"inventoryId"`
	VendorPhone        string     `db:"vendor_phone" json:"vendorPhone"`
	ProductID          string     `db:"product_id" json:"productId"`
	SKUID              *string    `db:"sku_id" json:"skuId,omitempty"`
	Category           string     `db:"category" json:"category"`
	Size               string     `db:"size" json:"size"`
	PurchasePriceCents *int64     `db:"purchase_price_cents" json:"purchasePriceCents"`
	DesiredPayoutCents *int64     `db:"desired_payout_cents" json:"desiredPayoutCents"`
	ListedPriceCents   *int64     `db:"listed_price_cents" json:"listedPriceCents"`
	FinalPayoutCents   *int64     `db:"final_payout_cents" json:"finalPayoutCents"`
	ProfitLossCents    *int64     `db:"profit_loss_cents" json:"profitLossCents"`
	PairLocation       *string    `db:"pair_location" json:"pairLocation"`
	Availability       *string    `db:"availability" json:"availability"`
	BoxCondition       *string    `db:"box_condition" json:"boxCondition"`
	ProductQty         *string    `db:"product_qty" json:"productQty"`
	PurchaseDate       *time.Time `db:"purchase_date" json:"purchaseDate"`
	PlaceOfPurchase    *string    `db:"place_of_purchase" json:"placeOfPurchase"`
	ListingStatus      string     `db:"listing_status" json:"listingStatus"`
	SoldOut            bool       `db:"sold_out" json:"soldOut"`
	QuantityRemaining  int        `db:"quantity_remaining" json:"quantityRemaining"`
	CreatedAt          time.Time  `db:"created_at" json:"createdAt"`
	UpdatedAt          time.Time  `db:"updated_at" json:"updatedAt"`
}

// NextInventoryID returns the next value from vendor_inventory_id_seq.
func (d *DB) NextInventoryID(ctx context.Context) (int, error) {
	var id int
	err := d.db.GetContext(ctx, &id, "SELECT nextval('vendor_inventory_id_seq')")
	return id, err
}

// CreateVendorInventory inserts a new inventory row and returns the row with inventory_id.
func (d *DB) CreateVendorInventory(ctx context.Context, row VendorInventoryRow) (*VendorInventoryRow, error) {
	invID, err := d.NextInventoryID(ctx)
	if err != nil {
		return nil, err
	}
	row.InventoryID = invID
	qty := row.QuantityRemaining
	if qty < 1 {
		qty = 1
	}
	query := `INSERT INTO vendor_inventory (
		inventory_id, vendor_phone, product_id, sku_id, category, size,
		purchase_price_cents, desired_payout_cents, listed_price_cents, final_payout_cents, profit_loss_cents,
		pair_location, availability, box_condition, product_qty, purchase_date, place_of_purchase,
		listing_status, sold_out, quantity_remaining
	) VALUES (
		$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
	) RETURNING id, inventory_id, vendor_phone, product_id, category, size,
		sku_id, purchase_price_cents, desired_payout_cents, listed_price_cents, final_payout_cents, profit_loss_cents,
		pair_location, availability, box_condition, product_qty, purchase_date, place_of_purchase,
		listing_status, sold_out, quantity_remaining, created_at, updated_at`
	err = d.db.GetContext(ctx, &row, query,
		row.InventoryID, row.VendorPhone, row.ProductID, NormalizeSKUID(row.SKUID), row.Category, row.Size,
		row.PurchasePriceCents, row.DesiredPayoutCents, row.ListedPriceCents, row.FinalPayoutCents, row.ProfitLossCents,
		row.PairLocation, row.Availability, row.BoxCondition, row.ProductQty, row.PurchaseDate, row.PlaceOfPurchase,
		row.ListingStatus, row.SoldOut, qty,
	)
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// GetVendorInventoryByProduct returns the latest inventory row for vendor + product + category.
func (d *DB) GetVendorInventoryByProduct(ctx context.Context, vendorPhone, productID, category string) (*VendorInventoryRow, error) {
	query := `SELECT id, inventory_id, vendor_phone, product_id, sku_id, category, size,
		purchase_price_cents, desired_payout_cents, listed_price_cents, final_payout_cents, profit_loss_cents,
		pair_location, availability, box_condition, product_qty, purchase_date, place_of_purchase,
		listing_status, sold_out, quantity_remaining, created_at, updated_at
		FROM vendor_inventory
		WHERE vendor_phone = $1 AND product_id = $2 AND category = $3
		ORDER BY created_at DESC LIMIT 1`
	var row VendorInventoryRow
	err := d.db.GetContext(ctx, &row, query, vendorPhone, productID, category)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &row, nil
}

// GetVendorInventoryByInventoryID returns one inventory row by business inventory_id.
// Used by orders flow to attach profit_loss_cents to completed orders.
func (d *DB) GetVendorInventoryByInventoryID(ctx context.Context, inventoryID int) (*VendorInventoryRow, error) {
	query := `SELECT id, inventory_id, vendor_phone, product_id, sku_id, category, size,
		purchase_price_cents, desired_payout_cents, listed_price_cents, final_payout_cents, profit_loss_cents,
		pair_location, availability, box_condition, product_qty, purchase_date, place_of_purchase,
		listing_status, sold_out, quantity_remaining, created_at, updated_at
		FROM vendor_inventory
		WHERE inventory_id = $1
		ORDER BY created_at DESC LIMIT 1`
	var row VendorInventoryRow
	err := d.db.GetContext(ctx, &row, query, inventoryID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &row, nil
}

// ListVendorInventory returns all inventory rows for a vendor, newest first.
func (d *DB) ListVendorInventory(ctx context.Context, vendorPhone string) ([]VendorInventoryRow, error) {
	query := `SELECT id, inventory_id, vendor_phone, product_id, sku_id, category, size,
		purchase_price_cents, desired_payout_cents, listed_price_cents, final_payout_cents, profit_loss_cents,
		pair_location, availability, box_condition, product_qty, purchase_date, place_of_purchase,
		listing_status, sold_out, quantity_remaining, created_at, updated_at
		FROM vendor_inventory
		WHERE vendor_phone = $1
		ORDER BY created_at DESC`
	var rows []VendorInventoryRow
	err := d.db.SelectContext(ctx, &rows, query, vendorPhone)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// UpdateVendorInventoryListingStatus updates listing_status for an inventory row.
func (d *DB) UpdateVendorInventoryListingStatus(ctx context.Context, id int, status string) error {
	query := `UPDATE vendor_inventory SET listing_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := d.db.ExecContext(ctx, query, status, id)
	return err
}

// UpdateVendorInventorySoldOut updates sold_out flag for an inventory row.
func (d *DB) UpdateVendorInventorySoldOut(ctx context.Context, id int, soldOut bool) error {
	query := `UPDATE vendor_inventory SET sold_out = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := d.db.ExecContext(ctx, query, soldOut, id)
	return err
}

// DeleteVendorInventory permanently deletes an inventory row.
func (d *DB) DeleteVendorInventory(ctx context.Context, id int) error {
	query := `DELETE FROM vendor_inventory WHERE id = $1`
	_, err := d.db.ExecContext(ctx, query, id)
	return err
}

// LiveListingRow is one vendor listing for the main site price feed (Compare Price).
type LiveListingRow struct {
	VendorPhone       string  `db:"vendor_phone" json:"vendorPhone"`
	ListedPriceCents  int64   `db:"listed_price_cents" json:"listedPriceCents"`
	InventoryID       int     `db:"inventory_id" json:"inventoryId"`
	Size              string  `db:"size" json:"size"`
	QuantityRemaining int     `db:"quantity_remaining" json:"quantityRemaining"`
	SKUID             *string `db:"sku_id" json:"skuId,omitempty"`
}

// normalizeCategory converts main site category (e.g. sneaker) to DB form (e.g. sneakers).
func normalizeCategory(category string) string {
	cat := strings.TrimSpace(strings.ToLower(category))
	if cat == "sneaker" {
		return "sneakers"
	}
	if cat == "accessory" {
		return "accessories"
	}
	if cat == "perfume" {
		return "perfumes"
	}
	if cat == "watch" {
		return "watches"
	}
	if cat == "handbag" {
		return "handbags"
	}
	return cat
}

// isPreparedStatementGone returns true for Neon/pq "unnamed prepared statement does not exist"
// (happens when the server closed the connection and the pool reused it).
func isPreparedStatementGone(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "unnamed prepared statement does not exist") ||
		strings.Contains(err.Error(), "prepared statement does not exist")
}

// ListLiveListingsAllSizes returns all live listings (list_now, not sold_out) for a product+category.
// Each row includes size so the main site can filter by selected size in the UI.
// Retries once on "unnamed prepared statement does not exist" (Neon connection recycle).
func (d *DB) ListLiveListingsAllSizes(ctx context.Context, productID, category string) ([]LiveListingRow, error) {
	cat := normalizeCategory(category)
	productID = strings.TrimSpace(productID)
	query := `SELECT vendor_phone, listed_price_cents, inventory_id,
		TRIM(COALESCE(size, 'OneSize')) AS size,
		quantity_remaining, sku_id
		FROM vendor_inventory
		WHERE product_id = $1 AND LOWER(TRIM(category)) = $2
		  AND listing_status = 'list_now' AND (sold_out IS NOT TRUE)
		  AND quantity_remaining > 0
		  AND listed_price_cents IS NOT NULL AND listed_price_cents > 0
		ORDER BY size, listed_price_cents ASC`
	var rows []LiveListingRow
	err := d.db.SelectContext(ctx, &rows, query, productID, cat)
	if err != nil && isPreparedStatementGone(err) {
		rows = nil
		err = d.db.SelectContext(ctx, &rows, query, productID, cat)
	}
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// ListLiveListings returns all live listings (list_now, not sold_out) for a product+category+size.
// Size is matched as-is; for no-size categories pass "OneSize" or "".
// Retries once on "unnamed prepared statement does not exist" (Neon connection recycle).
func (d *DB) ListLiveListings(ctx context.Context, productID, category, size string) ([]LiveListingRow, error) {
	if size == "" {
		size = "OneSize"
	}
	cat := normalizeCategory(category)
	productID = strings.TrimSpace(productID)
	sizeLookup := normalizeSizeLookup(size)
	query := `SELECT vendor_phone, listed_price_cents, inventory_id,
		TRIM(COALESCE(size, 'OneSize')) AS size,
		quantity_remaining, sku_id
		FROM vendor_inventory
		WHERE product_id = $1 AND LOWER(TRIM(category)) = $2
		  AND REPLACE(LOWER(TRIM(COALESCE(size, 'OneSize'))), ' ', '') = $3
		  AND listing_status = 'list_now' AND (sold_out IS NOT TRUE)
		  AND quantity_remaining > 0
		  AND listed_price_cents IS NOT NULL AND listed_price_cents > 0
		ORDER BY listed_price_cents ASC`
	var rows []LiveListingRow
	err := d.db.SelectContext(ctx, &rows, query, productID, cat, sizeLookup)
	if err != nil && isPreparedStatementGone(err) {
		rows = nil
		err = d.db.SelectContext(ctx, &rows, query, productID, cat, sizeLookup)
	}
	if err != nil {
		return nil, err
	}
	return rows, nil
}

var skuSanitizer = regexp.MustCompile(`[^A-Za-z0-9]+`)

// NormalizeSKUID keeps only alphanumerics and uppercases for cross-source matching consistency.
func NormalizeSKUID(sku *string) interface{} {
	if sku == nil {
		return nil
	}
	n := strings.ToUpper(strings.TrimSpace(*sku))
	n = skuSanitizer.ReplaceAllString(n, "")
	if n == "" {
		return nil
	}
	return n
}

// ListLiveListingsBySKUAllSizes returns all live listings for a sku+category.
func (d *DB) ListLiveListingsBySKUAllSizes(ctx context.Context, skuID, category string) ([]LiveListingRow, error) {
	cat := normalizeCategory(category)
	query := `SELECT vendor_phone, listed_price_cents, inventory_id,
		TRIM(COALESCE(size, 'OneSize')) AS size,
		quantity_remaining, sku_id
		FROM vendor_inventory
		WHERE sku_id = $1 AND LOWER(TRIM(category)) = $2
		  AND listing_status = 'list_now' AND (sold_out IS NOT TRUE)
		  AND quantity_remaining > 0
		  AND listed_price_cents IS NOT NULL AND listed_price_cents > 0
		ORDER BY size, listed_price_cents ASC`
	var rows []LiveListingRow
	err := d.db.SelectContext(ctx, &rows, query, NormalizeSKUID(&skuID), cat)
	if err != nil && isPreparedStatementGone(err) {
		rows = nil
		err = d.db.SelectContext(ctx, &rows, query, NormalizeSKUID(&skuID), cat)
	}
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// ListLiveListingsBySKU returns all live listings for sku+category+size.
func (d *DB) ListLiveListingsBySKU(ctx context.Context, skuID, category, size string) ([]LiveListingRow, error) {
	if size == "" {
		size = "OneSize"
	}
	cat := normalizeCategory(category)
	sizeLookup := normalizeSizeLookup(size)
	query := `SELECT vendor_phone, listed_price_cents, inventory_id,
		TRIM(COALESCE(size, 'OneSize')) AS size,
		quantity_remaining, sku_id
		FROM vendor_inventory
		WHERE sku_id = $1 AND LOWER(TRIM(category)) = $2
		  AND REPLACE(LOWER(TRIM(COALESCE(size, 'OneSize'))), ' ', '') = $3
		  AND listing_status = 'list_now' AND (sold_out IS NOT TRUE)
		  AND quantity_remaining > 0
		  AND listed_price_cents IS NOT NULL AND listed_price_cents > 0
		ORDER BY listed_price_cents ASC`
	var rows []LiveListingRow
	err := d.db.SelectContext(ctx, &rows, query, NormalizeSKUID(&skuID), cat, sizeLookup)
	if err != nil && isPreparedStatementGone(err) {
		rows = nil
		err = d.db.SelectContext(ctx, &rows, query, NormalizeSKUID(&skuID), cat, sizeLookup)
	}
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func normalizeSizeLookup(size string) string {
	s := strings.TrimSpace(strings.ToLower(size))
	if s == "" {
		s = "onesize"
	}
	return strings.ReplaceAll(s, " ", "")
}
