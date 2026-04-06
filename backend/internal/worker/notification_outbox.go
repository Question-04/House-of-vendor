package worker

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"vendor-api/internal/db"
)

type NotificationOutboxWorker struct {
	db            *db.DB
	batchSize     int
	pollInterval  time.Duration
	emptyInterval time.Duration
}

func NewNotificationOutboxWorker(database *db.DB) *NotificationOutboxWorker {
	return &NotificationOutboxWorker{
		db:            database,
		batchSize:     100,
		pollInterval:  1200 * time.Millisecond,
		emptyInterval: 2500 * time.Millisecond,
	}
}

func (w *NotificationOutboxWorker) Run(ctx context.Context) {
	log.Printf("[outbox] notification worker started")
	defer log.Printf("[outbox] notification worker stopped")

	timer := time.NewTimer(0)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}

		processed, err := w.processOnce(ctx)
		if err != nil {
			log.Printf("[outbox] process batch error: %v", err)
			timer.Reset(w.emptyInterval)
			continue
		}
		if processed == 0 {
			timer.Reset(w.emptyInterval)
			continue
		}
		timer.Reset(w.pollInterval)
	}
}

func (w *NotificationOutboxWorker) processOnce(ctx context.Context) (int, error) {
	rows, err := w.db.ClaimVendorNotificationOutboxBatch(ctx, w.batchSize)
	if err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}

	for _, row := range rows {
		meta := map[string]interface{}{}
		if len(row.Meta) > 0 {
			if err := jsonUnmarshal(row.Meta, &meta); err != nil {
				log.Printf("[outbox] meta decode failed for outbox id=%d: %v", row.ID, err)
				_ = w.db.RescheduleVendorNotificationOutbox(ctx, row.ID, row.Attempts, err)
				continue
			}
		}
		if err := w.db.InsertVendorNotification(ctx, row.VendorPhone, row.Category, row.Kind, row.Title, row.Body, meta); err != nil {
			log.Printf("[outbox] insert vendor_notification failed for outbox id=%d: %v", row.ID, err)
			_ = w.db.RescheduleVendorNotificationOutbox(ctx, row.ID, row.Attempts, err)
			continue
		}
		if err := w.db.MarkVendorNotificationOutboxProcessed(ctx, row.ID); err != nil {
			log.Printf("[outbox] mark processed failed for outbox id=%d: %v", row.ID, err)
			_ = w.db.RescheduleVendorNotificationOutbox(ctx, row.ID, row.Attempts, err)
			continue
		}
	}
	return len(rows), nil
}

// Kept as var for tiny testability seam without introducing interfaces.
var jsonUnmarshal = func(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}
