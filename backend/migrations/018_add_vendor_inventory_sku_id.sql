-- Add shared SKU key for cross-source handbag matching.
ALTER TABLE public.vendor_inventory
  ADD COLUMN IF NOT EXISTS sku_id TEXT;

-- Normalize any existing values to uppercase alphanumeric only.
UPDATE public.vendor_inventory
SET sku_id = NULLIF(
  UPPER(regexp_replace(COALESCE(sku_id, ''), '[^A-Za-z0-9]+', '', 'g')),
  ''
)
WHERE sku_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_inventory_category_sku
  ON public.vendor_inventory (LOWER(TRIM(category)), sku_id);

COMMENT ON COLUMN public.vendor_inventory.sku_id IS
'Normalized shared SKU (uppercase alphanumeric) used for handbag cross-source compare rows.';
