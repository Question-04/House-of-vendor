ALTER TABLE public.vendor_vouch_step
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS review_decided_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS reapply_after TIMESTAMPTZ NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'vendor_vouch_step_review_status_check'
    ) THEN
        ALTER TABLE public.vendor_vouch_step
        ADD CONSTRAINT vendor_vouch_step_review_status_check
        CHECK (review_status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;
