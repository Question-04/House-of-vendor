-- Idempotency for main-site retries:
-- a vendor + external order id should map to one vendor_orders row.

-- Clean up historical duplicates if any (keep oldest row per key).
DELETE FROM public.vendor_orders vo
USING public.vendor_orders dupe
WHERE vo.id > dupe.id
  AND vo.vendor_phone = dupe.vendor_phone
  AND vo.external_order_id = dupe.external_order_id;

-- Enforce uniqueness moving forward.
CREATE UNIQUE INDEX IF NOT EXISTS ux_vendor_orders_vendor_external
ON public.vendor_orders (vendor_phone, external_order_id);
