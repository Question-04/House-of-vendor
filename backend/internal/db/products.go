package db

import (
	"context"
	"strings"

	"github.com/lib/pq"
)

// ProductCard is the minimal data we send for listing cards (home, category, brand, search).
// We only select what the UI needs so responses stay small and fast.
type ProductCard struct {
	ID         string  `json:"id" db:"id"`
	Category   string  `json:"category" db:"category"`
	Brand      string  `json:"brand" db:"brand"`
	Name       string  `json:"name" db:"name"`
	FirstImage string  `json:"image" db:"first_image"`
	Price      *string `json:"price,omitempty" db:"price"`
}

// allowedCategories: only these get data from their dedicated table; no fallback to search_products.
var allowedCategories = map[string]bool{
	"sneakers": true, "perfumes": true, "watches": true,
	"apparel": true, "handbags": true, "accessories": true,
}

// getProductsFromTable runs a single query for one category with LIMIT/OFFSET.
// Runtime listing source of truth is search_products for all categories.
func (d *DB) getProductsFromTable(ctx context.Context, category string, limit, offset int) ([]ProductCard, error) {
	category = strings.TrimSpace(strings.ToLower(category))
	if !allowedCategories[category] {
		return nil, nil
	}
	query := `SELECT product_id AS id, category, brand, name,
		COALESCE((images)[1], '') AS first_image, price::text AS price
		FROM search_products
		WHERE category = $1
		ORDER BY updated_at DESC, product_id DESC
		LIMIT $2 OFFSET $3`
	args := []interface{}{category, limit, offset}

	var out []ProductCard
	err := d.db.SelectContext(ctx, &out, query, args...)
	return out, err
}

// GetCategoryPage returns a page of products for one category (for "Explore the Edit").
func (d *DB) GetCategoryPage(ctx context.Context, category string, limit, offset int) ([]ProductCard, error) {
	return d.getProductsFromTable(ctx, category, limit, offset)
}

