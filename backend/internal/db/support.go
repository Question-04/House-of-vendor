package db

import (
	"context"
	"fmt"
	"time"

	"github.com/lib/pq"
)

type SupportTicketRow struct {
	ID          int            `db:"id" json:"id"`
	VendorPhone string         `db:"vendor_phone" json:"vendorPhone"`
	TicketCode  string         `db:"ticket_code" json:"ticketCode"`
	Category    string         `db:"category" json:"category"`
	OrderID     *string        `db:"order_id" json:"orderId"`
	Subject     string         `db:"subject" json:"subject"`
	Description string         `db:"description" json:"description"`
	Email       string         `db:"email" json:"email"`
	Priority    string         `db:"priority" json:"priority"`
	Status      string         `db:"status" json:"status"`
	DocURLs     pq.StringArray `db:"doc_urls" json:"docUrls"`
	CreatedAt   time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updatedAt"`
}

func (d *DB) ListSupportTickets(ctx context.Context, vendorPhone string) ([]SupportTicketRow, error) {
	query := `SELECT id, vendor_phone, ticket_code, category, order_id, subject, description, email, priority, status, doc_urls, created_at, updated_at FROM support_tickets WHERE vendor_phone = $1 ORDER BY created_at DESC`
	var rows []SupportTicketRow
	err := d.db.SelectContext(ctx, &rows, query, vendorPhone)
	return rows, err
}

func (d *DB) CreateSupportTicket(ctx context.Context, vendorPhone, category, orderID, subject, description, email, priority string) (*SupportTicketRow, error) {
	query := `INSERT INTO support_tickets (vendor_phone, ticket_code, category, order_id, subject, description, email, priority) VALUES ($1, '', $2, $3, $4, $5, $6, $7) RETURNING id, vendor_phone, ticket_code, category, order_id, subject, description, email, priority, status, doc_urls, created_at, updated_at`
	var row SupportTicketRow
	err := d.db.GetContext(ctx, &row, query, vendorPhone, category, nullStr(orderID), subject, description, email, priority)
	if err != nil {
		return nil, err
	}
	code := fmt.Sprintf("HV-%d", row.ID)
	_, err = d.db.ExecContext(ctx, `UPDATE support_tickets SET ticket_code = $1 WHERE id = $2`, code, row.ID)
	if err != nil {
		return nil, err
	}
	row.TicketCode = code
	return &row, nil
}

func (d *DB) AppendTicketDocURL(ctx context.Context, ticketID int, vendorPhone string, docURL string) error {
	query := `UPDATE support_tickets SET doc_urls = array_append(COALESCE(doc_urls, '{}'), $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND vendor_phone = $3`
	_, err := d.db.ExecContext(ctx, query, docURL, ticketID, vendorPhone)
	return err
}

func (d *DB) UpdateTicketStatus(ctx context.Context, ticketID int, status string) error {
	query := `UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`
	_, err := d.db.ExecContext(ctx, query, status, ticketID)
	return err
}

func (d *DB) GetTicketByID(ctx context.Context, id int) (*SupportTicketRow, error) {
	query := `SELECT id, vendor_phone, ticket_code, category, order_id, subject, description, email, priority, status, doc_urls, created_at, updated_at FROM support_tickets WHERE id = $1`
	var row SupportTicketRow
	err := d.db.GetContext(ctx, &row, query, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}
