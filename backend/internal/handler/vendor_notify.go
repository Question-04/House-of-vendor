package handler

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"

	"vendor-api/internal/db"
)

func orderIDSuffix(id int) string {
	s := strconv.Itoa(id)
	if len(s) <= 4 {
		return s
	}
	return s[len(s)-4:]
}

func productLabel(name *string, productID string) string {
	if name != nil && strings.TrimSpace(*name) != "" {
		return strings.TrimSpace(*name)
	}
	return productID
}

// verificationStatusNorm matches DB defaults: empty/null means in_progress.
func verificationStatusNorm(v *string) string {
	if v == nil || strings.TrimSpace(*v) == "" {
		return "in_progress"
	}
	return strings.TrimSpace(strings.ToLower(*v))
}

// notifyOrderNew logs errors only; never fails the caller.
func notifyOrderNew(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("New order #%s", sfx)
	p := productLabel(row.ProductName, row.ProductID)
	body := fmt.Sprintf("Cha-ching! Someone wants your %s. Time to peek at Pending and maybe do a happy dance.", p)
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "pending",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_new", title, body, meta); err != nil {
		log.Printf("[notify] order_new: %v", err)
	}
}

func notifyOrderCustomerCancelled(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("Order #%s cancelled by customer", sfx)
	body := "Plot twist: the buyer bailed before you accepted. The order’s in Rejected — no hard feelings, the universe is just quirky like that."
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "rejected",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_customer_cancelled", title, body, meta); err != nil {
		log.Printf("[notify] order_customer_cancelled: %v", err)
	}
}

func notifyOrderAdminCancelled(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("Order #%s cancelled by our team", sfx)
	body := "Our admin team marked this order as cancelled. Check Rejected for details — sometimes we have to hit pause."
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "rejected",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_admin_cancelled", title, body, meta); err != nil {
		log.Printf("[notify] order_admin_cancelled: %v", err)
	}
}

func notifyOrderVerificationNeedsDocs(ctx context.Context, database *db.DB, vendorPhone string, orderID int, productName *string, productID string) {
	sfx := orderIDSuffix(orderID)
	title := fmt.Sprintf("Order #%s needs more detail", sfx)
	p := productLabel(productName, productID)
	body := fmt.Sprintf("We need a bit more paperwork for %s (order #%s). Don’t be shy — upload those docs so we can keep the story going.", p, sfx)
	meta := map[string]interface{}{
		"orderId": orderID, "nav": "orders", "tab": "under_verification",
	}
	if err := database.EnqueueVendorNotification(ctx, vendorPhone, "verification", "verification_needs_docs", title, body, meta); err != nil {
		log.Printf("[notify] verification_needs_docs: %v", err)
	}
}

func notifyOrderVerificationApproved(ctx context.Context, database *db.DB, vendorPhone string, orderID int, productName *string, productID string) {
	sfx := orderIDSuffix(orderID)
	title := fmt.Sprintf("Order #%s passed verification", sfx)
	p := productLabel(productName, productID)
	body := fmt.Sprintf("High five! %s (order #%s) passed our vibe check and is verified. Onward to payment-land.", p, sfx)
	meta := map[string]interface{}{
		"orderId": orderID, "nav": "orders", "tab": "payment_pending",
	}
	if err := database.EnqueueVendorNotification(ctx, vendorPhone, "verification", "verification_passed", title, body, meta); err != nil {
		log.Printf("[notify] verification_passed: %v", err)
	}
}

func notifyOrderVerificationRejectedByTeam(ctx context.Context, database *db.DB, vendorPhone string, orderID int, productName *string, productID string) {
	sfx := orderIDSuffix(orderID)
	title := fmt.Sprintf("Order #%s rejected in verification", sfx)
	p := productLabel(productName, productID)
	body := fmt.Sprintf("Our team couldn’t verify %s (order #%s). Check the order for next steps.", p, sfx)
	meta := map[string]interface{}{
		"orderId": orderID, "nav": "orders", "tab": "under_verification",
	}
	if err := database.EnqueueVendorNotification(ctx, vendorPhone, "verification", "verification_rejected_team", title, body, meta); err != nil {
		log.Printf("[notify] verification_rejected_team: %v", err)
	}
}

func notifyTicketCreated(ctx context.Context, database *db.DB, ticket *db.SupportTicketRow) {
	if ticket == nil {
		return
	}
	title := fmt.Sprintf("Ticket %s received", ticket.TicketCode)
	body := "Your support ticket is in our inbox. We’ve seen it, we’ve nodded seriously — the team will take it from here."
	meta := map[string]interface{}{
		"ticketId": ticket.ID, "nav": "support", "tab": "my_tickets",
	}
	if err := database.EnqueueVendorNotification(ctx, ticket.VendorPhone, "system", "ticket_created", title, body, meta); err != nil {
		log.Printf("[notify] ticket_created: %v", err)
	}
}

func notifyTicketStatus(ctx context.Context, database *db.DB, vendorPhone, ticketCode string, ticketID int, status string) {
	var title, body string
	switch status {
	case "Open":
		title = fmt.Sprintf("Ticket %s is open", ticketCode)
		body = "Your ticket is officially open — like a fresh tab you swear you’ll close later."
	case "In Progress":
		title = fmt.Sprintf("Ticket %s in progress", ticketCode)
		body = "We’re on it! Your ticket moved to In Progress — humans are poking the right buttons."
	case "Resolved":
		title = fmt.Sprintf("Ticket %s resolved", ticketCode)
		body = "Good news: we marked your ticket resolved. If anything still feels off, you know where to find us."
	case "Closed":
		title = fmt.Sprintf("Ticket %s closed", ticketCode)
		body = "This ticket is closed — mic drop, curtain call. Thanks for hanging in there!"
	default:
		return
	}
	meta := map[string]interface{}{"ticketId": ticketID, "nav": "support", "tab": "my_tickets"}
	if err := database.EnqueueVendorNotification(ctx, vendorPhone, "system", "ticket_status_"+strings.ToLower(strings.ReplaceAll(status, " ", "_")), title, body, meta); err != nil {
		log.Printf("[notify] ticket_status: %v", err)
	}
}

