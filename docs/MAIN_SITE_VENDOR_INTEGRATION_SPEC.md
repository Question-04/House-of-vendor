# Main Site ↔ Vendor Integration — Full Spec

Use this document so **House of Plutus (main site)** and **Vendor website** are aligned: tables, APIs, and flows. When a vendor lists a price here, it shows on the main site; when a customer orders there, the order appears here.

---

## What you need to do (quick list)

1. **You (vendor):** Ensure these tables exist in your Neon DB (run the SQL if you haven’t): `vendor_inventory`, `vendor_orders` (see section 1). No new table is required for “listing of price” — we use `vendor_inventory` with `listing_status = 'list_now'`.
2. **Main site team:**  
   - **Prices:** Call `GET {VENDOR_API_URL}/api/listings?productId=&category=&size=` when showing a product page (and when size changes); use `vendorListings` in Compare Price (HOP logo + Rs. price).  
   - **Orders:** After creating their order and payment, call `POST {VENDOR_API_URL}/api/orders/create-from-main` with `vendorPhone`, `productId`, `category`, `size`, `externalOrderId`, and optionally `inventoryId`, `productName`, `productImageUrl`, `shippingAddress`, `payoutCents`.  
   - Add `vendor_phone` (and optionally `vendor_inventory_id`) to their orders table so they know which vendor to notify.
3. **You (vendor):** Nothing else — your backend already exposes `GET /api/listings` and `POST /api/orders/create-from-main`. Orders from the main site will appear under **Your Orders** once they call create-from-main.

---

## 1. What You Need to Run (Vendor Side — Your DB)

You run **your own Neon (vendor) database**. No new tables are required if you already ran the migrations below. If not, run them once.

### 1.1 Table: `vendor_inventory` (already exists)

This table stores each product listing (Enter Details → Save / List now). When a vendor sets **List now**, that row becomes a “live” listing: main site can show that price in Compare Price.

| Column | Type | Notes |
|--------|------|--------|
| id | SERIAL PRIMARY KEY | Internal ID |
| inventory_id | INTEGER NOT NULL UNIQUE | Human-friendly ID (e.g. 330849) |
| vendor_phone | VARCHAR(20) NOT NULL | Vendor identifier |
| product_id | TEXT NOT NULL | Same as main site product ID |
| category | TEXT NOT NULL | e.g. sneakers, apparel, perfumes, watches, handbags, accessories |
| size | TEXT NOT NULL DEFAULT 'OneSize' | e.g. UK 5, M, OneSize |
| listed_price_cents | BIGINT | Price in paise (INR × 100). Required for list_now. |
| listing_status | TEXT | 'save_for_later' \| 'list_now' — only 'list_now' is visible to main site |
| sold_out | BOOLEAN DEFAULT FALSE | When true, listing is excluded from price feed |
| … | … | (other columns: purchase_price_cents, desired_payout_cents, etc.) |

**Important:** For a listing to appear on the main site, it must have `listing_status = 'list_now'`, `sold_out = false`, and `listed_price_cents > 0`. Category should match main site (e.g. `sneakers`, `apparel`).

### 1.2 Table: `vendor_orders` (already exists)

This table stores orders that the main site sends to you. One row per order.

| Column | Type | Notes |
|--------|------|--------|
| id | SERIAL PRIMARY KEY | Your internal order ID (used in vendor dashboard APIs) |
| vendor_phone | VARCHAR(20) NOT NULL | Vendor who owns this order |
| inventory_id | INTEGER | FK to vendor_inventory (optional; from main site payload) |
| product_id | TEXT NOT NULL | Main site product ID |
| category | TEXT NOT NULL | e.g. sneakers, apparel |
| size | TEXT NOT NULL DEFAULT 'OneSize' | Selected size |
| product_name | TEXT | For display |
| product_image_url | TEXT | For display |
| external_order_id | TEXT NOT NULL | Order ID from main site (e.g. SNK-ABC123-20250306-A1B2C3) |
| order_date | TIMESTAMPTZ | When order was placed |
| shipping_address | TEXT | Full address string |
| status | TEXT | pending → waiting_pickup → in_transit → verification → completed / payment_pending / rejected |
| verification_status | TEXT | in_progress \| real_and_authentic \| needs_docs \| rejected |
| payout_cents | BIGINT | Payout to vendor (if sent by main site) |
| shipping_partner, tracking_id, pickup_date | … | Filled when vendor adds tracking |
| reverification_doc_urls | TEXT[] | URLs of uploaded docs |
| created_at, updated_at | TIMESTAMPTZ | |

