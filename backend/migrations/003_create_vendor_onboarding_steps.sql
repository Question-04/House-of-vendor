-- Step 1: Profile setup details
CREATE TABLE IF NOT EXISTS vendor_profile_step (
    id                       BIGSERIAL PRIMARY KEY,
    vendor_user_id           BIGINT NOT NULL UNIQUE REFERENCES vendor_users(id) ON DELETE CASCADE,
    full_name                VARCHAR(120) NOT NULL DEFAULT '',
    email                    VARCHAR(255) NOT NULL DEFAULT '',
    primary_selling_category VARCHAR(120) NOT NULL DEFAULT '',
    other_categories         VARCHAR(255) NOT NULL DEFAULT '',
    city                     VARCHAR(120) NOT NULL DEFAULT '',
    state                    VARCHAR(120) NOT NULL DEFAULT '',
    full_address             VARCHAR(500) NOT NULL DEFAULT '',
    pincode                  VARCHAR(20) NOT NULL DEFAULT '',
    gst_registered           BOOLEAN NOT NULL DEFAULT FALSE,
    gst_number               VARCHAR(40) NOT NULL DEFAULT '',
    registered_firm_name     VARCHAR(255) NOT NULL DEFAULT '',
    step_status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at             TIMESTAMPTZ NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_profile_step_vendor_user_id
    ON vendor_profile_step(vendor_user_id);

-- Step 2: Verification status (placeholder for now)
CREATE TABLE IF NOT EXISTS vendor_verification_step (
    id             BIGSERIAL PRIMARY KEY,
    vendor_user_id BIGINT NOT NULL UNIQUE REFERENCES vendor_users(id) ON DELETE CASCADE,
    step_status    VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at   TIMESTAMPTZ NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_verification_step_vendor_user_id
    ON vendor_verification_step(vendor_user_id);

-- Step 3: Get-vouch status (placeholder for now)
CREATE TABLE IF NOT EXISTS vendor_vouch_step (
    id             BIGSERIAL PRIMARY KEY,
    vendor_user_id BIGINT NOT NULL UNIQUE REFERENCES vendor_users(id) ON DELETE CASCADE,
    step_status    VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at   TIMESTAMPTZ NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_vouch_step_vendor_user_id
    ON vendor_vouch_step(vendor_user_id);
