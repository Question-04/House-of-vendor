-- Durable async notification outbox with retry metadata.
-- Run this migration before deploying the outbox worker.

CREATE TABLE IF NOT EXISTS public.vendor_notification_outbox (
    id BIGSERIAL PRIMARY KEY,
    vendor_phone VARCHAR(20) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('order', 'verification', 'system')),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    meta JSONB NOT NULL DEFAULT '{}',
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_notification_outbox_pending
    ON public.vendor_notification_outbox (available_at, id)
    WHERE processed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_notification_outbox_phone
    ON public.vendor_notification_outbox (vendor_phone, created_at DESC);
