const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type SendOTPResponse = { success: boolean; message: string };
export type VerifyOTPResponse = {
  success: boolean;
  message: string;
  token?: string;
  nextStep?: "profile" | "verification" | "get_vouch" | "vouch_rejected" | "verification_reapply" | "done";
  profileCompleted?: boolean;
  verificationCompleted?: boolean;
  getVouchCompleted?: boolean;
  vouchReviewStatus?: "pending" | "approved" | "rejected";
  vouchReapplyAfter?: string;
};

export type ProfilePayload = {
  phone: string;
  fullName: string;
  email: string;
  primarySellingCategory: string;
  otherCategories: string[];
  city: string;
  state: string;
  fullAddress: string;
  pincode: string;
  gstRegistered: boolean;
  gstNumber: string;
  registeredFirmName: string;
};

export type VerificationFileSlot = {
  url: string;
  fileName: string;
  mime: string;
  size: number;
};

export type VerificationData = {
  aadhaarDocuments: VerificationFileSlot[];
  panDocuments: VerificationFileSlot[];
  aadhaarFileUrl: string;
  aadhaarFileName: string;
  aadhaarFileMime: string;
  aadhaarFileSize: number;
  panFileUrl: string;
  panFileName: string;
  panFileMime: string;
  panFileSize: number;
  stepStatus: string;
};

const MAX_KYC_FILES_PER_TYPE = 2;

function parseVerificationSlot(x: unknown): VerificationFileSlot | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!url) return null;
  return {
    url,
    fileName: typeof o.fileName === "string" ? o.fileName : "",
    mime: typeof o.mime === "string" ? o.mime : "",
    size: typeof o.size === "number" ? o.size : 0,
  };
}

/** Normalize API payload (supports legacy single-file-only responses). */
export function normalizeVerificationData(raw: unknown): VerificationData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let aadhaarDocuments = Array.isArray(o.aadhaarDocuments)
    ? (o.aadhaarDocuments.map(parseVerificationSlot).filter(Boolean) as VerificationFileSlot[])
    : [];
  if (aadhaarDocuments.length === 0 && typeof o.aadhaarFileUrl === "string" && o.aadhaarFileUrl.trim()) {
    aadhaarDocuments = [
      {
        url: o.aadhaarFileUrl.trim(),
        fileName: typeof o.aadhaarFileName === "string" ? o.aadhaarFileName : "",
        mime: typeof o.aadhaarFileMime === "string" ? o.aadhaarFileMime : "",
        size: typeof o.aadhaarFileSize === "number" ? o.aadhaarFileSize : 0,
      },
    ];
  }
  let panDocuments = Array.isArray(o.panDocuments)
    ? (o.panDocuments.map(parseVerificationSlot).filter(Boolean) as VerificationFileSlot[])
    : [];
  if (panDocuments.length === 0 && typeof o.panFileUrl === "string" && o.panFileUrl.trim()) {
    panDocuments = [
      {
        url: o.panFileUrl.trim(),
        fileName: typeof o.panFileName === "string" ? o.panFileName : "",
        mime: typeof o.panFileMime === "string" ? o.panFileMime : "",
        size: typeof o.panFileSize === "number" ? o.panFileSize : 0,
      },
    ];
  }
  return {
    aadhaarDocuments,
    panDocuments,
    aadhaarFileUrl: typeof o.aadhaarFileUrl === "string" ? o.aadhaarFileUrl : aadhaarDocuments[0]?.url ?? "",
    aadhaarFileName: typeof o.aadhaarFileName === "string" ? o.aadhaarFileName : aadhaarDocuments[0]?.fileName ?? "",
    aadhaarFileMime: typeof o.aadhaarFileMime === "string" ? o.aadhaarFileMime : aadhaarDocuments[0]?.mime ?? "",
    aadhaarFileSize: typeof o.aadhaarFileSize === "number" ? o.aadhaarFileSize : aadhaarDocuments[0]?.size ?? 0,
    panFileUrl: typeof o.panFileUrl === "string" ? o.panFileUrl : panDocuments[0]?.url ?? "",
    panFileName: typeof o.panFileName === "string" ? o.panFileName : panDocuments[0]?.fileName ?? "",
    panFileMime: typeof o.panFileMime === "string" ? o.panFileMime : panDocuments[0]?.mime ?? "",
    panFileSize: typeof o.panFileSize === "number" ? o.panFileSize : panDocuments[0]?.size ?? 0,
    stepStatus: typeof o.stepStatus === "string" ? o.stepStatus : "",
  };
}

