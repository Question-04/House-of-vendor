# Your Orders (real data) and main site integration

## 1. Run the vendor_orders table (Neon)

In your **Neon Postgres SQL editor** (vendor DB), run the migration:

```bash
# File: backend/migrations/vendor_orders.sql
```

Copy the contents of `backend/migrations/vendor_orders.sql` and execute it. This creates `vendor_orders` with:

- `id`, `vendor_phone`, `inventory_id` (FK to `vendor_inventory`), `product_id`, `category`, `size`
- `product_name`, `product_image_url` (for display without joining catalog)
- `external_order_id` (order ID from main site), `order_date`, `shipping_address`
- `status`: `pending` | `waiting_pickup` | `in_transit` | `verification` | `completed` | `payment_pending` | `rejected`
- `shipping_partner`, `tracking_id`, `pickup_date`
- `verification_status`: `in_progress` | `real_and_authentic` | `rejected` | `needs_docs`
- `payout_cents`, `profit_loss_cents`, `payment_window_from`, `payment_window_to`, `payout_by`
- `reverification_doc_urls` (array of R2 URLs for upload-docs)
- `created_at`, `updated_at`

All state changes (accept, reject, add tracking, mark delivered, upload docs) are persisted in this table so progress is never lost.

**If create-from-main fails with “violates foreign key constraint vendor_orders_inventory_id_fkey”:** run the fix migration so `vendor_orders.inventory_id` references `vendor_inventory.inventory_id` (the business ID returned by the listings API), not `vendor_inventory.id`:

```bash
# File: backend/migrations/009_vendor_orders_fk_inventory_id.sql
```

Copy and run that SQL in Neon. Then the main site can send the same `inventoryId` they get from `GET /api/listings` when creating an order.

---

## 2. Vendor app – Orders page (real data)

- **Data source**: `GET /api/orders?phone=<vendor_phone>` returns all orders for that vendor. The UI buckets them by `status` for tabs (All, Pending, Waiting for pickup, In Transit, Verification, Completed, Payment Pending).
- **Actions** (all persist to DB):
  - **Accept** → `POST /api/orders/decision` with `decision: "accept"` → `status` becomes `waiting_pickup`.
  - **Reject** → `POST /api/orders/decision` with `decision: "reject"` → `status` becomes `rejected`.
  - **Add Tracking** (modal) → `POST /api/orders/tracking` with `shippingPartner`, `trackingId`, `pickupDate` → `status` becomes `in_transit`; `tracking_id` is shown on the card after that.
  - **Marked as delivered** → `POST /api/orders/mark-delivered` → `status` becomes `verification`; `verification_status` stays `in_progress` until your dashboard approves.
  - **Upload documents** (only when dashboard has set `verification_status` to `needs_docs` or `rejected`) → `POST /api/orders/upload-docs` (multipart: `phone`, `orderId`, `file`) → file is stored in R2 and URL appended to `reverification_doc_urls`.

**Verification behaviour**

- After “Marked as delivered”, the order appears in the **Verification** tab with **Verification Status: In progress** (not “Verified” yet).
- **Contact Support** and **Upload documents** are shown **only** when your dashboard has set that order’s `verification_status` to `needs_docs` or `rejected` (e.g. from an admin/dashboard you’ll build). They are **not** shown for every verification card.
- When your dashboard approves the item, set `verification_status` to `real_and_authentic` (e.g. `UPDATE vendor_orders SET verification_status = 'real_and_authentic' WHERE id = ?` or a small admin API). Then the card shows **Real & Authentic** and the tag becomes “Verified”. Later you can move the order to Completed and Payment Pending (e.g. with `status` and payment window fields).

---

## 3. Main site → Vendor: creating an order

When a customer places an order on the **main (House of Plutus) website** for a size/price that belongs to a vendor:

1. Main site backend creates its own order record.
2. Main site backend calls the **vendor API**:
   - `POST /api/orders/create-from-main`
   - Body (JSON):  
     `vendorPhone`, `inventoryId` (optional), `productId`, `category`, `size`, `productName`, `productImageUrl`, `externalOrderId`, `shippingAddress`, `payoutCents`
3. Vendor API inserts a row into `vendor_orders` with `status = 'pending'`.
4. The vendor then sees that order under **Your Orders → Pending** and can Accept or Reject.

So the main site must know the `vendor_phone` (and optionally `inventoryId`) for the listing that was sold; that’s the link between “customer bought this size from this vendor” and “create a pending order in the vendor app”.

---

## 4. Main site: showing HOP verified and vendor price

On the **main (consumer) website** you want to show, in the vendor/price section:

- **HOP logo** and **“HOP verified”** (or similar) text
- **Price** for that size from that vendor

How this fits with your existing schema:

- You have (or will have) something like `sneakers` (product) and `sneaker_sellers` (per-seller, with `size_prices` JSONB).
- When a vendor **lists** a price in the vendor app (Enter Details → List Now), the vendor backend should update the **main site DB** so that the correct row in `sneaker_sellers` (or equivalent) has that size’s price in `size_prices` and is clearly the “House of Plutus” vendor (so you can show “HOP verified” and your logo next to that price).

**Options:**

- **A. Same DB**: If the vendor API and the main site share one Postgres DB, the vendor backend can write directly to `sneaker_sellers` (or the table that holds size–price per seller) when listing status is `list_now` and when an item is marked sold.
- **B. Separate DBs**: Vendor API exposes an internal endpoint (e.g. `POST /api/internal/update-listing-price`) that the main site backend calls (or that the vendor backend calls with product/size/price). The main site backend then updates its own DB (e.g. `sneaker_sellers.size_prices`).

On the **main site frontend**, in the product/vendor section:

- For the row that corresponds to “House of Plutus” (or the vendor that’s linked to the vendor app), render:
  - HOP logo
  - “HOP verified” (or “Verified”) text
  - The price for that size from `size_prices` (or equivalent)

So: **backend** keeps “who is selling at what price” and “HOP verified” flag in sync; **frontend** just reads that and shows logo + “HOP verified” + price.

---

## 5. Fast, integrated flow (summary)

1. **Vendor lists price** (vendor app) → vendor backend updates main site’s seller/price data (same DB or internal API) so the main site shows that size’s price with HOP logo and “HOP verified”.
2. **Customer orders on main site** → main site backend creates its order and calls `POST /api/orders/create-from-main` with vendor phone and order details → vendor sees it in **Pending**.
3. **Vendor accepts** → status moves to **Waiting for pickup**; vendor adds tracking → **In Transit**; vendor marks delivered → **Verification** (In progress).
4. **Your dashboard** (later) sets `verification_status` to `real_and_authentic` (or `needs_docs`/`rejected` if you need docs) → vendor app shows “Real & Authentic” and only shows Contact Support / Upload documents when you’ve flagged it.
5. When you’re ready, you can add flows that set `status` to `completed` and then `payment_pending` with payment window dates; the existing `vendor_orders` columns are already there for that.

All of this uses the same `vendor_orders` table and the same APIs; nothing is lost between steps because every action updates the DB and the UI refetches or refreshes from the list endpoint.