func notifyProductCatalogAdded(ctx context.Context, database *db.DB, vendorPhone, productName string, requestID int) {
	title := "Your product request hit the catalog"
	body := fmt.Sprintf("Nice! \"%s\" was added as you asked. Go hunt for it in search — it’s out there living its best life.", productName)
	meta := map[string]interface{}{"productRequestId": requestID, "nav": "add-product"}
	if err := database.EnqueueVendorNotification(ctx, vendorPhone, "system", "product_catalog_added", title, body, meta); err != nil {
		log.Printf("[notify] product_catalog_added: %v", err)
	}
}

func notifyOrderAccepted(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("Order #%s accepted", sfx)
	p := productLabel(row.ProductName, row.ProductID)
	body := fmt.Sprintf("You’re on! %s is in Waiting for pickup — add tracking when it ships.", p)
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "waiting_pickup",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_accepted", title, body, meta); err != nil {
		log.Printf("[notify] order_accepted: %v", err)
	}
}

func notifyOrderShipped(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("Order #%s is on the move", sfx)
	p := productLabel(row.ProductName, row.ProductID)
	body := fmt.Sprintf("%s is in transit — buyers get excited when packages move. You did the thing.", p)
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "in_transit",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_in_transit", title, body, meta); err != nil {
		log.Printf("[notify] order_in_transit: %v", err)
	}
}

func notifyOrderTrackingUpdated(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("Order #%s tracking updated", sfx)
	p := productLabel(row.ProductName, row.ProductID)
	body := fmt.Sprintf("We saved new shipping details for %s.", p)
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "in_transit",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_tracking_updated", title, body, meta); err != nil {
		log.Printf("[notify] order_tracking_updated: %v", err)
	}
}

func notifyOrderInVerification(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("Order #%s reached verification", sfx)
	p := productLabel(row.ProductName, row.ProductID)
	body := fmt.Sprintf("%s is with our verification team — sit tight while they do their thing.", p)
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "under_verification",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_in_verification", title, body, meta); err != nil {
		log.Printf("[notify] order_in_verification: %v", err)
	}
}

func notifyOrderPaymentCompleted(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("Order #%s marked complete", sfx)
	p := productLabel(row.ProductName, row.ProductID)
	body := fmt.Sprintf("Payment’s wrapped for %s — this order is marked completed.", p)
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "completed",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_payment_completed", title, body, meta); err != nil {
		log.Printf("[notify] order_payment_completed: %v", err)
	}
}

func notifyOrderPayoutReleased(ctx context.Context, database *db.DB, row *db.VendorOrderRow) {
	if row == nil {
		return
	}
	sfx := orderIDSuffix(row.ID)
	title := fmt.Sprintf("Payout released for order #%s", sfx)
	p := productLabel(row.ProductName, row.ProductID)
	body := fmt.Sprintf("Funds for %s (order #%s) are on their way — check your payout records.", p, sfx)
	meta := map[string]interface{}{
		"orderId": row.ID, "nav": "orders", "tab": "completed",
	}
	if err := database.EnqueueVendorNotification(ctx, row.VendorPhone, "order", "order_payout_released", title, body, meta); err != nil {
		log.Printf("[notify] order_payout_released: %v", err)
	}
}

func notifyProductRequestReview(ctx context.Context, database *db.DB, vendorPhone, productName string, requestID int) {
	title := "Product request in review"
	body := fmt.Sprintf("\"%s\" is now in review — we’ll ping you when there’s news.", productName)
	meta := map[string]interface{}{"productRequestId": requestID, "nav": "add-product"}
	if err := database.EnqueueVendorNotification(ctx, vendorPhone, "system", "product_request_in_review", title, body, meta); err != nil {
		log.Printf("[notify] product_request_in_review: %v", err)
	}
}

func notifyProductRequestApproved(ctx context.Context, database *db.DB, vendorPhone, productName string, requestID int) {
	title := "Product request approved"
	body := fmt.Sprintf("\"%s\" was approved. Nice work — it’s moving forward.", productName)
	meta := map[string]interface{}{"productRequestId": requestID, "nav": "add-product"}
	if err := database.EnqueueVendorNotification(ctx, vendorPhone, "system", "product_request_approved", title, body, meta); err != nil {
		log.Printf("[notify] product_request_approved: %v", err)
	}
}

func notifyProductRequestRejected(ctx context.Context, database *db.DB, vendorPhone, productName string, requestID int, adminNotes string) {
	title := "Product request not approved"
	body := fmt.Sprintf("We couldn’t approve \"%s\" this time.", productName)
	if strings.TrimSpace(adminNotes) != "" {
		body = body + " Note: " + strings.TrimSpace(adminNotes)
	}
	meta := map[string]interface{}{"productRequestId": requestID, "nav": "add-product"}
	if err := database.EnqueueVendorNotification(ctx, vendorPhone, "system", "product_request_rejected", title, body, meta); err != nil {
		log.Printf("[notify] product_request_rejected: %v", err)
	}
}