export type VouchStatusResponse = {
  success: boolean;
  message: string;
  vouchCount: number;
  target: number;
  shareToken?: string;
  shareUrl?: string;
  stepStatus?: string;
  reviewStatus?: "pending" | "approved" | "rejected";
  progressText?: string;
  vendorName?: string;
  reapplyAfter?: string;
};

export async function sendOTP(phone: string): Promise<SendOTPResponse> {
  const res = await fetch(`${API_BASE}/api/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

export async function verifyOTP(phone: string, otp: string): Promise<VerifyOTPResponse> {
  const res = await fetch(`${API_BASE}/api/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp }),
  });
  return res.json();
}

export async function resendOTP(phone: string): Promise<SendOTPResponse> {
  const res = await fetch(`${API_BASE}/api/resend-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

/** Verify MSG91 widget JWT on our server (calls MSG91 verifyAccessToken). */
export async function verifyToken(accessToken: string, phone: string): Promise<VerifyOTPResponse> {
  const res = await fetch(`${API_BASE}/api/verify-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, phone }),
  });
  return res.json();
}

export async function getOnboardingStatus(phone: string): Promise<VerifyOTPResponse> {
  const res = await fetch(`${API_BASE}/api/onboarding-status?phone=${encodeURIComponent(phone)}`);
  return res.json();
}

export async function getProfile(phone: string): Promise<{ success: boolean; message: string; profile: Omit<ProfilePayload, "phone"> }> {
  const res = await fetch(`${API_BASE}/api/profile?phone=${encodeURIComponent(phone)}`);
  return res.json();
}