**SQL to run (if not already run):** Use the contents of `backend/migrations/vendor_orders.sql` and `backend/migrations/008_create_vendor_inventory.sql` (or the consolidated `NEON_RUN_THIS.sql` where applicable). You said you will execute the table creation yourself — so run those migrations in your Neon SQL editor.

---

## 2. How the Main Site Gets Vendor Prices (Compare Price)

The main site must show vendor prices in the “Compare Price” section (HOP logo + “Rs. {price}”) for the **current product and selected size**.

### 2.1 Option A — Main site calls your API (recommended)

- **Endpoint:** `GET /api/listings`
- **Query params:** `productId` (required), `category` (required), `size` (optional)
  - **Without `size`:** Returns all live listings for that product+category (all sizes). Main site can fetch once and filter by selected size in the UI.
  - **With `size`:** Returns only listings for that size (e.g. `size=UK%207`).
- **Examples:**
  - All sizes: `GET https://your-vendor-api.com/api/listings?productId=123&category=sneakers`
  - One size: `GET https://your-vendor-api.com/api/listings?productId=123&category=sneakers&size=UK%207`

**Response (200):**

```json
{
  "success": true,
  "vendorListings": [
    {
      "vendorId": "+919876543210",
      "vendorName": "House of Plutus",
      "price": 12999.00,
      "inventoryId": 330849,
      "size": "UK 7",
      "quantityRemaining": 19
    }
  ]
}
```

- `price` is in **INR** (rupees).
- **`size`** is included in every listing (e.g. `"UK 7"`, `"OneSize"`) so the main site can filter by selected size and fill the size grid.
- **`quantityRemaining`** is how many units are left for that listing. When it reaches `0`, the listing disappears from this feed on the next request (no need to show a quantity selector on PDP if you always sell quantity `1`; still send **`inventoryId`** on checkout so stock is decremented atomically).
- One entry per vendor listing (only live: `list_now`, not `sold_out`, `quantity_remaining > 0`, with valid `listed_price_cents`).
- Main site uses this to render Compare Price (HOP logo + “Rs. {price}”) and to show “Price on request” when no listing exists for a size. If `vendorListings` is empty for the selected size, main site shows a single HOP row with “ENQUIRE NOW”.

**Category normalization:** Your API accepts both singular and plural from main site (e.g. `sneaker` or `sneakers`); internally you normalize to the same values you store (e.g. `sneakers`).

### 2.2 Option B — Same database

If the main site and vendor app share **one** Postgres database, the main site can read vendor prices directly:

```sql
SELECT vendor_phone, listed_price_cents, inventory_id
FROM vendor_inventory
WHERE product_id = $1
  AND LOWER(TRIM(category)) IN ($2_plural, $2_singular)  -- e.g. sneakers / sneaker
  AND TRIM(COALESCE(size, 'OneSize')) = $3
  AND listing_status = 'list_now'
  AND (sold_out IS NOT TRUE)
  AND quantity_remaining > 0
  AND listed_price_cents IS NOT NULL AND listed_price_cents > 0
ORDER BY listed_price_cents ASC;
```

Then map each row to `{ vendorId: vendor_phone, price: listed_price_cents / 100, inventoryId }` for the Compare Price UI.

### 2.3 When to call / query

- When the product page loads (for the default selected size).
- When the user changes size: main site should refetch (or filter) vendor listings for the new size and pass the new `vendorListings` into Compare Price.