// GetProductByID returns a single product by category and id (for product detail page).
// Runtime PDP source of truth is search_products.
func (d *DB) GetProductByID(ctx context.Context, category, id string) (*ProductCard, error) {
	category = strings.TrimSpace(strings.ToLower(category))
	if !allowedCategories[category] {
		return nil, nil
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, nil
	}
	query := `SELECT product_id AS id, category, brand, name,
		COALESCE((images)[1], '') AS first_image, price::text AS price
		FROM search_products
		WHERE category = $1 AND product_id = $2
		LIMIT 1`
	args := []interface{}{category, id}
	var out ProductCard
	err := d.db.GetContext(ctx, &out, query, args...)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

// ProductCardBatchKey returns a stable map key for category + product id (lowercase category).
func ProductCardBatchKey(category, productID string) string {
	return strings.TrimSpace(strings.ToLower(category)) + ":" + strings.TrimSpace(productID)
}

// GetProductCardsBatch loads ProductCards for many (category, id) pairs using at most one query per category table.
func (d *DB) GetProductCardsBatch(ctx context.Context, pairs []struct{ Category, ProductID string }) (map[string]ProductCard, error) {
	byCat := make(map[string][]string)
	seen := make(map[string]map[string]bool)
	for _, p := range pairs {
		cat := strings.TrimSpace(strings.ToLower(p.Category))
		id := strings.TrimSpace(p.ProductID)
		if cat == "" || id == "" || !allowedCategories[cat] {
			continue
		}
		if seen[cat] == nil {
			seen[cat] = make(map[string]bool)
		}
		if seen[cat][id] {
			continue
		}
		seen[cat][id] = true
		byCat[cat] = append(byCat[cat], id)
	}
	out := make(map[string]ProductCard)
	for cat, ids := range byCat {
		if len(ids) == 0 {
			continue
		}
		list, err := d.selectProductCardsByIDs(ctx, cat, ids)
		if err != nil {
			return nil, err
		}
		for _, c := range list {
			out[ProductCardBatchKey(cat, c.ID)] = c
		}
	}
	return out, nil
}

func (d *DB) selectProductCardsByIDs(ctx context.Context, category string, ids []string) ([]ProductCard, error) {
	if !allowedCategories[category] {
		return nil, nil
	}
	query := `SELECT product_id AS id, category, brand, name,
		COALESCE((images)[1], '') AS first_image, price::text AS price
		FROM search_products
		WHERE category = $1 AND product_id = ANY($2)`
	var list []ProductCard
	err := d.db.SelectContext(ctx, &list, query, category, pq.Array(ids))
	return list, err
}

// GetBrandPage returns products for a given brand from search_products (all categories).
// This keeps one query and uses the existing search_products index on brand.
func (d *DB) GetBrandPage(ctx context.Context, brand string, limit, offset int) ([]ProductCard, error) {
	query := `SELECT product_id AS id, category, brand, name,
		COALESCE((images)[1], '') AS first_image, price::text AS price
		FROM search_products
		WHERE LOWER(TRIM(brand)) = LOWER(TRIM($1))
		ORDER BY id LIMIT $2 OFFSET $3`
	var out []ProductCard
	err := d.db.SelectContext(ctx, &out, query, brand, limit, offset)
	return out, err
}

// SearchOverlay searches search_products: case-insensitive on name/brand/color, optional category filter.
// We use ILIKE for simple case-insensitive match; for huge data you could switch to to_tsvector.
func (d *DB) SearchOverlay(ctx context.Context, q string, categories []string, limit, offset int) ([]ProductCard, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return d.searchOverlayNoQuery(ctx, categories, limit, offset)
	}
	pattern := "%" + q + "%"
	var out []ProductCard
	if len(categories) == 0 {
		query := `SELECT product_id AS id, category, brand, name,
			COALESCE((images)[1], '') AS first_image, price::text AS price
			FROM search_products
			WHERE (name ILIKE $1 OR brand ILIKE $1 OR COALESCE(color,'') ILIKE $1)
			ORDER BY id LIMIT $2 OFFSET $3`
		err := d.db.SelectContext(ctx, &out, query, pattern, limit, offset)
		return out, err
	}
	// Filter by one or more categories (IN clause).
	query := `SELECT product_id AS id, category, brand, name,
		COALESCE((images)[1], '') AS first_image, price::text AS price
		FROM search_products
		WHERE (name ILIKE $1 OR brand ILIKE $1 OR COALESCE(color,'') ILIKE $1)
		AND category = ANY($2)
		ORDER BY id LIMIT $3 OFFSET $4`
	err := d.db.SelectContext(ctx, &out, query, pattern, categories, limit, offset)
	return out, err
}

// GetFeaturedBrands returns brand names to show in the dashboard (below search).
// For now we take distinct brands from search_products; later you can replace with an admin-chosen table.
func (d *DB) GetFeaturedBrands(ctx context.Context, max int) ([]string, error) {
	if max <= 0 {
		max = 10
	}
	query := `SELECT DISTINCT brand FROM search_products WHERE TRIM(brand) <> '' ORDER BY brand LIMIT $1`
	var out []string
	err := d.db.SelectContext(ctx, &out, query, max)
	return out, err
}

func (d *DB) searchOverlayNoQuery(ctx context.Context, categories []string, limit, offset int) ([]ProductCard, error) {
	var out []ProductCard
	if len(categories) == 0 {
		query := `SELECT product_id AS id, category, brand, name,
			COALESCE((images)[1], '') AS first_image, price::text AS price
			FROM search_products ORDER BY id LIMIT $1 OFFSET $2`
		err := d.db.SelectContext(ctx, &out, query, limit, offset)
		return out, err
	}
	query := `SELECT product_id AS id, category, brand, name,
		COALESCE((images)[1], '') AS first_image, price::text AS price
		FROM search_products WHERE category = ANY($1) ORDER BY id LIMIT $2 OFFSET $3`
	err := d.db.SelectContext(ctx, &out, query, categories, limit, offset)
	return out, err
}

// CreateProductReviewRequest inserts a new "add product for review" submission.
func (d *DB) CreateProductReviewRequest(ctx context.Context, productName, category, productLink, description string, imageURLs []string) error {
	query := `INSERT INTO product_review_requests (product_name, category, product_link, description, image_urls, status)
		VALUES ($1, $2, $3, $4, $5, 'pending')`
	if imageURLs == nil {
		imageURLs = []string{}
	}
	_, err := d.db.ExecContext(ctx, query, productName, category, productLink, nullIfEmpty(description), pq.Array(imageURLs))
	return err
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
