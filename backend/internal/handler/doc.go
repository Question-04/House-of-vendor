// Package handler implements HTTP API handlers for the vendor backend.
//
// # In-app notifications
//
// Notifications are append-only rows in vendor_notifications. Producers are the
// notify* helpers in vendor_notify.go, which enqueue events into
// vendor_notification_outbox. A background worker drains outbox rows into
// vendor_notifications with retry/backoff.
//
// Clients (vendor dashboard) load them via GET /api/notifications and poll on an
// interval. This “inbox + polling” pattern is common for B2B portals because it
// is simple to operate, cache-friendly, and works everywhere HTTP does.
//
// Compared with larger or consumer-scale systems, typical upgrades are:
//
//   - Full transactional outbox for every state mutation path: write business
//     state and outbox event in one DB transaction for strict atomicity.
//   - Real-time transport: Server-Sent Events or WebSockets for instant UI refresh
//     without polling.
//   - Mobile push: FCM (Android) / APNs (iOS) for alerts when the app is closed.
//   - Idempotency keys on partner webhooks (e.g. main-site order create) to dedupe
//     work when networks retry.
//
// This codebase reduces duplicate notifications in handlers by only emitting when
// relevant state actually changes (e.g. ticket status, verification_status).
package handler
