# Vendor Integration Prompt — Main Website (House of Plutus)

Use this document in **vendor-side Cursor** (or with your vendor dev team) to integrate the vendor website with our main marketplace: order flow, price display, and shared behaviour.

---

## 1. Overview

- **Main website**: Lists products; customers browse, select size, see compare price (House of Plutus + other sellers + **vendor prices**), add to bag, checkout. Order is created on our backend and payment is via PhonePe.
- **Vendor website**: Lists the same (or overlapping) products with **size-wise prices**. We want to show those prices on the main site in the “Compare Price” section (House of Plutus logo + vendor price). When a customer buys, the order must reach the correct vendor (e.g. accept/reject, fulfilment).
- **Shared DB**: Both sites can use the same database so product/price/order data is consistent.

---

## 2. How We Create and Store Orders

### 2.1 Frontend → Backend

Checkout calls our API:

- **Endpoint**: `POST /api/create-order`
- **Base URL**: `process.env.NEXT_PUBLIC_API_URL` (e.g. `http://localhost:8090` or production URL)

**Request body (JSON):**

```json
{
  "productId": "string (required)",
  "category": "string (required)",
  "size": "string",
  "quantity": 1,
  "unitPrice": 12345.00,
  "guestId": "string (optional, generated if missing)",
  "customerName": "string",
  "customerEmail": "string",
  "customerPhone": "string",
  "addressLine1": "string",
  "addressLine2": "string",
  "city": "string",
  "state": "string",
  "pincode": "string",
  "country": "string"
}
```

- **productId**: Our product ID (same as in your DB if shared).
- **category**: One of `sneaker`, `sneakers`, `accessory`, `accessories`, `apparel`, `perfume`, `perfumes`, `watch`, `watches`, `handbag`, `handbags`.
- **size**: Selected size (e.g. `"UK 5"`). Empty for categories without sizes.
- **unitPrice**: Price in INR (frontend sends selected size price). Backend uses this as fallback if server-side price lookup fails.
- **quantity**: Integer, default 1.

### 2.2 Backend: Order creation and ID

- **File**: `plutus-backend/server.go` → `createOrderHandler`
- **Order ID format**: `{categoryPrefix}{productPart}-{dateYYYYMMDD}-{randomHex6}`  
  Example: `SNK-ABC123-20250303-A1B2C3`
- **Generation**: `generateOrderID(category, productID)` — retries up to 3 times on duplicate.
- **Price resolution**: `getProductPrice(category, productID, size)`:
  - **Sneaker**: `getSneakerPrice` → MIN price across `sneaker_sellers.size_prices` for that product+size (or any size if empty).
  - **Apparel / Accessories**: MIN from `size_prices` JSONB for that product+size.
  - **Perfume**: MIN from `variants` for that product (+ size if used).
  - **Watch / Handbag**: Single `sale_price` (size ignored).
- If lookup fails and `unitPrice > 0`, backend uses client `unitPrice`.
- **Amount**: `amount_paise = round(price * quantity * 100)`.

### 2.3 Orders table (current schema)

