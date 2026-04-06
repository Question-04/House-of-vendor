# Dashboard & Main Website – What We Built and How It Works

This doc explains the flow so you can learn and extend the dashboard.

---

## 1. Backend: How the API Serves Data

### Why we query only what we need
- The backend **never** loads all products at once. Each API returns a **small slice** (e.g. 12 or 24 items) with **limit** and **offset**.
- Example: Home feed = 6 categories × 12 products = 6 separate queries, each with `LIMIT 12`. So we only fetch 72 rows total for the first screen instead of the whole DB.

### Tables involved
- **Category tables**: `sneakers`, `apparel`, `accessories`, `perfumes`, `watches`, `handbags`. Each has at least: `id`, `brand`, name column (`product_name` or `title` for perfumes), `images` (array).
- **search_products**: One table built from all categories (e.g. via a migration that unions them). Used for **search** and **brand listing** so we don’t query 6 tables for every search.

### Key endpoints

| Endpoint | What it does | Used by |
|----------|--------------|--------|
| `GET /api/products/home` | Returns 6 categories, each with 12 products from the corresponding table. | Dashboard home |
| `GET /api/products/category/:category?limit=24&offset=0` | One category, paginated. | “Explore the Edit” page |
| `GET /api/products/brand/:brand?limit=12&offset=0` | All products for that brand from `search_products`. | Brand page |
| `GET /api/search/overlay?q=...&categories=...&limit=24&offset=0` | Search by name/brand/color (case-insensitive), optional category filter. | Search page |
| `GET /api/brands/featured?max=10` | Distinct brands from `search_products` (for the brand buttons). | Dashboard home |
| `POST /api/product-review` | Body: `productName`, `category`, `productLink` (required), `description`, `imageUrls`. Inserts into `product_review_requests`. | Add Product for Review form |

### How the frontend uses it
1. **Dashboard home** calls `getHomeFeed()` once → renders 6 sections and “Explore the Edit” links.
2. **Category page** (`/dashboard/category/[slug]`) calls `getCategoryPage(slug, 12, 0)` then, when the user scrolls near the bottom, calls again with `offset = 12`, then `24`, etc. (lazy loading).
3. **Brand page** same idea: first 12, then load more on scroll.
4. **Search page** uses **debounce**: we wait ~350ms after the user stops typing before calling `searchOverlay(q, { categories })`. So we don’t send a request on every keystroke.
5. **Add Product for Review** sends a POST with required `productLink` and `category`; on success we show the green Verified SVG and a “Form Submitted” message.

---

## 2. Frontend: Layout and Navigation

- **Dashboard layout** (`app/dashboard/layout.tsx`) wraps all routes under `/dashboard` with the same **navbar** (logo, Home, Dashboard, Inventory, Orders, search icon, light/dark icon, notification, profile initial).
- **Profile initial** comes from the existing profile API: we call `getProfile(phone)` with the phone from session storage and show the first letter of `fullName`.
- **Light/dark** toggle only swaps the icon for now; full theme logic can be added later.

---

## 3. Product Route Mapping (Important for Search & Cards)

Category slugs in the API are **plural** (e.g. `sneakers`, `perfumes`). Product detail URLs use **singular** paths as you specified:

- `sneakers` → `/dashboard/sneaker/:id`
- `perfumes` → `/dashboard/perfume/:id`
- `watches` → `/dashboard/watch/:id`
- `handbags` → `/dashboard/handbag/:id`
- `accessories` → `/dashboard/accessories/:id`
- `apparel` → `/dashboard/apparel/:id`

So when we render a product card we call a small helper that maps `category + id` to this path. When you add real product detail pages, create routes under `app/dashboard/[segment]/[id]/page.tsx` for each segment (sneaker, perfume, watch, handbag, apparel, accessories).

---

## 4. What You Need to Do on Your Machine

1. **Run the new migration** (creates `product_review_requests`):
   - From your backend folder: run your usual migration command, or execute `backend/migrations/007_create_product_review_requests.sql` against your Postgres DB.
2. **Ensure these exist in the DB**:
   - The 6 category tables: `sneakers`, `apparel`, `accessories`, `perfumes`, `watches`, `handbags`.
   - The `search_products` table (with at least: `id`, `product_id`, `category`, `brand`, `name`, `images`, and optional `price`, `color`).
3. **Watches table**: The code assumes columns `id`, `brand`, `product_name`, `images`. If your `watches` table uses different names (e.g. `title` instead of `product_name`), update `backend/internal/db/products.go` in the `case "watches":` block to match your schema.
4. **Featured brands**: Right now we take distinct brands from `search_products`. When you have an admin “featured brands” list, you can add a table (e.g. `featured_brands`) and change `GetFeaturedBrands` in `backend/internal/db/products.go` to read from that table instead.

---

## 5. Typography and Colors (As Requested)

- **Headings** (e.g. “The Sneakers/Footwear Edit”): serif, ~28–32px (Georgia / Times New Roman).
- **Body and nav**: Montserrat; nav links semibold, 18–20px.
- **Card**: background white; **card detail strip** under the image: `#f2f3f4`.
- **“Explore the Edit”** button and accents: `#c7a77b`.
- **Icons** in navbar: 24px.

---

## 6. Optional: Your Turn to Code

- **Inventory page**: Add a list of the vendor’s own products (you’ll need an API that returns products by vendor, e.g. by `phone` or `vendor_user_id`).
- **Orders page**: Add orders list and filters (again, new API + DB tables as needed).
- **Profile page**: Reuse the same profile form/fields as onboarding and add “Edit profile” + save calling the existing `saveProfile` API.
- **Dark mode**: Store preference (e.g. in `localStorage`), add a class or data attribute on `<html>` and switch Tailwind to dark variants.

If you tell me which of these you want to do first, I can walk you step-by-step and suggest the exact code you can type yourself.
