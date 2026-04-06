-- Stores successful phone OTP logins with a custom vendor code.
CREATE TABLE IF NOT EXISTS vendor_phone_login_success (
    id             BIGSERIAL PRIMARY KEY,
    vendor_user_id BIGINT NOT NULL REFERENCES vendor_users(id) ON DELETE CASCADE,
    phone          VARCHAR(20) NOT NULL UNIQUE,
    vendor_code    VARCHAR(6) NOT NULL UNIQUE,
    login_status   VARCHAR(20) NOT NULL DEFAULT 'success',
    login_source   VARCHAR(30) NOT NULL DEFAULT 'phone_otp',
    verified_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_phone_login_success_vendor_user_id
    ON vendor_phone_login_success(vendor_user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_phone_login_success_phone
    ON vendor_phone_login_success(phone);

COMMENT ON TABLE vendor_phone_login_success IS
    'Successful vendor logins via phone OTP with custom unique vendor code';
