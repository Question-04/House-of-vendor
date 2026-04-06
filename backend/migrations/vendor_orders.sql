-- Run this in your Neon Postgres SQL editor (vendor DB).
-- Vendor orders: one row per order from main site, with status and timestamps.

CREATE TABLE IF NOT EXISTS public.vendor_orders (
    id SERIAL PRIMARY KEY,
    vendor_phone VARCHAR(20) NOT NULL,
    inventory_id INTEGER REFERENCES public.vendor_inventory(id) ON DELETE SET NULL,
    product_id TEXT NOT NULL,
    category TEXT NOT NULL,
    size TEXT NOT NULL DEFAULT 'OneSize',
    product_name TEXT,
    product_image_url TEXT,
    external_order_id TEXT NOT NULL,
    order_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shipping_address TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'waiting_pickup', 'in_transit', 'verification', 'completed', 'payment_pending', 'rejected'
    )),
    shipping_partner TEXT,
    tracking_id TEXT,
    pickup_date TIMESTAMPTZ,
    verification_status TEXT DEFAULT 'in_progress' CHECK (verification_status IN (
        'in_progress', 'real_and_authentic', 'rejected', 'needs_docs'
    )),
    payout_cents BIGINT,
    profit_loss_cents BIGINT,
    payment_window_from DATE,
    payment_window_to DATE,
    payout_by TEXT,
    reverification_doc_urls TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_orders_vendor_phone ON public.vendor_orders (vendor_phone);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_status ON public.vendor_orders (status);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_external_order_id ON public.vendor_orders (external_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_created_at ON public.vendor_orders (created_at DESC);

COMMENT ON COLUMN public.vendor_orders.verification_status IS 'in_progress until dashboard approves; real_and_authentic when approved; needs_docs/rejected when dashboard requests docs';
