package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"vendor-api/internal/config"
	"vendor-api/internal/db"
	"vendor-api/internal/handler"
	"vendor-api/internal/msg91"
	"vendor-api/internal/storage"
	"vendor-api/internal/worker"

	"github.com/joho/godotenv"
)

func main() {
	// Load backend/.env if present (optional)
	_ = godotenv.Load(".env")

	cfg := config.Load()
	database, err := db.New(cfg)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer database.Close()

	var msg *msg91.Client
	if cfg.MSG91AuthKey != "" {
		msg = msg91.NewClient(cfg.MSG91AuthKey)
	} else {
		msg = msg91.NewClient("")
	}

	r2Uploader, err := storage.NewR2Uploader(storage.R2Config{
		AccountID:       cfg.R2AccountID,
		Bucket:          cfg.R2Bucket,
		AccessKeyID:     cfg.R2AccessKeyID,
		SecretAccessKey: cfg.R2SecretAccessKey,
		Region:          cfg.R2Region,
		Endpoint:        cfg.R2Endpoint,
		PublicBaseURL:   cfg.R2PublicBaseURL,
	})
	if err != nil {
		if errors.Is(err, storage.ErrStorageNotConfigured) {
			log.Fatalf("r2 storage is not configured. set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY")
		}
		log.Fatalf("r2 uploader: %v", err)
	}
	otp := handler.NewOTPHandler(cfg, msg, database, r2Uploader)
	products := handler.NewProductsHandler(database, r2Uploader)
	inventory := handler.NewInventoryHandler(database)
	orders := handler.NewOrdersHandler(database, r2Uploader)
	support := handler.NewSupportHandler(database, r2Uploader)
	admin := handler.NewAdminHandler(cfg, database, r2Uploader)
	productReq := handler.NewProductRequestsHandler(database)
	notifs := handler.NewNotificationsHandler(database)
	outboxWorker := worker.NewNotificationOutboxWorker(database)

	bgCtx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go outboxWorker.Run(bgCtx)

	http.HandleFunc("/api/send-otp", otp.SendOTP)
	http.HandleFunc("/api/verify-otp", otp.VerifyOTP)
	http.HandleFunc("/api/resend-otp", otp.ResendOTP)
	http.HandleFunc("/api/verify-token", otp.VerifyToken)
	http.HandleFunc("/api/onboarding-status", otp.GetOnboardingStatus)
	http.HandleFunc("/api/profile", otp.GetProfile)
	http.HandleFunc("/api/profile/save", otp.SaveProfile)
	http.HandleFunc("/api/verification", otp.GetVerification)
	http.HandleFunc("/api/verification/upload", otp.UploadVerificationFile)
	http.HandleFunc("/api/verification/remove-doc", otp.RemoveVerificationDoc)
	http.HandleFunc("/api/verification/submit", otp.SubmitVerification)
	http.HandleFunc("/api/vouch/status", otp.GetVouchStatus)
	http.HandleFunc("/api/vouch/generate-link", otp.GenerateVouchLink)
	http.HandleFunc("/api/vouch/public", otp.GetPublicVouchInfo)
	http.HandleFunc("/api/vouch/submit", otp.SubmitPublicVouch)
	http.HandleFunc("/api/vouch/reapply", otp.ReapplyAfterRejection)
	http.HandleFunc("/api/dev/vouch/add", otp.AddDevVouches)
	http.HandleFunc("/api/dev/vouch/review", otp.SetDevVouchReviewDecision)
	http.HandleFunc("/api/dev/vouch/cooldown-end", otp.EndDevRejectedCooldown)
	http.HandleFunc("/api/dev/verification/file-url", otp.GetVerificationFileURLDev)
	// Product listing and search (dashboard)
	http.HandleFunc("/api/products/home", products.GetHomeFeed)
	http.HandleFunc("/api/products/category/", products.GetCategoryPage)
	http.HandleFunc("/api/products/detail", products.GetProductDetail)
	http.HandleFunc("/api/products/brand/", products.GetBrandPage)
	http.HandleFunc("/api/search/overlay", products.GetSearchOverlay)
	http.HandleFunc("/api/brands/featured", products.GetFeaturedBrands)
	http.HandleFunc("/api/product-review", products.SubmitProductReview)
	http.HandleFunc("/api/product-review/upload-image", products.UploadProductReviewImages)
	http.HandleFunc("/api/inventory", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			inventory.CreateInventory(w, r)
			return
		}
		if r.Method == http.MethodGet {
			inventory.GetInventory(w, r)
			return
		}
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	})
	http.HandleFunc("/api/inventory/list", inventory.ListInventory)
	http.HandleFunc("/api/inventory/listing-status", inventory.UpdateListingStatus)
	http.HandleFunc("/api/inventory/mark-sold", inventory.UpdateSoldOut)
	http.HandleFunc("/api/inventory/delete", inventory.DeleteInventory)
	http.HandleFunc("/api/listings", inventory.GetListings)
	http.HandleFunc("/api/orders", orders.ListOrders)
	http.HandleFunc("/api/orders/decision", orders.OrderDecision)
	http.HandleFunc("/api/orders/tracking", orders.OrderTracking)
	http.HandleFunc("/api/orders/mark-delivered", orders.MarkDelivered)
	http.HandleFunc("/api/orders/set-verification", orders.SetVerification)
	http.HandleFunc("/api/orders/upload-docs", orders.UploadOrderDocs)
	http.HandleFunc("/api/orders/mark-payment-done", orders.MarkPaymentDone)
	http.HandleFunc("/api/orders/create-from-main", orders.CreateOrderFromMain)
	http.HandleFunc("/api/orders/cancel-from-main", orders.CancelOrderFromMain)
	http.HandleFunc("/api/notifications", notifs.Notifications)
	http.HandleFunc("/api/notifications/unread-count", notifs.UnreadCount)
	http.HandleFunc("/api/support/tickets", support.Tickets)
	http.HandleFunc("/api/support/tickets/upload", support.UploadTicketDocs)
	http.HandleFunc("/api/support/tickets/doc-url", support.TicketDocURL)
	http.HandleFunc("/api/support/tickets/status", support.UpdateTicketStatus)
	http.HandleFunc("/api/product-requests", productReq.Create)
	http.HandleFunc("/api/admin/", admin.ServeHTTP)
	http.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	addr := ":" + cfg.Port
	log.Printf("Vendor API listening on %s", addr)
	if err := http.ListenAndServe(addr, corsMiddleware(cfg, http.DefaultServeMux)); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware(cfg *config.Config, next http.Handler) http.Handler {
	origin := "*"
	if o := cfg.AdminCORSOrigin; o != "" {
		origin = o
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		if origin != "*" {
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		// Include DELETE so the notifications trash action can call DELETE successfully.
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-DEV-KEY, Authorization, X-Admin-Internal-Secret")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
