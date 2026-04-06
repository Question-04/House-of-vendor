-- Stock per listing row: decremented atomically when main site calls create-from-main.
-- Run in Neon SQL editor after prior vendor migrations.

ALTER TABLE public.vendor_inventory
  ADD COLUMN IF NOT EXISTS quantity_remaining INTEGER;

-- Backfill from product_qty (leading integer) or 1
UPDATE public.vendor_inventory vi
SET quantity_remaining = subq.q
FROM (
  SELECT id,
    CASE
      WHEN product_qty IS NULL OR btrim(product_qty::text) = '' THEN 1
      WHEN btrim(product_qty::text) ~ '^[0-9]+$' THEN btrim(product_qty::text)::integer
      WHEN btrim(product_qty::text) ~ '^[0-9]+' THEN (regexp_match(btrim(product_qty::text), '^([0-9]+)'))[1]::integer
      ELSE 1
    END AS q
  FROM public.vendor_inventory
) subq
WHERE vi.id = subq.id AND vi.quantity_remaining IS NULL;

UPDATE public.vendor_inventory
SET quantity_remaining = 1
WHERE quantity_remaining IS NULL OR quantity_remaining < 1;

ALTER TABLE public.vendor_inventory
  ALTER COLUMN quantity_remaining SET NOT NULL,
  ALTER COLUMN quantity_remaining SET DEFAULT 1;

ALTER TABLE public.vendor_inventory
  DROP CONSTRAINT IF EXISTS vendor_inventory_quantity_remaining_nonneg;

ALTER TABLE public.vendor_inventory
  ADD CONSTRAINT vendor_inventory_quantity_remaining_nonneg CHECK (quantity_remaining >= 0);

COMMENT ON COLUMN public.vendor_inventory.quantity_remaining IS 'Units left for this listing; listing hidden from /api/listings when 0 or sold_out.';

-- Line quantity (main site usually 1; reserved stock is decremented by this amount)
ALTER TABLE public.vendor_orders
  ADD COLUMN IF NOT EXISTS order_quantity INTEGER DEFAULT 1;

UPDATE public.vendor_orders SET order_quantity = 1 WHERE order_quantity IS NULL;

ALTER TABLE public.vendor_orders
  ALTER COLUMN order_quantity SET NOT NULL,
  ALTER COLUMN order_quantity SET DEFAULT 1;

ALTER TABLE public.vendor_orders DROP CONSTRAINT IF EXISTS vendor_orders_order_quantity_check;
ALTER TABLE public.vendor_orders
  ADD CONSTRAINT vendor_orders_order_quantity_check CHECK (order_quantity > 0 AND order_quantity <= 1000);

COMMENT ON COLUMN public.vendor_orders.order_quantity IS 'Units sold on this order; stock was decremented by this amount at create-from-main when inventoryId was sent.';
