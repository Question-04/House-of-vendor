package db

import (
	"crypto/rand"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"
)

// User (vendor) stored by phone.
type User struct {
	ID        int64     `db:"id"`
	Phone     string    `db:"phone"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

// PhoneLoginSuccess stores successful OTP login details.
type PhoneLoginSuccess struct {
	ID           int64     `db:"id"`
	VendorUserID int64     `db:"vendor_user_id"`
	Phone        string    `db:"phone"`
	VendorCode   string    `db:"vendor_code"`
	LoginStatus  string    `db:"login_status"`
	LoginSource  string    `db:"login_source"`
	VerifiedAt   time.Time `db:"verified_at"`
	CreatedAt    time.Time `db:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"`
}

// CreateUser inserts a new vendor user by phone. Idempotent: returns existing if phone exists.
func (d *DB) CreateUser(ctx context.Context, phone string) (*User, error) {
	var u User
	err := d.db.GetContext(ctx, &u,
		`SELECT id, phone, created_at, updated_at FROM vendor_users WHERE phone = $1`,
		phone,
	)
	if err == nil {
		return &u, nil
	}
	if err != sql.ErrNoRows {
		return nil, err
	}
	err = d.db.QueryRowContext(ctx,
		`INSERT INTO vendor_users (phone, created_at, updated_at) VALUES ($1, $2, $2) RETURNING id, phone, created_at, updated_at`,
		phone, time.Now(),
	).Scan(&u.ID, &u.Phone, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// GetUserByPhone returns user by phone.
func (d *DB) GetUserByPhone(ctx context.Context, phone string) (*User, error) {
	var u User
	err := d.db.GetContext(ctx, &u,
		`SELECT id, phone, created_at, updated_at FROM vendor_users WHERE phone = $1`,
		phone,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// RecordPhoneLoginSuccess stores (or updates) a successful phone OTP login row.
func (d *DB) RecordPhoneLoginSuccess(ctx context.Context, phone string) (*PhoneLoginSuccess, error) {
	user, err := d.CreateUser(ctx, phone)
	if err != nil {
		return nil, err
	}

	const maxAttempts = 10
	for i := 0; i < maxAttempts; i++ {
		code, err := generateVendorCode()
		if err != nil {
			return nil, err
		}

		var row PhoneLoginSuccess
		now := time.Now()
		err = d.db.QueryRowContext(ctx, `
			INSERT INTO vendor_phone_login_success
				(vendor_user_id, phone, vendor_code, login_status, login_source, verified_at, created_at, updated_at)
			VALUES
				($1, $2, $3, 'success', 'phone_otp', $4, $4, $4)
			ON CONFLICT (phone) DO UPDATE
			SET
				vendor_user_id = EXCLUDED.vendor_user_id,
				login_status = 'success',
				login_source = 'phone_otp',
				verified_at = EXCLUDED.verified_at,
				updated_at = EXCLUDED.updated_at
			RETURNING id, vendor_user_id, phone, vendor_code, login_status, login_source, verified_at, created_at, updated_at
		`, user.ID, phone, code, now).Scan(
			&row.ID,
			&row.VendorUserID,
			&row.Phone,
			&row.VendorCode,
			&row.LoginStatus,
			&row.LoginSource,
			&row.VerifiedAt,
			&row.CreatedAt,
			&row.UpdatedAt,
		)
		if err == nil {
			return &row, nil
		}

		if isUniqueCodeConflict(err) {
			continue
		}
		return nil, err
	}

	return nil, fmt.Errorf("could not generate unique vendor code after retries")
}

func generateVendorCode() (string, error) {
	// 6-char code: 3 letters + 3 digits, e.g. ABC123.
	letters := "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	digits := "0123456789"
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}

	return string([]byte{
		letters[int(buf[0])%len(letters)],
		letters[int(buf[1])%len(letters)],
		letters[int(buf[2])%len(letters)],
		digits[int(buf[3])%len(digits)],
		digits[int(buf[4])%len(digits)],
		digits[int(buf[5])%len(digits)],
	}), nil
}

func isUniqueCodeConflict(err error) bool {
	var pqErr *pq.Error
	if !errors.As(err, &pqErr) {
		return false
	}
	// PostgreSQL unique violation and the vendor_code unique index/constraint.
	if pqErr.Code != "23505" {
		return false
	}
	return pqErr.Constraint == "vendor_phone_login_success_vendor_code_key"
}
