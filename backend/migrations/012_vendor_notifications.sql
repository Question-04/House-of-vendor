-- In-app vendor notifications + order cancellation context + catalog-added product requests.

CREATE TABLE IF NOT EXISTS public.vendor_notifications (
    id BIGSERIAL PRIMARY KEY,
    vendor_phone VARCHAR(20) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('order', 'verification', 'system')),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_notifications_phone_created
    ON public.vendor_notifications (vendor_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_notifications_unread
    ON public.vendor_notifications (vendor_phone)
    WHERE read_at IS NULL;

ALTER TABLE public.vendor_orders
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN public.vendor_orders.rejection_reason IS 'e.g. cancelled_by_customer when buyer cancels before vendor accepts';

-- Extend product request statuses for admin "added to catalog" flow
ALTER TABLE public.vendor_product_requests
    DROP CONSTRAINT IF EXISTS vendor_product_requests_status_check;

ALTER TABLE public.vendor_product_requests
    ADD CONSTRAINT vendor_product_requests_status_check
    CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'catalog_added'));