---

## 3. How the Main Site Sends an Order to the Vendor

When a customer checks out on the main site and the selected price is from a vendor, the main site must:

1. Create its own order (e.g. in its `orders` table) and complete payment (e.g. PhonePe).
2. Call the vendor API so the order appears in the vendor dashboard.

### 3.1 Main site: add fields to its `orders` table (recommended)

So that the main site knows **which vendor** to notify and can pass the right data, add (if not already present):

- `vendor_id` or `vendor_phone` (VARCHAR) — the vendor who owns this listing.
- Optionally: `vendor_inventory_id` (INTEGER) — the vendor’s `inventory_id` for that listing.

When the user selects a size and a vendor price at checkout, the main site should store the corresponding `vendor_phone` (and optionally `inventory_id`) on the order row.

### 3.2 Vendor API: create order from main site

- **Endpoint:** `POST /api/orders/create-from-main`
- **Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| vendorPhone | string | Yes | Vendor’s phone (same as vendor_id on main site order) |
| inventoryId | number | No | Vendor’s inventory_id for this listing |
| productId | string | Yes | Main site product ID |
| category | string | Yes | e.g. sneakers, apparel, perfumes, watches, handbags, accessories |
| size | string | No | Selected size; default "OneSize" |
| productName | string | No | For display on vendor dashboard |
| productImageUrl | string | No | For display |
| externalOrderId | string | Yes | Main site order ID (e.g. SNK-ABC123-20250306-A1B2C3) |
| shippingAddress | string | No | Full shipping address |
| payoutCents | number | No | Payout to vendor in paise |
| quantity | number | No | Units to sell; default `1`. Must not exceed remaining stock. When **`inventoryId`** is sent, stock is reserved in the **same database transaction** as order creation (safe under concurrent checkouts). |

**Example request:**

```json
{
  "vendorPhone": "+919876543210",
  "inventoryId": 330849,
  "productId": "123",
  "category": "sneakers",
  "size": "UK 5",
  "productName": "Nike Air Max 90",
  "productImageUrl": "https://...",
  "externalOrderId": "SNK-123-20250306-A1B2C3",
  "shippingAddress": "123 Main St, City, State 110001",
  "payoutCents": 1280000
}
```

**Response (200):**

```json
{
  "success": true,
  "orderId": 42
}
```

**Response (409 Conflict)** — not enough stock (e.g. two customers paid at once; only one row of inventory left):

```json
{
  "success": false,
  "code": "OUT_OF_STOCK",
  "message": "This listing has no stock left or is no longer available. Refresh prices and try again."
}
```

On **409**, the main site should **not** treat the sale as fulfilled on the vendor side: refund or reconcile per your payment flow, and refetch `GET /api/listings` before retrying.

`orderId` is the vendor’s internal `vendor_orders.id` (for support/debugging). The vendor dashboard loads orders via `GET /api/orders?phone={vendor_phone}` and shows them in **Your Orders** (e.g. Pending → Accept/Reject → Tracking → Delivered → Verification, etc.).

**Important:** Always pass **`inventoryId`** from the listing the customer selected in Compare Price. Without it, the vendor API cannot decrement stock and the same listing could be oversold.

### 3.3 Main site: when to call

- After the main site has created its own order and (if applicable) after payment is confirmed (e.g. status = PAID). Then the main site backend calls `POST /api/orders/create-from-main` once per vendor order (if one checkout can have multiple vendor items, call once per item with the corresponding vendor and listing data).

---

## 4. Routing and Fetching Summary (Main Site Team)

