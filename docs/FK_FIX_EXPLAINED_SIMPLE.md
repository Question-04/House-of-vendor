# Why the “vendor_orders_inventory_id_fkey” Error Happens (Simple Explanation)

This doc explains in simple terms why the main site got a foreign key error when creating an order, and why the migration fixes it.

---

## 1. There are two different “IDs” in `vendor_inventory`

The table **vendor_inventory** (where you save each listing) has **two** number columns that look like IDs:

| Column name     | What it is              | Example value | Who uses it |
|-----------------|-------------------------|---------------|-------------|
| **id**          | Internal row number (auto) | 1, 2, 3, 4…   | Only the database |
| **inventory_id**| Your “listing number”   | 330849, 330850… | You, the API, and the main site |

- **id** = Postgres auto-increment. First row = 1, second = 2, third = 3, etc. We never show this to users or to the main site.
- **inventory_id** = The number you see in the vendor app (e.g. 330849). This is the one we use in the API and that the main site uses.

So for **one** listing we have:
- `id = 1` (internal)
- `inventory_id = 330849` (the one everyone sees and uses).

---

## 2. What the vendor API returns to the main site

When the main site calls **GET /api/listings** (to show your price in “Compare Price”), we return something like:

```json
{
  "vendorListings": [
    {
      "vendorId": "+919876543210",
      "vendorName": "House of Plutus",
      "price": 12999,
      "inventoryId": 330849
    }
  ]
}
```

We send **inventoryId: 330849** — that’s the **inventory_id** from the table (the “listing number”), **not** the internal **id** (1, 2, 3…).

So the main site only ever sees and stores **330849**.

---

## 3. What happens when the main site creates an order

When the customer checks out, the main site calls:

**POST /api/orders/create-from-main**

and sends back the same number it got from the listings API, for example:

```json
{
  "vendorPhone": "+919876543210",
  "inventoryId": 330849,
  "productId": "129",
  "category": "sneakers",
  "size": "UK 3",
  "externalOrderId": "SNK-129-20250306-X1Y2Z3",
  ...
}
```

So we receive **inventoryId: 330849** and insert it into the **vendor_orders** table in the column **vendor_orders.inventory_id**.

---

## 4. Why the error happened (old foreign key)

Originally, **vendor_orders** had a rule (foreign key) that said:

> “The value in **vendor_orders.inventory_id** must exist in **vendor_inventory.id**.”

So when we inserted **330849** into **vendor_orders.inventory_id**, Postgres did this check:

- Look in **vendor_inventory** for a row where **id = 330849**.

But in **vendor_inventory**:

- **id** is 1, 2, 3… (small numbers).
- **330849** is stored in **inventory_id**, not in **id**.

So there is **no** row with **id = 330849**. Postgres then says:

- “This value doesn’t exist in **vendor_inventory.id**” → **violates foreign key constraint vendor_orders_inventory_id_fkey**.

In short: we were storing the “listing number” (330849) but the database was checking it against the wrong column (the internal **id**), so it always failed.

---

## 5. What the fix does (new foreign key)

The migration does two things:

1. **Removes** the old rule that said:  
   `vendor_orders.inventory_id` must match `vendor_inventory.id`.

2. **Adds** a new rule:  
   `vendor_orders.inventory_id` must match **vendor_inventory.inventory_id**.

So now when we insert **330849** into **vendor_orders.inventory_id**, Postgres checks:

- Is there a row in **vendor_inventory** where **inventory_id = 330849**?

Yes — that’s exactly the column where 330849 lives. So the check passes and the order is created.

---

## 6. Summary in one sentence

- **Before:** We stored the listing number (330849) in **vendor_orders.inventory_id**, but the database was checking it against **vendor_inventory.id** (1, 2, 3…), so it always failed.
- **After:** The database checks **vendor_orders.inventory_id** against **vendor_inventory.inventory_id** (the same 330849), so it matches and the order is saved.

---

## 7. What you need to do

Run this SQL **once** in your Neon SQL editor (same as in `backend/migrations/009_vendor_orders_fk_inventory_id.sql`):

```sql
ALTER TABLE public.vendor_orders
  DROP CONSTRAINT IF EXISTS vendor_orders_inventory_id_fkey;

ALTER TABLE public.vendor_orders
  ADD CONSTRAINT vendor_orders_inventory_id_fkey
  FOREIGN KEY (inventory_id) REFERENCES public.vendor_inventory(inventory_id) ON DELETE SET NULL;
```

After that, the main site can keep sending the same **inventoryId** they get from **GET /api/listings** when they call create-from-main, and orders will be inserted into **vendor_orders** without the FK error.