```sql
orders (
  order_id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(80),
  guest_id VARCHAR(120),
  product_id VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  size VARCHAR(30),
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_paise BIGINT NOT NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(30),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(80),
  state VARCHAR(80),
  pincode VARCHAR(20),
  country VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  phonepe_order_id VARCHAR(100),
  phonepe_state VARCHAR(30),
  last_transaction_id VARCHAR(100),
  redirect_url TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

- **No `vendor_id` or `seller_id` yet.** To route orders to the right vendor you can:
  - **Option A**: Add `vendor_id` (or `seller_id`) to `orders` and have main backend set it from selected vendor/size when creating the order.
  - **Option B**: Use same DB; vendor site queries `orders` e.g. by `product_id`, `size`, `status`, or a mapping table that assigns orders to vendors.

### 2.4 After order creation

- Backend inserts order with `status = 'PENDING'`, then starts PhonePe payment (redirect URL includes `orderId`).
- On success we update `status` to `'PAID'` (and store PhonePe state/transaction id). Vendor side can poll or listen for new/updated orders (e.g. `status = 'PAID'`) and accept/reject.

---

## 3. How We Show Prices (Size-Wise and Multi-Vendor)

### 3.1 Sneakers

- **Source**: GraphQL `sneaker(id)` → `sellers[]` from table `sneaker_sellers`.
- **Shape**: Each seller has `id`, `sellerName`, `sellerUrl`, `productUrl`, `sizePrices: [{ size, price }]`.
- **Compare Price UI**:
  - **Vendor listings (from vendor website)**: One row per vendor that has a price for the **selected size**. Each row: House of Plutus logo + “Rs. {price}” (no “Enquire now”). If no vendor has a price for that size: single row with HOP logo + “ENQUIRE NOW”.
  - **Other sellers**: Rows with **their own** logo + “Rs. {price}” for selected size (unchanged; do not touch).
- So: **Vendor** = price shown under HOP branding. **Other seller** = own logo + own price.

### 3.2 Other categories (apparel, accessories, perfume, watch, handbag)

- **Apparel / Accessories**: One product row with `size_prices` JSONB (array of `{ size, price }`). Some have `seller_name`, `seller_url` (single “other” seller). Compare Price: same idea — **vendor listings** (HOP logo + price for selected size) then optional single “other seller” row (their logo + price).
- **Perfume**: `variants[]` with price (and optionally size). Same Compare Price behaviour for selected variant/size.
- **Watch / Handbag**: Single price per product; no size. Vendor listing = HOP logo + vendor price; else Enquire now.

### 3.3 Data contract for “vendor listings” on main site

We accept an array of vendor offerings for the **current product + selected size** (or single price for no-size categories):

```ts
vendorListings?: Array<{
  vendorId?: string;
  vendorName?: string;
  price: number;  // INR
}>;
```

- **One row per entry**: House of Plutus logo + “Rs. {price}”.
- **If `vendorListings` is empty or missing**: One HOP row with “ENQUIRE NOW”.
- **Multiple vendors for same size**: 3–4 (or more) such rows, one per vendor.
- Do **not** change existing “other seller” rows (they keep their own logo and price).

---

## 4. What the Vendor Website Must Provide (for integration)

### 4.1 Price feed (so we can show vendor price in Compare Price)

- **Option A — Same DB**: Main site (or a shared service) reads vendor prices from tables the vendor writes to, e.g.:
  - `vendor_listings(product_id, category, size, vendor_id, price)` or
  - Reuse/extend `sneaker_sellers` with a “vendor” flag and vendor_id.
- **Option B — API**: Vendor exposes e.g. `GET /api/product-price?productId=&size=` (or per-product endpoint) returning `{ price: number, vendorId?, vendorName? }`. Main backend calls it and passes `vendorListings` to the front.

### 4.2 Order acceptance (so order reaches the right vendor)

- When a customer buys on the **main** site, the main backend creates the order (and optionally sets `vendor_id` if we know which vendor for that product+size).
- **Vendor side** must:
  - **See the order**: e.g. read from shared `orders` (filter by `vendor_id` or by product/size mapping), or receive webhook from main backend.
  - **Accept or reject**: Update order or call back main API (e.g. set `vendor_status = 'ACCEPTED' | 'REJECTED'` or equivalent).
- If you use the **same DB**, vendor app can:
  - Query `orders` where `status = 'PAID'` and (e.g.) `vendor_id = :our_vendor_id`.
  - Update an `orders` column or a separate `vendor_orders` table with acceptance and fulfilment state.

### 4.3 Product/listing alignment

- Product IDs and categories must match between main and vendor (same IDs if shared DB).
- Sizes: we normalize for display (e.g. `UK 5`, `UK5`) so vendor should send sizes in a format we can match (see `normalizeSize` in our Compare Price code).

---

## 5. Main Website Code References (for vendor team)

| What | Where |
|------|--------|
| Create order API | `plutus-backend/server.go` → `createOrderHandler`, `generateOrderID`, `getProductPrice` |
| Order table creation | `plutus-backend/server.go` → `createAuthTables` (orders DDL) |
| Checkout (frontend) | `src/pages/checkout.tsx` → POST `/api/create-order` with productId, category, size, quantity, unitPrice, address… |
| Compare Price UI | `src/components/ProductPage/ComparePrice.tsx` |
| Vendor listings prop | `ComparePrice` accepts `vendorListings?: { vendorName?: string; price: number }[]` for HOP rows with price |
| Sneaker sellers (other sellers) | `sneaker_sellers` table; GraphQL `sneaker.sellers`; `ComparePrice` receives `sellers` and `selectedSize` |
| Price by category | `getProductPrice` → `getSneakerPrice`, `getSizePriceFromTable`, `getPerfumePrice`, `getScalarPrice` |

---

## 6. Summary Checklist for Vendor Integration

1. **Prices**: Provide size-wise (and product-wise) prices so the main site can show them in Compare Price (HOP logo + vendor price). Either same DB table or vendor API that main backend calls.
2. **Orders**: Main site creates order with `order_id`, `product_id`, `category`, `size`, `quantity`, `amount_paise`, customer and address. Add `vendor_id` (or equivalent) if you need to route to a specific vendor.
3. **Vendor side**: Read new/paid orders (same DB or webhook), implement accept/reject and fulfilment.
4. **Product/size alignment**: Use same product IDs and normalized size strings so prices and orders match.

### 6.1 Populating `vendorListings` on the main site

- **ProductPage** passes `vendorListings={product.vendorListings}` into **ProductActions** → **ComparePrice**.
- `vendorListings` should be **for the current product and selected size** (or single price for no-size categories). When the user changes size, the main site should pass the list of vendor offerings for that size (e.g. refetch or filter from a per-product vendor list).
- **Shape**: `Array<{ vendorId?: string; vendorName?: string; price: number }>`.
- **Source**: Same DB (e.g. query `vendor_listings` by `product_id` + `size`) or main backend calling vendor API and merging into the product object before rendering. For SSR, include in the product payload in `getServerSideProps` / GraphQL so `product.vendorListings` is set per product (and optionally recomputed when `selectedSize` changes on the client).

Use this prompt in the vendor-side Cursor so the vendor website can implement listing structure, price feed, and order handling in line with how our main website creates orders and shows vendor prices in the Compare Price section.
