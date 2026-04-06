-- Run this in your Neon Postgres SQL editor.
-- 1) Product review requests (add product not found in search) - already may exist as 007.
-- 2) Vendor inventory (after Enter Details; listing_status = save_for_later | list_now).

-- ========== 1. Product review requests ==========
CREATE TABLE IF NOT EXISTS public.product_review_requests (
    id SERIAL PRIMARY KEY,
    product_name TEXT,
    category TEXT NOT NULL,
    product_link TEXT NOT NULL,
    description TEXT,
    image_urls TEXT[] DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_review_requests_status ON public.product_review_requests (status);
CREATE INDEX IF NOT EXISTS idx_product_review_requests_created_at ON public.product_review_requests (created_at);

-- ========== 2. Vendor inventory ==========
CREATE TABLE IF NOT EXISTS public.vendor_inventory (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL UNIQUE,
    vendor_phone VARCHAR(20) NOT NULL,
    product_id TEXT NOT NULL,
    category TEXT NOT NULL,
    size TEXT NOT NULL DEFAULT 'OneSize',
    purchase_price_cents BIGINT,
    desired_payout_cents BIGINT,
    listed_price_cents BIGINT,
    final_payout_cents BIGINT,
    profit_loss_cents BIGINT,
    pair_location TEXT,
    availability TEXT,
    box_condition TEXT,
    product_qty TEXT,
    purchase_date DATE,
    place_of_purchase TEXT,
    listing_status TEXT NOT NULL DEFAULT 'save_for_later' CHECK (listing_status IN ('save_for_later', 'list_now')),
    sold_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_inventory_vendor_phone ON public.vendor_inventory (vendor_phone);
CREATE INDEX IF NOT EXISTS idx_vendor_inventory_product ON public.vendor_inventory (vendor_phone, product_id, category);
CREATE INDEX IF NOT EXISTS idx_vendor_inventory_listing_status ON public.vendor_inventory (listing_status);
CREATE INDEX IF NOT EXISTS idx_vendor_inventory_inventory_id ON public.vendor_inventory (inventory_id);

CREATE SEQUENCE IF NOT EXISTS vendor_inventory_id_seq START 330849;
