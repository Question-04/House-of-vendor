package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"vendor-api/internal/config"

	"github.com/jmoiron/sqlx"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// DB wraps sqlx.DB for vendor storage.
type DB struct {
	db *sqlx.DB
}

// dsnWithSimpleProtocol appends default_query_exec_mode=simple_protocol so pgx does not
// use prepared statements (avoids "unnamed prepared statement does not exist" with Neon).
func dsnWithSimpleProtocol(dsn string) string {
	simple := "default_query_exec_mode=simple_protocol"
	if strings.Contains(dsn, simple) {
		return dsn
	}
	if strings.Contains(dsn, "?") {
		return dsn + "&" + simple
	}
	return dsn + "?" + simple
}

// New creates a DB connection from config. Uses pgx with simple protocol to avoid
// prepared-statement errors when Neon (or proxy) recycles connections.
func New(cfg *config.Config) (*DB, error) {
	if cfg.DSN == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	dsn := dsnWithSimpleProtocol(cfg.DSN)
	database, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	if err := database.Ping(); err != nil {
		return nil, err
	}
	database.SetConnMaxLifetime(45 * time.Second)
	database.SetMaxIdleConns(2)
	database.SetMaxOpenConns(10)
	return &DB{db: sqlx.NewDb(database, "pgx")}, nil
}

// Close closes the database connection.
func (d *DB) Close() error {
	return d.db.Close()
}

// BeginTxx starts a transaction (used for atomic stock reserve + order insert).
func (d *DB) BeginTxx(ctx context.Context, opts *sql.TxOptions) (*sqlx.Tx, error) {
	return d.db.BeginTxx(ctx, opts)
}
