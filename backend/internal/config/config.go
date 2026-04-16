package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port              string
	AppEnv            string
	DBDriver          string
	DSN               string
	MSG91AuthKey      string
	R2AccountID       string
	R2Bucket          string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Region          string
	R2Endpoint        string
	R2PublicBaseURL   string
	FrontendBaseURL   string
	DevFileAccessKey  string
	// Magic OTP: when set, this OTP always passes verification (for testing without SMS).
	// Leave empty in production. Example: "123456"
	MagicOTP       string
	EnableMagicOTP bool
	// Admin dashboard: HS256 JWT (minted by Next.js BFF) and optional comma-separated emails.
	AdminJWTSecret       string
	AdminEmailAllowlist  string
	AdminPhoneAllowlist  string
	AdminInternalSecret  string // optional; X-Admin-Internal-Secret for trusted callers (not browser)
	// When set, CORS Allow-Origin is this value instead of * (tighten browser access to the API).
	AdminCORSOrigin string
	// Handbag integration controls.
	HOPAdminVendorPhone string
}

func Load() *Config {
	magic, _ := strconv.ParseBool(os.Getenv("ENABLE_MAGIC_OTP"))
	return &Config{
		Port:              getEnv("PORT", "8080"),
		AppEnv:            getEnv("APP_ENV", "development"),
		DBDriver:          getEnv("DB_DRIVER", "postgres"),
		DSN:               getEnv("DATABASE_URL", ""),
		MSG91AuthKey:      os.Getenv("MSG91_AUTH_KEY"),
		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Region:          getEnv("R2_REGION", "auto"),
		R2Endpoint:        os.Getenv("R2_ENDPOINT"),
		R2PublicBaseURL:   os.Getenv("R2_PUBLIC_BASE_URL"),
		FrontendBaseURL:   getEnv("FRONTEND_BASE_URL", "http://localhost:3000"),
		DevFileAccessKey:  os.Getenv("DEV_FILE_ACCESS_KEY"),
		MagicOTP:          os.Getenv("MAGIC_OTP"), // e.g. 123456 for testing
		EnableMagicOTP:    magic,
		AdminJWTSecret:    os.Getenv("ADMIN_JWT_SECRET"),
		AdminEmailAllowlist: os.Getenv("ADMIN_EMAIL_ALLOWLIST"),
		AdminPhoneAllowlist: os.Getenv("ADMIN_PHONE_ALLOWLIST"),
		AdminInternalSecret: os.Getenv("ADMIN_INTERNAL_SECRET"),
		AdminCORSOrigin:     strings.TrimSpace(os.Getenv("ADMIN_CORS_ORIGIN")),
		HOPAdminVendorPhone: strings.TrimSpace(os.Getenv("HOP_ADMIN_VENDOR_PHONE")),
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