| Goal | Method | Details |
|------|--------|--------|
| Show vendor price in Compare Price | GET vendor API | `GET {VENDOR_API_BASE}/api/listings?productId=&category=&size=` → use `response.vendorListings` (array of `{ vendorId?, vendorName?, price, inventoryId? }`). |
| Create order on main site | Existing flow | Main site `POST /api/create-order` (or equivalent) with productId, category, size, quantity, unitPrice, address, etc. Store `vendor_phone` (and optionally `inventory_id`) on the order when the selected price is from a vendor. |
| Notify vendor of new order | POST vendor API | After order + payment, `POST {VENDOR_API_BASE}/api/orders/create-from-main` with vendorPhone, productId, category, size, externalOrderId, shippingAddress, optional inventoryId, productName, productImageUrl, payoutCents. Response includes `orderId` (vendor order row id) — store it on the main-site order for cancellation. |
| Buyer cancels before vendor accepts | POST vendor API | While `vendor_orders.status` is still `pending`, call `POST {VENDOR_API_BASE}/api/orders/cancel-from-main` with JSON `{ "orderId": <vendor order id> }` (the `orderId` returned from create-from-main). Order becomes `rejected` with reason `cancelled_by_customer`; vendor sees it under Rejected and gets an in-app notification. If the order is not pending, the call returns `success: false` and does not change status. |

**Base URL:** Main site must have the vendor API base URL in env (e.g. `VENDOR_API_URL=https://vendor-api.example.com`). All routes above are relative to that base.

---

## 5. Product and Size Alignment

- **Product IDs:** Must match between main site and vendor (same ID for the same product).
- **Categories:** Use the same values (e.g. `sneakers`, `apparel`, `perfumes`, `watches`, `handbags`, `accessories`). Vendor API accepts singular/plural and normalizes.
- **Sizes:** Use a consistent format (e.g. `UK 5`, `UK5`, `M`, `OneSize`). Main site and vendor should normalize the same way (e.g. trim, same spacing) so that listing lookup and order creation match.

---

## 6. End-to-End Flow (Recap)

1. **Vendor lists price** (vendor app)  
   Vendor sets a product + size to **List now** with a listed price. That row in `vendor_inventory` has `listing_status = 'list_now'` and `listed_price_cents` set.

2. **Main site shows price**  
   On the product page (for the selected size), main site calls `GET /api/listings?productId=&category=&size=` and gets back `vendorListings`. It renders HOP logo + “Rs. {price}” for each entry in Compare Price.

3. **Customer orders on main site**  
   Main site creates its order, stores `vendor_phone` (and optionally `inventory_id`) from the selected listing, and after payment calls `POST /api/orders/create-from-main` with that data. Vendor API inserts into `vendor_orders` with `status = 'pending'`.

4. **Vendor sees and handles order**  
   Vendor dashboard loads `GET /api/orders?phone=...` and shows the order in **Your Orders → Pending**. Vendor can Accept → add tracking → mark delivered → verification, etc., as already implemented.

5. **No extra table on your side**  
   You only need `vendor_inventory` and `vendor_orders` in your DB. The main site uses your **API** for listings and for creating orders, so everything stays in sync and orders created on the main site appear correctly in your vendor dashboard.

---

## 7. Optional: Main Site Cache Table (Their DB)

If the main site wants to **cache** vendor prices (e.g. to avoid calling your API on every product view), they can maintain a table on **their** database, for example:

```sql
-- Optional: on MAIN SITE DB only (for caching vendor prices)
CREATE TABLE IF NOT EXISTS vendor_listings (
  id SERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  category TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT 'OneSize',
  vendor_id TEXT NOT NULL,
  vendor_name TEXT,
  price_cents BIGINT NOT NULL,
  inventory_id INTEGER,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_vendor_listings_product_size ON vendor_listings (product_id, category, size);
```

They would populate/update this table either by:

- Periodically calling your `GET /api/listings` per product/size and upserting into `vendor_listings`, or  
- If you add a “push” endpoint later, by you notifying their backend when a listing goes live or is updated.

This table is **optional** and is entirely on the main site side; you do not need to create or run it.

---

You can share this spec with the main website team so they implement the routes and fetching as above; on your side, you only need the tables you already have (`vendor_inventory`, `vendor_orders`) and the API you already expose (`GET /api/listings`, `POST /api/orders/create-from-main`). Orders created on the main site will then show up in your dashboard and everything will stay in sync.
