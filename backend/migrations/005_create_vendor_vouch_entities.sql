CREATE TABLE IF NOT EXISTS vendor_vouch_links (
    id             BIGSERIAL PRIMARY KEY,
    vendor_user_id BIGINT NOT NULL UNIQUE REFERENCES vendor_users(id) ON DELETE CASCADE,
    share_token    VARCHAR(80) NOT NULL UNIQUE,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_vouch_links_vendor_user_id
    ON vendor_vouch_links(vendor_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_vouch_links_share_token
    ON vendor_vouch_links(share_token);

CREATE TABLE IF NOT EXISTS vendor_vouch_entries (
    id                   BIGSERIAL PRIMARY KEY,
    vendor_user_id       BIGINT NOT NULL REFERENCES vendor_users(id) ON DELETE CASCADE,
    voucher_name         VARCHAR(120) NOT NULL DEFAULT '',
    voucher_brand_name   VARCHAR(160) NOT NULL DEFAULT '',
    voucher_email        VARCHAR(255) NOT NULL DEFAULT '',
    voucher_phone        VARCHAR(20) NOT NULL DEFAULT '',
    source               VARCHAR(20) NOT NULL DEFAULT 'public_link',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (vendor_user_id, voucher_phone)
);

CREATE INDEX IF NOT EXISTS idx_vendor_vouch_entries_vendor_user_id
    ON vendor_vouch_entries(vendor_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_vouch_entries_voucher_phone
    ON vendor_vouch_entries(voucher_phone);
