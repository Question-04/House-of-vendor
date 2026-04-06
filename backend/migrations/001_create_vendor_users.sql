-- Table for vendor users (login by phone + OTP).
-- Run this against your PostgreSQL database before starting the API.

CREATE TABLE IF NOT EXISTS vendor_users (
    id         BIGSERIAL PRIMARY KEY,
    phone      VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_users_phone ON vendor_users(phone);

COMMENT ON TABLE vendor_users IS 'Vendor users who log in via OTP on phone';
