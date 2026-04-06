package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"vendor-api/internal/db"
	"vendor-api/internal/storage"
)

// ProductsHandler serves product listing and search APIs.
type ProductsHandler struct {
	db      *db.DB
	storage storage.Uploader
}

// NewProductsHandler creates a products handler. storage may be nil (image upload disabled).
func NewProductsHandler(database *db.DB, uploader storage.Uploader) *ProductsHandler {
	return &ProductsHandler{db: database, storage: uploader}
}

// Only these categories are valid; ensures each request gets only that category's table.
var allowedCategoryList = []string{"sneakers", "perfumes", "watches", "apparel", "handbags", "accessories"}

func allowedCategory(cat string) bool {
	for _, c := range allowedCategoryList {
		if c == cat {
			return true
		}
	}
	return false
}

// GetCategoryPage handles GET /api/products/category/:category?limit=24&offset=0.
func (h *ProductsHandler) GetCategoryPage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	rawPath := r.URL.Path
	path := strings.TrimPrefix(rawPath, "/api/products/category/")
	category := strings.Split(path, "?")[0]
	category = strings.Trim(strings.ToLower(category), "/")
	log.Printf("[category] raw_path=%q parsed_category=%q", rawPath, category)
	if category == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "category required"})
		return
	}
	if !allowedCategory(category) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "invalid category"})
		return
	}
	limit, offset := parseLimitOffset(r, 24, 0)
	list, err := h.db.GetCategoryPage(r.Context(), category, limit, offset)
	if err != nil {
		log.Printf("[category] category=%q error=%v", category, err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load category"})
		return
	}
	// Log so we can verify the right category is returned (first product's category if any)
	if len(list) > 0 {
		log.Printf("[category] requested=%q returned_count=%d first_product_category=%q", category, len(list), list[0].Category)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "products": list})
}

// GetBrandPage handles GET /api/products/brand/:brand?limit=12&offset=0.
func (h *ProductsHandler) GetBrandPage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/products/brand/")
	brand := strings.Split(path, "?")[0]
	brand = strings.Trim(brand, "/")
	if brand == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "brand required"})
		return
	}
	limit, offset := parseLimitOffset(r, 12, 0)
	list, err := h.db.GetBrandPage(r.Context(), brand, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load brand"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "products": list})
}

// SearchOverlayResponse for GET /api/search/overlay.
type SearchOverlayResponse struct {
	Success  bool             `json:"success"`
	Message  string           `json:"message"`
	Products []db.ProductCard `json:"products"`
}

// GetSearchOverlay handles GET /api/search/overlay?q=...&limit=24&offset=0&categories=sneakers,apparel.
// Categories are optional; when present we filter to those categories only.
func (h *ProductsHandler) GetSearchOverlay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	limit, offset := parseLimitOffset(r, 24, 0)
	var categories []string
	if c := r.URL.Query().Get("categories"); c != "" {
		for _, s := range strings.Split(c, ",") {
			s = strings.TrimSpace(strings.ToLower(s))
			if s != "" {
				categories = append(categories, s)
			}
		}
	}
	list, err := h.db.SearchOverlay(r.Context(), q, categories, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, SearchOverlayResponse{Success: false, Message: "Search failed"})
		return
	}
	writeJSON(w, http.StatusOK, SearchOverlayResponse{Success: true, Message: "OK", Products: list})
}

// GetProductDetail handles GET /api/products/detail?category=sneakers&id=123.
func (h *ProductsHandler) GetProductDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	category := strings.Trim(strings.ToLower(r.URL.Query().Get("category")), " ")
	id := strings.Trim(r.URL.Query().Get("id"), " ")
	if category == "" || id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "category and id required"})
		return
	}
	if !allowedCategory(category) {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "invalid category"})
		return
	}
	product, err := h.db.GetProductByID(r.Context(), category, id)
	if err != nil {
		log.Printf("[product-detail] category=%q id=%q error=%v", category, id, err)
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not load product"})
		return
	}
	if product == nil {
		writeJSON(w, http.StatusNotFound, map[string]interface{}{"success": false, "message": "Product not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "product": product})
}

// GetFeaturedBrands handles GET /api/brands/featured?max=10.
func (h *ProductsHandler) GetFeaturedBrands(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	max := 10
	if m := r.URL.Query().Get("max"); m != "" {
		if n, err := strconv.Atoi(m); err == nil && n > 0 {
			max = n
		}
	}
	brands, err := h.db.GetFeaturedBrands(r.Context(), max)
	if err != nil {
		log.Printf("[products] GetFeaturedBrands error: %v", err)
		// Return empty list so the home page still loads (e.g. search_products table may not exist yet).
		writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "brands": []string{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "brands": brands})
}

// HomeFeedCategory matches the vendor home page JSON shape (one slice per vertical).
type HomeFeedCategory struct {
	Category string           `json:"category"`
	Title    string           `json:"title"`
	Subtitle string           `json:"subtitle"`
	Products []db.ProductCard `json:"products"`
}

var homeFeedOrder = []string{"sneakers", "perfumes", "watches", "apparel", "handbags", "accessories"}

var homeFeedMeta = map[string]struct{ Title, Subtitle string }{
	"sneakers":     {Title: "The Sneakers Edit", Subtitle: "Curated sneakers, selected for quality and authenticity."},
	"perfumes":     {Title: "Fragrance Selection", Subtitle: "Curated fragrances for every preference."},
	"watches":      {Title: "Timepiece Collection", Subtitle: "Curated timepieces, selected for quality and authenticity."},
	"apparel":      {Title: "The Apparel Edit", Subtitle: "Curated apparel, selected for quality and authenticity."},
	"handbags":     {Title: "The Handbags Edit", Subtitle: "Curated handbags, selected for quality and authenticity."},
	"accessories":  {Title: "The Accessories Edit", Subtitle: "Curated accessories, selected for quality and authenticity."},
}

const homeFeedLimit = 8

// GetHomeFeed handles GET /api/products/home — six category slices in parallel (single HTTP round-trip).
func (h *ProductsHandler) GetHomeFeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx := r.Context()
	out := make([]HomeFeedCategory, len(homeFeedOrder))
	var wg sync.WaitGroup
	var mu sync.Mutex
	for i, cat := range homeFeedOrder {
		wg.Add(1)
		go func(i int, cat string) {
			defer wg.Done()
			list, err := h.db.GetCategoryPage(ctx, cat, homeFeedLimit, 0)
			if err != nil {
				log.Printf("[products] home feed category=%q: %v", cat, err)
				list = nil
			}
			meta := homeFeedMeta[cat]
			mu.Lock()
			out[i] = HomeFeedCategory{
				Category: cat,
				Title:    meta.Title,
				Subtitle: meta.Subtitle,
				Products: list,
			}
			mu.Unlock()
		}(i, cat)
	}
	wg.Wait()
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "categories": out})
}

