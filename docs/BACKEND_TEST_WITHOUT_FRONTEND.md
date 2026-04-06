# Testing the Backend Without the Frontend

Use these methods to verify your vendor API is running and responding. Default port is **8080** (or set `PORT` in `.env`). Replace `localhost:8080` with your server URL if different.

---

## 1. Health check (no DB needed)

If the server is running, this returns immediately:

```bash
curl http://localhost:8080/api/health
```

**Expected:** `{"status":"ok"}`

---

## 2. GET endpoints (browser or curl)

Open in browser or use curl. These only **read** data.

| What | URL (browser or curl) |
|------|------------------------|
| Health | `http://localhost:8080/api/health` |
| Listings (main site price feed) | `http://localhost:8080/api/listings?productId=129&category=sneakers&size=UK%203` |
| Orders for a vendor | `http://localhost:8080/api/orders?phone=9876543210` |
| Category products | `http://localhost:8080/api/products/category/sneakers?limit=12&offset=0` |
| Search overlay | `http://localhost:8080/api/search/overlay?q=nike&limit=24&offset=0` |
| Featured brands | `http://localhost:8080/api/brands/featured` |

**Examples:**

```bash
# Health
curl http://localhost:8080/api/health

# Listings (productId=129, UK 3; needs productId + category; size optional)
curl "http://localhost:8080/api/listings?productId=129&category=sneakers&size=UK%203"

# Orders (needs phone query param)
curl "http://localhost:8080/api/orders?phone=9876543210"

# Category page
curl "http://localhost:8080/api/products/category/sneakers?limit=12&offset=0"
```

- **Listings:** Returns `{"success":true,"vendorListings":[...]}`. Empty array if no live listings for that product/size.
- **Orders:** Returns `{"success":true,"orders":[...]}`. Needs valid `phone`; returns 400 if missing.
- **Products/category:** Depends on DB (sneakers, apparel, etc. tables). 500 if DB not connected.

---

## 3. POST endpoints (curl with JSON)

Use `-X POST` and `-H "Content-Type: application/json"` with `-d '{"key":"value"}'`.

### Create order from main site (no auth)

Example for **product ID 10, UK size 2.5**:

```bash
curl -X POST http://localhost:8080/api/orders/create-from-main \
  -H "Content-Type: application/json" \
  -d '{
    "vendorPhone": "9876543210",
    "productId": "10",
    "category": "sneakers",
    "size": "UK 2.5",
    "externalOrderId": "SNK-10-20250306-ABC123",
    "productName": "Test Sneaker",
    "shippingAddress": "123 Test St",
    "payoutCents": 100000
  }'
```

**Expected:** `{"success":true,"orderId":<number>}`

Then check that the order appears for that vendor:

```bash
curl "http://localhost:8080/api/orders?phone=9876543210"
```

---

## 4. Quick “is it working?” checklist

1. Start backend: `cd backend && go run ./cmd/server` (or your usual command).
2. Run: `curl http://localhost:8080/api/health` → should get `{"status":"ok"}`.
3. If you get “Connection refused”, the server isn’t running or is on a different port (check `PORT` in `.env`).
4. For endpoints that use the DB (listings, orders, products), ensure Neon (or your DB) is reachable and env vars (`DATABASE_URL` or similar) are set; otherwise you may get 500 errors.

---

## 5. Optional: save responses to a file

```bash
curl -s http://localhost:8080/api/health | jq .
curl -s "http://localhost:8080/api/orders?phone=9876543210" | jq .
```

(`jq` pretty-prints JSON; omit `| jq .` if you don’t have it.)