export async function saveProfile(payload: ProfilePayload): Promise<VerifyOTPResponse> {
  const res = await fetch(`${API_BASE}/api/profile/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getVerification(phone: string): Promise<{ success: boolean; message: string; verification: VerificationData }> {
  const res = await fetch(`${API_BASE}/api/verification?phone=${encodeURIComponent(phone)}`);
  const data = await res.json();
  if (data?.verification) {
    data.verification = normalizeVerificationData(data.verification);
  }
  return data;
}

export async function uploadVerificationFiles(params: {
  phone: string;
  docType: "aadhaar" | "pan";
  files: File[];
}): Promise<{ success: boolean; message: string; verification: VerificationData }> {
  const files = params.files.slice(0, MAX_KYC_FILES_PER_TYPE);
  const formData = new FormData();
  formData.append("phone", params.phone);
  formData.append("docType", params.docType);
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${API_BASE}/api/verification/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  if (data?.verification) {
    data.verification = normalizeVerificationData(data.verification);
  }
  return data;
}

export async function uploadVerificationFile(params: {
  phone: string;
  docType: "aadhaar" | "pan";
  file: File;
}): Promise<{ success: boolean; message: string; verification: VerificationData }> {
  return uploadVerificationFiles({ phone: params.phone, docType: params.docType, files: [params.file] });
}

export async function removeVerificationDoc(params: {
  phone: string;
  docType: "aadhaar" | "pan";
  index: number;
}): Promise<{ success: boolean; message: string; verification: VerificationData }> {
  const res = await fetch(`${API_BASE}/api/verification/remove-doc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (data?.verification) {
    data.verification = normalizeVerificationData(data.verification);
  }
  return data;
}

export async function submitVerification(phone: string): Promise<VerifyOTPResponse> {
  const res = await fetch(`${API_BASE}/api/verification/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

export async function getVouchStatus(phone: string): Promise<VouchStatusResponse> {
  const res = await fetch(`${API_BASE}/api/vouch/status?phone=${encodeURIComponent(phone)}`);
  return res.json();
}

export async function generateVouchLink(phone: string): Promise<VouchStatusResponse> {
  const res = await fetch(`${API_BASE}/api/vouch/generate-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

export async function getPublicVouchInfo(token: string): Promise<VouchStatusResponse> {
  const res = await fetch(`${API_BASE}/api/vouch/public?token=${encodeURIComponent(token)}`);
  return res.json();
}

export async function submitPublicVouch(payload: {
  token: string;
  name: string;
  brandName: string;
  email: string;
  phone: string;
}): Promise<VouchStatusResponse> {
  const res = await fetch(`${API_BASE}/api/vouch/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function reapplyAfterRejection(phone: string): Promise<VerifyOTPResponse> {
  const res = await fetch(`${API_BASE}/api/vouch/reapply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

// --- Products & Search (dashboard) ---

export type ProductCard = {
  id: string;
  category: string;
  brand: string;
  name: string;
  image: string;
  price?: string;
};

export type HomeFeedCategory = {
  category: string;
  title: string;
  subtitle: string;
  products: ProductCard[];
};

/** Single HTTP round-trip: six category slices loaded in parallel on the server. */
export async function getHomeFeed(): Promise<{ success: boolean; categories: HomeFeedCategory[] }> {
  const res = await fetch(`${API_BASE}/api/products/home`, { cache: "no-store" });
  if (!res.ok) return { success: false, categories: [] };
  const data = await res.json();
  if (!data?.success || !Array.isArray(data.categories)) return { success: false, categories: [] };
  return { success: true, categories: data.categories as HomeFeedCategory[] };
}

export async function getCategoryPage(
  category: string,
  limit = 24,
  offset = 0
): Promise<{ success: boolean; products: ProductCard[] }> {
  const slug = encodeURIComponent(String(category).trim().toLowerCase());
  if (!slug) return { success: false, products: [] };
  const url = `${API_BASE}/api/products/category/${slug}?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { success: false, products: [] };
  const data = await res.json();
  if (!data || !Array.isArray(data.products)) return { success: false, products: [] };
  return { success: true, products: data.products };
}

export async function getProductDetail(
  category: string,
  id: string
): Promise<{ success: boolean; product?: ProductCard }> {
  const cat = encodeURIComponent(String(category).trim().toLowerCase());
  const idEnc = encodeURIComponent(String(id).trim());
  if (!cat || !idEnc) return { success: false };
  const res = await fetch(`${API_BASE}/api/products/detail?category=${cat}&id=${idEnc}`, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data?.success) return { success: false };
  return { success: true, product: data.product };
}

export async function getBrandPage(
  brand: string,
  limit = 12,
  offset = 0
): Promise<{ success: boolean; products: ProductCard[] }> {
  const url = `${API_BASE}/api/products/brand/${encodeURIComponent(brand)}?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

export async function searchOverlay(
  q: string,
  options?: { limit?: number; offset?: number; categories?: string[] }
): Promise<{ success: boolean; products: ProductCard[] }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  if (options?.categories?.length) params.set("categories", options.categories.join(","));
  const res = await fetch(`${API_BASE}/api/search/overlay?${params.toString()}`);
  return res.json();
}

export async function getFeaturedBrands(max = 10): Promise<{ success: boolean; brands: string[] }> {
  const res = await fetch(`${API_BASE}/api/brands/featured?max=${max}`);
  return res.json();
}

export async function submitProductReview(payload: {
  productName: string;
  category: string;
  productLink: string;
  description?: string;
  imageUrls?: string[];
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/product-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/** Upload product images to R2; returns public URLs to store with the review request. Max 5 files, 10 MB each, JPG/PNG. */
export async function uploadProductReviewImages(files: File[]): Promise<{ success: boolean; urls?: string[]; message?: string }> {
  if (files.length === 0) return { success: false, message: "No files" };
  const form = new FormData();
  files.forEach((file) => form.append("images", file));
  const res = await fetch(`${API_BASE}/api/product-review/upload-image`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) return { success: false, message: data?.message || "Upload failed" };
  return { success: !!data.success, urls: data.urls ?? [], message: data.message };
}

// --- Vendor inventory (after Enter Details) ---

export type VendorInventory = {
  id: number;
  inventoryId: number;
  vendorPhone: string;
  productId: string;
  category: string;
  size: string;
  purchasePriceCents: number | null;
  desiredPayoutCents: number | null;
  listedPriceCents: number | null;
  finalPayoutCents: number | null;
  profitLossCents: number | null;
  pairLocation: string | null;
  availability: string | null;
  boxCondition: string | null;
  productQty: string | null;
  purchaseDate: string | null;
  placeOfPurchase: string | null;
  listingStatus: "save_for_later" | "list_now";
  soldOut: boolean;
  createdAt: string;
  updatedAt: string;
};

/** One inventory row from GET /api/inventory/list, including optional catalog card from batch lookup. */
export type VendorInventoryWithProduct = VendorInventory & {
  product?: ProductCard | null;
};

export async function createInventory(payload: {
  vendorPhone: string;
  productId: string;
  category: string;
  size: string;
  purchasePriceCents: number | null;
  desiredPayoutCents: number | null;
  listedPriceCents: number | null;
  finalPayoutCents: number | null;
  profitLossCents: number | null;
  pairLocation: string;
  availability: string;
  boxCondition: string;
  productQty: string;
  purchaseDate: string;
  placeOfPurchase: string;
}): Promise<{ success: boolean; message?: string; inventoryId?: number; id?: number }> {
  const res = await fetch(`${API_BASE}/api/inventory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getInventory(phone: string, productId: string, category: string): Promise<{ success: boolean; inventory?: VendorInventory | null }> {
  const params = new URLSearchParams({ phone, productId, category });
  const res = await fetch(`${API_BASE}/api/inventory?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  return { success: !!data?.success, inventory: data?.inventory ?? null };
}

export async function updateListingStatus(payload: { vendorPhone: string; id: number; listingStatus: "save_for_later" | "list_now" }): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/inventory/listing-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function markInventorySold(payload: { vendorPhone: string; id: number; soldOut?: boolean }): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/inventory/mark-sold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, soldOut: payload.soldOut ?? true }),
  });
  return res.json();
}

export async function listInventory(phone: string): Promise<{ success: boolean; inventory: VendorInventoryWithProduct[] }> {
  const params = new URLSearchParams({ phone });
  const res = await fetch(`${API_BASE}/api/inventory/list?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  return { success: !!data?.success, inventory: (data?.inventory ?? []) as VendorInventoryWithProduct[] };
}

export async function deleteInventory(payload: {
  vendorPhone: string;
  id: number;
}): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/inventory/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

/** Request a product to be added to the catalog (admin reviews in /admin/product-requests). */
export async function submitVendorProductRequest(payload: {
  phone: string;
  productName: string;
  brand?: string;
  category?: string;
  notes?: string;
}): Promise<{ success: boolean; message?: string; request?: unknown }> {
  const res = await fetch(`${API_BASE}/api/product-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// --- Vendor orders ---

export type VendorOrder = {
  id: number;
  vendorPhone: string;
  inventoryId: number | null;
  productId: string;
  category: string;
  size: string;
  productName: string | null;
  productImageUrl: string | null;
  externalOrderId: string;
  orderDate: string;
  shippingAddress: string | null;
  status: string;
  shippingPartner: string | null;
  trackingId: string | null;
  pickupDate: string | null;
  verificationStatus: string | null;
  payoutCents: number | null;
  profitLossCents: number | null;
  paymentWindowFrom: string | null;
  paymentWindowTo: string | null;
  payoutBy: string | null;
  reverificationDocUrls?: string[];
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VendorNotification = {
  id: number;
  vendorPhone: string;
  category: "order" | "verification" | "system";
  kind: string;
  title: string;
  body: string;
  meta: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export async function listNotifications(phone: string): Promise<{
  success: boolean;
  notifications: VendorNotification[];
  unreadCount: number;
  message?: string;
}> {
  const params = new URLSearchParams({ phone });
  const res = await fetch(`${API_BASE}/api/notifications?${params.toString()}`, { cache: "no-store" });
  return res.json();
}

export async function markNotificationsRead(phone: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

export async function deleteNotification(phone: string, id: number): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/notifications`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, id }),
  });
  return res.json();
}

export async function getUnreadNotificationCount(phone: string): Promise<{ success: boolean; unreadCount?: number }> {
  const params = new URLSearchParams({ phone });
  const res = await fetch(`${API_BASE}/api/notifications/unread-count?${params.toString()}`, { cache: "no-store" });
  return res.json();
}

export async function listOrders(phone: string): Promise<{ success: boolean; orders: VendorOrder[] }> {
  const params = new URLSearchParams({ phone });
  const res = await fetch(`${API_BASE}/api/orders?${params.toString()}`, { cache: "no-store" });
  const data = await res.json();
  return { success: !!data?.success, orders: (data?.orders ?? []) as VendorOrder[] };
}

export async function orderDecision(payload: {
  vendorPhone: string;
  orderId: number;
  decision: "accept" | "reject";
}): Promise<{ success: boolean; message?: string; code?: string }> {
  const res = await fetch(`${API_BASE}/api/orders/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { success?: boolean; message?: string; code?: string };
  return {
    success: !!data?.success,
    message: data?.message,
    code: data?.code,
  };
}

export async function orderTracking(payload: {
  vendorPhone: string;
  orderId: number;
  shippingPartner?: string;
  trackingId?: string;
  pickupDate?: string;
}): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/orders/tracking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function markOrderDelivered(payload: {
  vendorPhone: string;
  orderId: number;
}): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/orders/mark-delivered`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function markOrderPaymentDone(payload: {
  vendorPhone: string;
  orderId: number;
}): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/orders/mark-payment-done`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function uploadOrderDocs(payload: {
  phone: string;
  orderId: number;
  file: File;
}): Promise<{ success: boolean; message?: string }> {
  const form = new FormData();
  form.append("phone", payload.phone);
  form.append("orderId", String(payload.orderId));
  form.append("file", payload.file);
  const res = await fetch(`${API_BASE}/api/orders/upload-docs`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

// --- Support Tickets ---

export type SupportTicket = {
  id: number;
  vendorPhone: string;
  ticketCode: string;
  category: string;
  orderId: string | null;
  subject: string;
  description: string;
  email: string;
  priority: string;
  status: string;
  docUrls: string[];
  createdAt: string;
  updatedAt: string;
};

export async function listSupportTickets(phone: string): Promise<{ success: boolean; tickets: SupportTicket[] }> {
  const res = await fetch(`${API_BASE}/api/support/tickets?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
  const data = await res.json();
  return { success: !!data?.success, tickets: (data?.tickets ?? []) as SupportTicket[] };
}

export async function createSupportTicket(payload: {
  vendorPhone: string;
  category: string;
  orderId: string;
  subject: string;
  description: string;
  email: string;
  priority: string;
}): Promise<{ success: boolean; ticket?: SupportTicket; message?: string }> {
  const res = await fetch(`${API_BASE}/api/support/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function uploadTicketDocs(payload: {
  phone: string;
  ticketId: number;
  file: File;
}): Promise<{ success: boolean; message?: string }> {
  const form = new FormData();
  form.append("phone", payload.phone);
  form.append("ticketId", String(payload.ticketId));
  form.append("file", payload.file);
  const res = await fetch(`${API_BASE}/api/support/tickets/upload`, {
    method: "POST",
    body: form,
  });
  return res.json();
}

/** Short-lived HTTPS URL to open a ticket attachment (private R2 / r2:// refs). */
export async function getSupportTicketDocUrl(
  phone: string,
  ticketId: number,
  index: number
): Promise<{ success: boolean; url?: string; expiresInSeconds?: number; message?: string }> {
  const q = new URLSearchParams({
    phone,
    ticketId: String(ticketId),
    index: String(index),
  });
  const res = await fetch(`${API_BASE}/api/support/tickets/doc-url?${q}`, { cache: "no-store" });
  return res.json();
}