// SubmitProductReviewRequest body for POST /api/product-review.
type SubmitProductReviewRequest struct {
	ProductName string   `json:"productName"`
	Category    string   `json:"category"`
	ProductLink string   `json:"productLink"`
	Description string   `json:"description"`
	ImageURLs   []string `json:"imageUrls"`
}

// SubmitProductReview handles POST /api/product-review. Product link is required.
func (h *ProductsHandler) SubmitProductReview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req SubmitProductReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid request"})
		return
	}
	link := strings.TrimSpace(req.ProductLink)
	if link == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Product link is required"})
		return
	}
	category := strings.TrimSpace(strings.ToLower(req.Category))
	if category == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Product category is required"})
		return
	}
	if err := h.db.CreateProductReviewRequest(r.Context(), strings.TrimSpace(req.ProductName), category, link, strings.TrimSpace(req.Description), req.ImageURLs); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not submit for review"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "message": "Submitted for review"})
}

const (
	productReviewImageMaxSize = 10 * 1024 * 1024 // 10 MB
	productReviewImageMaxFiles = 5
)

var allowedImageMimes = map[string]bool{
	"image/jpeg": true, "image/jpg": true, "image/png": true,
}

// UploadProductReviewImages handles POST /api/product-review/upload-image (multipart/form-data, field "images" or "files").
// Uploads each file to R2 under product-review/{key}. Returns { success, urls: string[] }.
func (h *ProductsHandler) UploadProductReviewImages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.storage == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{"success": false, "message": "Image upload not configured"})
		return
	}
	if err := r.ParseMultipartForm(productReviewImageMaxSize * (productReviewImageMaxFiles + 1)); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Invalid multipart form"})
		return
	}
	form := r.MultipartForm
	if form == nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "No files"})
		return
	}
	files := form.File["images"]
	if len(files) == 0 {
		files = form.File["files"]
	}
	if len(files) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "No files (use field 'images' or 'files')"})
		return
	}
	if len(files) > productReviewImageMaxFiles {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Max 5 images allowed"})
		return
	}
	var urls []string
	for i, header := range files {
		if header.Size > productReviewImageMaxSize {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "File too large (max 10 MB): " + header.Filename})
			return
		}
		file, err := header.Open()
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Could not read file"})
			return
		}
		content, err := io.ReadAll(io.LimitReader(file, productReviewImageMaxSize+1))
		_ = file.Close()
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not read file"})
			return
		}
		if int64(len(content)) > productReviewImageMaxSize {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "File too large: " + header.Filename})
			return
		}
		mimeType := header.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = http.DetectContentType(content)
		}
		if !allowedImageMimes[mimeType] {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{"success": false, "message": "Only JPG and PNG allowed: " + header.Filename})
			return
		}
		ext := filepath.Ext(header.Filename)
		if ext == "" {
			if strings.Contains(mimeType, "png") {
				ext = ".png"
			} else {
				ext = ".jpg"
			}
		}
		b := make([]byte, 4)
		if _, _ = rand.Read(b); true {
			// ignore error for key uniqueness
		}
		objectKey := "product-review/" + time.Now().Format("20060102150405") + "_" + hex.EncodeToString(b) + "_" + strconv.Itoa(i) + ext
		url, err := h.storage.Upload(r.Context(), objectKey, content, mimeType)
		if err != nil {
			log.Printf("[product-review] upload error: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]interface{}{"success": false, "message": "Could not upload image"})
			return
		}
		urls = append(urls, url)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "urls": urls})
}

func parseLimitOffset(r *http.Request, defaultLimit, defaultOffset int) (limit, offset int) {
	limit = defaultLimit
	offset = defaultOffset
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			offset = n
		}
	}
	return limit, offset
}
