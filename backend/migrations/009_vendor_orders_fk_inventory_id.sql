-- Fix: vendor_orders.inventory_id should reference vendor_inventory.inventory_id (the business ID),
-- not vendor_inventory.id (SERIAL). The API returns inventory_id (e.g. 330849); main site sends it
-- back on create-from-main, so the FK must match that column.
-- Run this in your Neon SQL editor.

ALTER TABLE public.vendor_orders
  DROP CONSTRAINT IF EXISTS vendor_orders_inventory_id_fkey;

ALTER TABLE public.vendor_orders
  ADD CONSTRAINT vendor_orders_inventory_id_fkey
  FOREIGN KEY (inventory_id) REFERENCES public.vendor_inventory(inventory_id) ON DELETE SET NULL;
