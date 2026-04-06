-- Admin dashboard: audit log, KYC review fields, order payout release, product requests.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT '',
    resource_id TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log (action);

ALTER TABLE public.vendor_verification_step
    ADD COLUMN IF NOT EXISTS admin_kyc_decision TEXT,
    ADD COLUMN IF NOT EXISTS admin_kyc_notes TEXT,
    ADD COLUMN IF NOT EXISTS admin_kyc_reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_kyc_reviewed_by VARCHAR(320);

COMMENT ON COLUMN public.vendor_verification_step.admin_kyc_decision IS 'NULL = not reviewed; approved | rejected | needs_resubmit';

ALTER TABLE public.vendor_orders
    ADD COLUMN IF NOT EXISTS payout_released_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payout_released_by VARCHAR(320);

CREATE TABLE IF NOT EXISTS public.vendor_product_requests (
    id SERIAL PRIMARY KEY,
    vendor_phone VARCHAR(20) NOT NULL,
    product_name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_product_requests_status ON public.vendor_product_requests (status);
CREATE INDEX IF NOT EXISTS idx_vendor_product_requests_vendor_phone ON public.vendor_product_requests (vendor_phone);
CREATE INDEX IF NOT EXISTS idx_vendor_product_requests_created_at ON public.vendor_product_requests (created_at DESC);
