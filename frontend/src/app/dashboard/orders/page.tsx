 "use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { orderDecision, orderTracking, markOrderDelivered, uploadOrderDocs, type VendorOrder } from "@/lib/api";
import { getOnboardingPhone } from "@/lib/onboarding-session";
import { ProductCardImage } from "@/components/product-card-image";
import { useOrdersQuery, dashboardQueryKeys } from "@/lib/dashboard-queries";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import VendorFooter from "@/components/vendor-footer";

type OrderStage = "pending" | "waiting_pickup" | "in_transit" | "verification" | "completed" | "payment_pending" | "rejected";

type Order = {
  id: number;
  productName: string;
  productImageUrl: string | null;
  size: string;
  orderCode: string;
  orderDate: string;
  trackingId?: string | null;
  shippingAddress?: string | null;
  verificationStatus: string | null;
  payoutInr: number;
  profitLossInr?: number | null;
  paymentWindow?: { from: string; to: string } | null;
  payoutBy?: string | null;
  rejectionReason?: string | null;
  stage: OrderStage;
};

type TabId = "all" | "pending" | "waiting_pickup" | "in_transit" | "under_verification" | "payment_pending" | "rejected" | "completed";

const SHIPPING_PARTNERS = ["BlueDart", "Delhivery", "DTDC", "FedEx", "XpressBees", "Ecom Express", "Shadowfax", "India Post", "Amazon Shipping", "Other"];

const POC_WHATSAPP_NUMBER = "917065391592";

function mapVendorOrderToOrder(o: VendorOrder): Order {
  const payoutInr = o.payoutCents != null ? Math.round(o.payoutCents / 100) : 0;
  const profitLossInr = o.profitLossCents != null ? Math.round(o.profitLossCents / 100) : null;
  let paymentWindow: { from: string; to: string } | null = null;
  if (o.paymentWindowFrom && o.paymentWindowTo) {
    paymentWindow = { from: o.paymentWindowFrom, to: o.paymentWindowTo };
  }
  return {
    id: o.id,
    productName: o.productName ?? o.productId,
    productImageUrl: o.productImageUrl ?? null,
    size: o.size,
    orderCode: o.externalOrderId,
    orderDate: o.orderDate,
    trackingId: o.trackingId ?? null,
    shippingAddress: o.shippingAddress ?? null,
    verificationStatus: o.verificationStatus ?? null,
    payoutInr,
    profitLossInr,
    paymentWindow,
    payoutBy: o.payoutBy ?? null,
    rejectionReason: o.rejectionReason ?? null,
    stage: o.status as OrderStage,
  };
}

const TAB_IDS: TabId[] = ["all", "pending", "waiting_pickup", "in_transit", "under_verification", "payment_pending", "rejected", "completed"];

function OrdersPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabId = tabParam && TAB_IDS.includes(tabParam as TabId) ? (tabParam as TabId) : "all";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [trackingModalOrder, setTrackingModalOrder] = useState<Order | null>(null);
  const [trackingPartner, setTrackingPartner] = useState<string>("");
  const [trackingPartnerOpen, setTrackingPartnerOpen] = useState(false);
  const [trackingCustomPartner, setTrackingCustomPartner] = useState<string>("");
  const [trackingPickupDate, setTrackingPickupDate] = useState<string>("");
  const [trackingId, setTrackingId] = useState<string>("");
  const [uploadModalOrder, setUploadModalOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const trackingDropdownRef = useRef<HTMLDivElement>(null);
  const [deliveryProofOrder, setDeliveryProofOrder] = useState<Order | null>(null);
  const [deliveryProofFiles, setDeliveryProofFiles] = useState<File[]>([]);
  const [deliveryProofSubmitting, setDeliveryProofSubmitting] = useState(false);
  const [deliveryProofError, setDeliveryProofError] = useState<string | null>(null);
  const deliveryProofInputRef = useRef<HTMLInputElement>(null);
  const deliveryProofReplaceIndexRef = useRef<number | null>(null);
  const [needMoreExpanded, setNeedMoreExpanded] = useState(true);
  const [pendingVerExpanded, setPendingVerExpanded] = useState(true);
  const [pickupCalendarOpen, setPickupCalendarOpen] = useState(false);
  const [pickupCalendarMonth, setPickupCalendarMonth] = useState<Date>(() => new Date());
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);

  const phone = typeof window !== "undefined" ? getOnboardingPhone() : "";
  const queryClient = useQueryClient();
  const { data: ordersData = [], isPending: loading, error: queryError } = useOrdersQuery(phone);
  const orders = useMemo(() => ordersData.map(mapVendorOrderToOrder), [ordersData]);
  const error = queryError ? "Could not load orders." : null;

  const invalidateOrders = useCallback(async () => {
    if (!phone) return;
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.orders(phone) });
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.notifications(phone) });
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.notificationsUnread(phone) });
  }, [phone, queryClient]);

  useEffect(() => {
    if (tabParam && TAB_IDS.includes(tabParam as TabId)) setActiveTab(tabParam as TabId);
  }, [tabParam]);

  useEffect(() => {
    if (!trackingPartnerOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (trackingDropdownRef.current && !trackingDropdownRef.current.contains(e.target as Node)) {
        setTrackingPartnerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [trackingPartnerOpen]);

  const buckets = useMemo(() => {
    const all = orders;
    const pending = all.filter((o) => o.stage === "pending");
    const waiting = all.filter((o) => o.stage === "waiting_pickup");
    const inTransit = all.filter((o) => o.stage === "in_transit");
    const underVerification = all.filter((o) => o.stage === "verification");
    const completed = all.filter((o) => o.stage === "completed");
    const paymentPending = all.filter((o) => o.stage === "payment_pending");
    const rejected = all.filter((o) => o.stage === "rejected" || o.verificationStatus === "rejected");
    return { all, pending, waiting, inTransit, underVerification, completed, paymentPending, rejected };
  }, [orders]);

  const visible: Order[] = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return buckets.pending;
      case "waiting_pickup":
        return buckets.waiting;
      case "in_transit":
        return buckets.inTransit;
      case "under_verification":
        return buckets.underVerification;
      case "completed":
        return buckets.completed;
      case "payment_pending":
        return buckets.paymentPending;
      case "rejected":
        return buckets.rejected;
      default:
        return buckets.all;
    }
  }, [activeTab, buckets]);

  const counts = {
    all: buckets.all.length,
    pending: buckets.pending.length,
    waiting_pickup: buckets.waiting.length,
    in_transit: buckets.inTransit.length,
    under_verification: buckets.underVerification.length,
    completed: buckets.completed.length,
    payment_pending: buckets.paymentPending.length,
    rejected: buckets.rejected.length,
  };

  const handleAccept = async (order: Order) => {
    if (!phone || actionLoading) return;
    setActionLoading(true);
    setDecisionNotice(null);
    try {
      const res = await orderDecision({ vendorPhone: phone, orderId: order.id, decision: "accept" });
      if (res.success) {
        setDecisionNotice(null);
      } else {
        setDecisionNotice(res.message ?? "Could not accept this order.");
      }
    } catch {
      setDecisionNotice("Could not reach the server. Check your connection and try again.");
    } finally {
      await invalidateOrders();
      setActionLoading(false);
    }
  };

  const handleReject = async (order: Order) => {
    if (!phone || actionLoading) return;
    setActionLoading(true);
    setDecisionNotice(null);
    try {
      const res = await orderDecision({ vendorPhone: phone, orderId: order.id, decision: "reject" });
      if (res.success) {
        setDecisionNotice(null);
      } else {
        setDecisionNotice(res.message ?? "Could not reject this order.");
      }
    } catch {
      setDecisionNotice("Could not reach the server. Check your connection and try again.");
    } finally {
      await invalidateOrders();
      setActionLoading(false);
    }
  };

  const openTrackingModal = (order: Order) => {
    setTrackingModalOrder(order);
    setTrackingPartner("");
    setTrackingPartnerOpen(false);
    setTrackingCustomPartner("");
    setTrackingPickupDate("");
    setTrackingId("");
  };

  const closeTrackingModal = () => {
    setTrackingModalOrder(null);
    setTrackingPartnerOpen(false);
    setTrackingCustomPartner("");
  };

  const handleConfirmTracking = async () => {
    if (!trackingModalOrder || !phone || actionLoading) return;
    setActionLoading(true);
    const resolvedPartner = trackingPartner === "Other" ? trackingCustomPartner.trim() : trackingPartner;
    try {
      const res = await orderTracking({
        vendorPhone: phone,
        orderId: trackingModalOrder.id,
        shippingPartner: resolvedPartner || undefined,
        trackingId: trackingId || undefined,
        pickupDate: trackingPickupDate || undefined,
      });
      if (res.success) {
        closeTrackingModal();
        await invalidateOrders();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const openDeliveryProofModal = (order: Order) => {
    setDeliveryProofOrder(order);
    setDeliveryProofFiles([]);
    setDeliveryProofError(null);
    setDeliveryProofSubmitting(false);
    deliveryProofReplaceIndexRef.current = null;
  };

  const closeDeliveryProofModal = () => {
    if (deliveryProofSubmitting) return;
    setDeliveryProofOrder(null);
    setDeliveryProofFiles([]);
    setDeliveryProofError(null);
    deliveryProofReplaceIndexRef.current = null;
  };

  const handleDeliveryProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    const replaceIdx = deliveryProofReplaceIndexRef.current;
    deliveryProofReplaceIndexRef.current = null;

    if (replaceIdx !== null && replaceIdx >= 0 && replaceIdx < deliveryProofFiles.length) {
      setDeliveryProofFiles((prev) => {
        const next = [...prev];
        next[replaceIdx] = selected[0];
        return next;
      });
    } else {
      const remaining = 3 - deliveryProofFiles.length;
      const toAdd = Array.from(selected).slice(0, remaining);
      if (toAdd.length > 0) {
        setDeliveryProofFiles((prev) => [...prev, ...toAdd]);
      }
    }
    if (deliveryProofInputRef.current) deliveryProofInputRef.current.value = "";
  };

  const handleDeliveryProofDelete = (index: number) => {
    setDeliveryProofFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeliveryProofReupload = (index: number) => {
    deliveryProofReplaceIndexRef.current = index;
    deliveryProofInputRef.current?.click();
  };

  const triggerDeliveryProofUpload = () => {
    if (deliveryProofFiles.length >= 3) return;
    deliveryProofReplaceIndexRef.current = null;
    deliveryProofInputRef.current?.click();
  };

  const handleSubmitDeliveryProof = async () => {
    if (!deliveryProofOrder || !phone || deliveryProofSubmitting) return;
    if (deliveryProofFiles.length === 0) {
      setDeliveryProofError("Please upload at least one proof of delivery.");
      return;
    }
    setDeliveryProofError(null);
    setDeliveryProofSubmitting(true);
    try {
      for (const file of deliveryProofFiles) {
        const uploadRes = await uploadOrderDocs({
          phone,
          orderId: deliveryProofOrder.id,
          file,
        });
        if (!uploadRes.success) {
          setDeliveryProofError(uploadRes.message || "Failed to upload a file. Please try again.");
          setDeliveryProofSubmitting(false);
          return;
        }
      }
      const res = await markOrderDelivered({ vendorPhone: phone, orderId: deliveryProofOrder.id });
      if (res.success) {
        closeDeliveryProofModal();
        await invalidateOrders();
      } else {
        setDeliveryProofError(res.message || "Could not mark order as delivered.");
      }
    } catch {
      setDeliveryProofError("Something went wrong. Please try again.");
    } finally {
      setDeliveryProofSubmitting(false);
    }
  };

  const openUploadModal = (order: Order) => {
    setUploadModalOrder(order);
  };

  const closeUploadModal = () => {
    setUploadModalOrder(null);
  };

  const needMoreOrders = useMemo(
    () => buckets.underVerification.filter((o) => o.verificationStatus === "needs_docs" || o.verificationStatus === "rejected"),
    [buckets.underVerification]
  );
  const pendingVerOrders = useMemo(
    () => buckets.underVerification.filter((o) => o.verificationStatus !== "needs_docs" && o.verificationStatus !== "rejected"),
    [buckets.underVerification]
  );

  return (
    <div className="relative mx-auto w-full max-w-[1650px] px-4 pb-24 pt-6 sm:pb-16 sm:pt-10 sm:px-8 lg:px-0">
      {/* Heading — match inventory page typography */}
      <header className="mb-6 sm:mb-8">
        <h1
          className="text-[25px] text-[#1C3040] sm:text-[40px]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
        >
          Your Orders
        </h1>
        <p
          className="mt-1 text-[14px] text-[#72808C] sm:text-[16px]"
          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
        >
          Manage your orders and shipments.
        </p>
      </header>

      {decisionNotice && (
        <div
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-[#1C3040]"
          role="alert"
        >
          <span style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>{decisionNotice}</span>
          <button
            type="button"
            className="shrink-0 text-[13px] font-medium text-[#72808C] underline underline-offset-2 hover:text-[#1C3040]"
            onClick={() => setDecisionNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs — match inventory mobile behavior */}
      <div className="mb-6 -mx-4 flex gap-2 overflow-x-auto pb-1 pl-[5px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:pl-0 sm:flex-wrap sm:gap-[calc(var(--spacing)*5)]">
        <OrdersTab label={`ALL (${counts.all})`} isActive={activeTab === "all"} onClick={() => setActiveTab("all")} />
        <OrdersTab label={`Pending (${counts.pending})`} isActive={activeTab === "pending"} onClick={() => setActiveTab("pending")} />
        <OrdersTab
          label={`Waiting for pickup (${counts.waiting_pickup})`}
          isActive={activeTab === "waiting_pickup"}
          onClick={() => setActiveTab("waiting_pickup")}
        />
        <OrdersTab
          label={`In Transit (${counts.in_transit})`}
          isActive={activeTab === "in_transit"}
          onClick={() => setActiveTab("in_transit")}
        />
        <OrdersTab
          label={`Under Verification (${counts.under_verification})`}
          isActive={activeTab === "under_verification"}
          onClick={() => setActiveTab("under_verification")}
        />
        <OrdersTab
          label={`Payment Pending (${counts.payment_pending})`}
          isActive={activeTab === "payment_pending"}
          onClick={() => setActiveTab("payment_pending")}
        />
        <OrdersTab
          label={`Rejected (${counts.rejected})`}
          isActive={activeTab === "rejected"}
          onClick={() => setActiveTab("rejected")}
        />
        <OrdersTab
          label={`Completed (${counts.completed})`}
          isActive={activeTab === "completed"}
          onClick={() => setActiveTab("completed")}
        />
      </div>

      {loading && (
        <div className="py-12 text-center text-[15px] text-[#72808C]">Loading orders…</div>
      )}
      {!loading && error && (
        <div className="py-12 text-center text-[15px] text-red-600">{error}</div>
      )}
      {!loading && !error && activeTab !== "under_verification" && visible.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center py-12 text-center">
          <p
            className="text-[18px] text-[#72808C]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
          >
            No orders in this view yet.
          </p>
        </div>
      )}
      {!loading && !error && activeTab !== "under_verification" && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map((order) => (
            activeTab === "all" && order.stage === "verification" ? (
              <UnderVerificationCard
                key={order.id}
                order={order}
                variant={order.verificationStatus === "needs_docs" || order.verificationStatus === "rejected" ? "needs_docs" : "pending"}
              />
            ) : (
              <OrderCard
                key={order.id}
                order={order}
                actionLoading={actionLoading}
                onAccept={() => handleAccept(order)}
                onReject={() => handleReject(order)}
                onAddTracking={() => openTrackingModal(order)}
                onMarkDelivered={() => openDeliveryProofModal(order)}
                onUploadDocs={() => openUploadModal(order)}
              />
            )
          ))}
        </div>
      )}

      {/* Under Verification — custom two-section layout */}
      {!loading && !error && activeTab === "under_verification" && (
        <div className="space-y-6">
          {/* Section 1: Need more details */}
          <div className="overflow-hidden rounded-none bg-[#f2f3f4]">
            <button
              type="button"
              onClick={() => setNeedMoreExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-6 py-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <h3
                  className="truncate text-[17px] font-semibold text-[#1C3040]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Need more details:
                </h3>
                <span
                  className="shrink-0 text-[14px] text-[#72808C]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  ({needMoreOrders.length})
                </span>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 256 256"
                  className={`text-[#1C3040] transition-transform ${needMoreExpanded ? "rotate-0" : "-rotate-90"}`}
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
                </svg>
              </span>
            </button>
            {needMoreExpanded && (
              <div className="max-h-[600px] space-y-4 overflow-y-auto px-0 pb-6 sm:px-6">
                {needMoreOrders.length === 0 ? (
                  <p
                    className="py-8 text-center text-[15px] text-[#72808C]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    No orders need more details right now.
                  </p>
                ) : (
                  needMoreOrders.map((order) => (
                    <UnderVerificationCard
                      key={order.id}
                      order={order}
                      variant="needs_docs"
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-[#e0e6ed]" />

          {/* Section 2: Pending Verification */}
          <div className="overflow-hidden rounded-none bg-[#f2f3f4]">
            <button
              type="button"
              onClick={() => setPendingVerExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-6 py-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <h3
                  className="truncate text-[17px] font-semibold text-[#1C3040]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Pending Verification
                </h3>
                <span
                  className="shrink-0 text-[14px] text-[#72808C]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  ({pendingVerOrders.length})
                </span>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 256 256"
                  className={`text-[#1C3040] transition-transform ${pendingVerExpanded ? "rotate-0" : "-rotate-90"}`}
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
                </svg>
              </span>
            </button>
            {pendingVerExpanded && (
              <div className="max-h-[600px] space-y-4 overflow-y-auto px-0 pb-6 sm:px-6">
                {pendingVerOrders.length === 0 ? (
                  <p
                    className="py-8 text-center text-[15px] text-[#72808C]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    No pending verification orders.
                  </p>
                ) : (
                  pendingVerOrders.map((order) => (
                    <UnderVerificationCard
                      key={order.id}
                      order={order}
                      variant="pending"
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Tracking Details modal — phone: start below top nav (65px) so top nav shows, bottom nav hidden; desktop: full overlay */}
      {trackingModalOrder && (
        <div className="fixed inset-0 z-[50] flex bg-black/30 px-0 pb-0 sm:items-center sm:justify-center sm:px-4 sm:pb-0 top-[65px] sm:top-0">
          <div className="relative flex h-full w-full max-w-none flex-col rounded-none border-0 bg-white px-5 pb-3 pt-5 shadow-2xl sm:h-auto sm:max-w-[720px] sm:rounded-none sm:border sm:border-[#e0e6ed] sm:px-8 sm:pb-8 sm:pt-8">
            {/* Mobile header: back arrow (left) + "Add Tracking Details" on same row */}
            <div className="mb-6 flex w-full items-center gap-3 sm:hidden">
              <button
                type="button"
                onClick={closeTrackingModal}
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#c7a77b] bg-white"
                aria-label="Go back"
              >
                <BackIcon className="h-5 w-5 text-[#051F2D]" />
              </button>
              <h2
                className="min-w-0 flex-1 text-[20px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Add Tracking Details
              </h2>
            </div>

            {/* Desktop/tablet header: centered title with close X */}
            <div className="mb-8 hidden items-center gap-4 sm:flex">
              <span className="h-px flex-1 bg-[#e0e6ed]" />
              <h2
                className="shrink-0 text-[22px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Add Tracking Details
              </h2>
              <span className="h-px flex-1 bg-[#e0e6ed]" />

              <button
                type="button"
                onClick={closeTrackingModal}
                className="ml-4 flex h-10 w-10 items-center justify-center rounded-sm"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#72808C" viewBox="0 0 256 256">
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                </svg>
              </button>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto">
              {/* Product info card */}
              <div className="mb-8 flex gap-4 border border-[#E2E5E8] bg-[#F9F8F8] px-4 py-4 sm:gap-5 sm:px-5 sm:py-5">
              <div className="h-[96px] w-[96px] shrink-0 overflow-hidden bg-white sm:h-[130px] sm:w-[150px]">
                <div className="relative h-full w-full">
                  <ProductCardImage
                    src={trackingModalOrder.productImageUrl ?? undefined}
                    alt={trackingModalOrder.productName}
                    sizes="150px"
                    imageClassName="absolute inset-0 h-full w-full object-contain p-1"
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="text-[16px] font-semibold text-[#1C3040]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {trackingModalOrder.productName}
                </p>
                <p
                  className="mt-2 text-[14px] text-[#657480]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {trackingModalOrder.size} · {trackingModalOrder.orderCode}
                </p>
                <p
                  className="mt-2 text-[14px] text-[#657480]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Order ID: {trackingModalOrder.orderCode}
                </p>
                <p
                  className="mt-2 text-[14px] text-[#657480]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Order Date: {formatDate(trackingModalOrder.orderDate)}
                </p>
                {trackingModalOrder.trackingId && (
                  <p
                    className="mt-2 text-[14px] text-[#657480]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Tracking ID: {trackingModalOrder.trackingId}
                  </p>
                )}
              </div>
              </div>

              {/* Form fields */}
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              <div ref={trackingDropdownRef} className="relative">
                <label
                  className="mb-2 block text-[14px] font-semibold text-[#1C3040]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Shipping Partner
                </label>
                <button
                  type="button"
                  onClick={() => setTrackingPartnerOpen((o) => !o)}
                  className="flex h-[48px] w-full items-center justify-between border border-[#DCE1E6] bg-white px-4 text-left text-[14px] text-[#6D7A85]"
                >
                  <span>{trackingPartner || "Select a shipping partner"}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-[#8B97A1] transition-transform ${trackingPartnerOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {trackingPartnerOpen && (
                  <div className="absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto border border-[#DCE1E6] bg-white shadow-lg">
                    {SHIPPING_PARTNERS.map((partner) => (
                      <button
                        key={partner}
                        type="button"
                        className={`block w-full px-4 py-2 text-left text-[14px] ${
                          trackingPartner === partner ? "bg-[#c7a77b] text-[#051F2D]" : "text-[#34495A] hover:bg-[#F4F6F8]"
                        }`}
                        onClick={() => {
                          setTrackingPartner(partner);
                          setTrackingPartnerOpen(false);
                          if (partner !== "Other") setTrackingCustomPartner("");
                        }}
                      >
                        {partner}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label
                  className="mb-2 block text-[16px] font-semibold text-[#1C3040] sm:text-[14px]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Pickup Date
                </label>
                {/* Mobile: tappable field that opens bottom sheet calendar */}
                <button
                  type="button"
                  onClick={() => setPickupCalendarOpen(true)}
                  className="flex h-[48px] w-full items-center justify-between border border-[#DCE1E6] bg-white px-4 text-left text-[14px] text-[#6D7A85] sm:hidden"
                >
                  <span>{trackingPickupDate ? formatPickupDisplay(trackingPickupDate) : "Select pickup date"}</span>
                  <CalendarIcon className="h-4 w-4 text-[#8B97A1]" />
                </button>
                {/* Desktop / tablet: native date input */}
                <input
                  type="date"
                  value={trackingPickupDate}
                  onChange={(e) => setTrackingPickupDate(e.target.value)}
                  className="hidden h-[48px] w-full border border-[#DCE1E6] bg-white px-4 text-[16px] text-[#051F2D] sm:block sm:text-[14px]"
                />
              </div>
            </div>

            {/* Custom delivery partner input when "Other" is selected */}
            {trackingPartner === "Other" && (
              <div className="mt-6">
                <label
                  className="mb-2 block text-[16px] font-semibold text-[#1C3040] sm:text-[14px]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Delivery Partner Name
                </label>
                <input
                  type="text"
                  value={trackingCustomPartner}
                  onChange={(e) => setTrackingCustomPartner(e.target.value)}
                  placeholder="Enter your delivery partner name"
                  className="h-[48px] w-full border border-[#DCE1E6] bg-white px-4 text-[16px] text-[#051F2D] sm:text-[14px]"
                />
              </div>
            )}

            <div className="mt-6">
              <label
                className="mb-2 block text-[16px] font-semibold text-[#1C3040] sm:text-[14px]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Tracking ID
              </label>
              <input
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="Enter the tracking ID to proceed."
                className="h-[48px] w-full border border-[#DCE1E6] bg-white px-4 text-[16px] text-[#051F2D] sm:text-[14px]"
              />
              <p
                className="mt-1 text-[12px] text-[#72808C]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                You can add this later once the shipment is picked up.
              </p>
            </div>
            </div>

            {/* Action buttons — phone: only Confirm; desktop: Back + Confirm */}
            <div className="mt-6 flex flex-col gap-3 border-t border-[#e0e6ed] pt-4 sm:mt-8 sm:flex-row sm:justify-end sm:gap-4 sm:border-0 sm:pt-0">
              <button
                type="button"
                onClick={closeTrackingModal}
                disabled={actionLoading}
                className="hidden h-[48px] rounded-none border border-[#c7a77b] bg-white px-6 text-[15px] font-semibold text-[#051F2D] hover:bg-[#f5f0e8] disabled:opacity-60 sm:inline-flex sm:min-w-[160px] sm:items-center sm:justify-center"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmTracking}
                disabled={actionLoading || (trackingPartner === "Other" && !trackingCustomPartner.trim())}
                className="h-[52px] w-full rounded-none bg-[#1C3040] px-6 text-[16px] font-semibold text-white hover:bg-[#2d4555] disabled:opacity-60 sm:min-w-[160px] sm:w-auto"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {actionLoading ? "Saving…" : "Confirm Details"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-only pickup date bottom sheet */}
      {pickupCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:hidden">
          <div className="relative w-full rounded-none bg-white pb-3 pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.25)]">
            {/* Floating close button */}
            <button
              type="button"
              onClick={() => setPickupCalendarOpen(false)}
              className="absolute -top-6 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-md"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#4B5563" viewBox="0 0 256 256">
                <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
              </svg>
            </button>

            <div className="px-5">
              <p
                className="text-[13px] text-[#72808C]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                When
              </p>
              <p
                className="mt-1 text-[16px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {trackingPickupDate ? formatPickupDisplay(trackingPickupDate) : "Select a pickup date"}
              </p>
            </div>

            {/* Calendar header */}
            <div className="mt-4 flex items-center justify-between border-b border-[#E5E7EB] px-5 pb-3">
              <button
                type="button"
                onClick={() =>
                  setPickupCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F3F4F6]"
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="h-4 w-4 text-[#4B5563]" />
              </button>
              <p
                className="text-[15px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {pickupCalendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}
              </p>
              <button
                type="button"
                onClick={() =>
                  setPickupCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F3F4F6]"
                aria-label="Next month"
              >
                <ChevronRightIcon className="h-4 w-4 text-[#4B5563]" />
              </button>
            </div>

            {/* Calendar grid */}
            <div className="mt-3 px-5">
              <div
                className="grid grid-cols-7 gap-y-2 text-center text-[11px] uppercase tracking-wide text-[#9CA3AF]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-y-2 text-center text-[14px]">
                {buildCalendarDays(pickupCalendarMonth).map((day) => {
                  if (!day) {
                    return <div key={Math.random()} />;
                  }
                  const iso = formatDateInputValue(day);
                  const isSelected = trackingPickupDate === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => {
                        setTrackingPickupDate(iso);
                        setPickupCalendarOpen(false);
                      }}
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-none ${
                        isSelected
                          ? "bg-[#c7a77b] text-white"
                          : "text-[#111827] hover:bg-[#F3F4F6]"
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 px-5">
              <button
                type="button"
                onClick={() => setPickupCalendarOpen(false)}
                className="mt-1 h-[48px] w-full rounded-none bg-[#1C3040] text-[15px] font-semibold text-white"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Set pickup date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Order as Delivered — delivery proof modal */}
      {deliveryProofOrder && (
        <>
          {/* Hidden file input (shared: phone + web) */}
          <input
            ref={deliveryProofInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleDeliveryProofFileChange}
            className="hidden"
          />

          {/* Phone-only: bottom drawer (match pickup-date drawer styling) */}
          <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:hidden">
            <div className="relative flex w-full min-h-[76vh] flex-col rounded-none bg-white pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.25)]">
              {/* Floating close button */}
              <button
                type="button"
                onClick={closeDeliveryProofModal}
                className="absolute -top-6 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-md"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#4B5563" viewBox="0 0 256 256">
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                </svg>
              </button>

              <div className="px-5">
                <h2
                  className="text-center text-[20px] font-semibold text-[#1C3040]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Mark Order as Delivered?
                </h2>
                <p
                  className="mx-auto mt-2 max-w-[520px] text-center text-[13px] leading-relaxed text-[#657480]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Please upload proof of delivery (e.g., warehouse receipt or shipment confirmation screenshot).
                </p>

                {deliveryProofError && (
                  <p
                    className="mt-4 rounded-none border border-[#b91c1c] bg-[#fef2f2] px-4 py-3 text-center text-[13px] font-medium text-[#b91c1c]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {deliveryProofError}
                  </p>
                )}
              </div>

              {/* Scrollable content */}
              <div
                className={`mt-5 flex-1 overflow-y-auto px-5 pb-3 ${
                  deliveryProofFiles.length === 0 ? "flex flex-col justify-center" : ""
                }`}
              >
                {deliveryProofFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="mb-3 flex items-center gap-4 rounded-none border border-[#e0e6ed] bg-[#F9F8F8] px-4 py-4"
                  >
                    <div className="h-[72px] w-[72px] shrink-0 overflow-hidden bg-white">
                      <FilePreview file={file} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[15px] font-medium text-[#1C3040]"
                        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                      >
                        {file.name}
                      </p>
                      <p
                        className="mt-1 text-[12px] text-[#72808C]"
                        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                      >
                        {formatFileSize(file.size)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDeliveryProofReupload(idx)}
                        className="mt-1 text-[12px] font-medium text-[#2563eb] hover:underline"
                        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                      >
                        Re-upload →
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeliveryProofDelete(idx)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center text-[#9ca3af] hover:text-[#b91c1c]"
                      aria-label="Delete file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
                      </svg>
                    </button>
                  </div>
                ))}

                {deliveryProofFiles.length < 3 && (
                  <button
                    type="button"
                    onClick={triggerDeliveryProofUpload}
                    className="mt-1 flex w-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-none border border-dashed border-[#CDD2D5] bg-[#F9F8F8] px-8 pt-14 pb-10 text-center hover:border-[#c7a77b] hover:bg-[#faf8f5]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="#72808C" viewBox="0 0 256 256">
                      <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z" />
                    </svg>
                    <p
                      className="text-[15px] text-[#657480]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      Click to upload documents
                    </p>
                    <p
                      className="text-[12px] text-[#93A0AA]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      JPG or PNG (max 5MB)
                    </p>
                  </button>
                )}
              </div>

              {/* Sticky footer */}
              <div className="border-t border-[#E5E7EB] px-5 pt-3">
                <button
                  type="button"
                  onClick={handleSubmitDeliveryProof}
                  disabled={deliveryProofSubmitting || deliveryProofFiles.length === 0}
                  className="h-[56px] w-full rounded-none bg-[#051f2d] text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {deliveryProofSubmitting ? "Submitting…" : "Submit Proof"}
                </button>
              </div>
            </div>
          </div>

          {/* Web/tablet: keep existing modal exactly as-is */}
          <div className="fixed inset-0 z-40 hidden items-end justify-center bg-black/30 px-0 pb-0 sm:flex sm:items-center sm:px-4 sm:pb-0">
            <div className="relative w-full max-w-none rounded-t-3xl border border-transparent bg-white px-6 py-8 shadow-2xl sm:max-w-[680px] sm:rounded-none sm:border-[#e0e6ed] sm:px-10 sm:py-10">
              {/* Close X button */}
              <button
                type="button"
                onClick={closeDeliveryProofModal}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f3f4] sm:right-6 sm:top-6 sm:h-11 sm:w-11 sm:rounded-sm"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="#72808C" viewBox="0 0 256 256">
                  <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
                </svg>
              </button>

              <h2
                className="pr-12 text-center text-[24px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Mark Order as Delivered?
              </h2>
              <p
                className="mx-auto mt-4 max-w-[520px] text-center text-[15px] leading-relaxed text-[#657480]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                This order is being marked as delivered before the expected delivery date. Please upload proof of delivery (e.g., warehouse receipt or shipment confirmation screen shot).
              </p>

              {deliveryProofError && (
                <p
                  className="mt-5 rounded-none border border-[#b91c1c] bg-[#fef2f2] px-5 py-3 text-center text-[14px] font-medium text-[#b91c1c]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {deliveryProofError}
                </p>
              )}

              {/* Upload area / file previews */}
              <div className="mt-8 space-y-4">
                {deliveryProofFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center gap-5 rounded-none border border-[#e0e6ed] bg-[#F9F8F8] px-5 py-4"
                  >
                    {/* Thumbnail */}
                    <div className="h-[72px] w-[72px] shrink-0 overflow-hidden bg-white">
                      <FilePreview file={file} />
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[16px] font-medium text-[#1C3040]"
                        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                      >
                        {file.name}
                      </p>
                      <p
                        className="mt-1 text-[13px] text-[#72808C]"
                        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                      >
                        {formatFileSize(file.size)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleDeliveryProofReupload(idx)}
                        className="mt-1 text-[13px] font-medium text-[#2563eb] hover:underline"
                        style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                      >
                        Re-upload →
                      </button>
                    </div>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDeliveryProofDelete(idx)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center text-[#9ca3af] hover:text-[#b91c1c]"
                      aria-label="Delete file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Upload drop zone — show when less than 3 files */}
                {deliveryProofFiles.length < 3 && (
                  <button
                    type="button"
                    onClick={triggerDeliveryProofUpload}
                    className="flex w-full flex-col items-center gap-3 rounded-none border border-dashed border-[#CDD2D5] bg-[#F9F8F8] px-10 py-10 text-center hover:border-[#c7a77b] hover:bg-[#faf8f5]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="#72808C" viewBox="0 0 256 256">
                      <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0ZM93.66,77.66,120,51.31V144a8,8,0,0,0,16,0V51.31l26.34,26.35a8,8,0,0,0,11.32-11.32l-40-40a8,8,0,0,0-11.32,0l-40,40A8,8,0,0,0,93.66,77.66Z" />
                    </svg>
                    <p
                      className="text-[16px] text-[#657480]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      Click to upload documents
                    </p>
                    <p
                      className="text-[13px] text-[#93A0AA]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      JPG, PNG or PDF (max 5MB)
                    </p>
                  </button>
                )}
              </div>

              {/* Submit button */}
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={handleSubmitDeliveryProof}
                  disabled={deliveryProofSubmitting || deliveryProofFiles.length === 0}
                  className="min-w-[280px] rounded-none bg-[#051f2d] px-10 py-4 text-[16px] font-semibold text-white hover:bg-[#0a2e40] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {deliveryProofSubmitting ? "Submitting…" : "Submit Proof"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upload documents modal */}
      {uploadModalOrder && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 px-0 pb-0 sm:items-center sm:px-4 sm:pb-0">
          <div className="w-full max-w-none rounded-t-3xl border border-transparent bg-white px-6 py-7 shadow-2xl sm:max-w-[720px] sm:rounded-none sm:border-[#e0e6ed] sm:px-8 sm:py-8">
            <div className="mb-6 flex items-center justify-between">
              <h2
                className="text-[22px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Upload Additional documents
              </h2>
              <button
                type="button"
                onClick={closeUploadModal}
                className="h-8 w-8 rounded-full text-[#72808C] hover:bg-[#f2f3f4]"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p
              className="mb-6 text-[14px] text-[#657480]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              We may request additional documents if something needs clarification about a product or order.
            </p>
            <div className="mb-6 border border-dashed border-[#CDD2D5] bg-[#F9F8F8] px-6 py-8 text-center sm:px-8 sm:py-10">
              <p
                className="text-[14px] text-[#657480]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Click to upload documents
              </p>
              <p
                className="mt-1 text-[12px] text-[#93A0AA]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                JPG, PNG or PDF (max 5MB)
              </p>
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={closeUploadModal}
                className="min-w-[200px] rounded-none bg-[#1C3040] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#2d4555]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Upload Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav — phone view only */}
      <VendorFooter variant="minimal" />
      <MobileBottomNav />
    </div>
  );
}

function OrdersTab({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center justify-center whitespace-nowrap rounded-none border px-4 text-[13px] font-medium transition sm:h-auto sm:px-5 sm:py-3 sm:text-[15px] ${
        isActive
          ? "border-[#1C3040] bg-[#1C3040] text-white"
          : "border-[#9ba5ab] bg-white text-[#828f96] hover:border-[#6b7280] hover:text-[#1C3040]"
      }`}
      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
    >
      {label}
    </button>
  );
}

function OrderCard({
  order,
  actionLoading,
  onAccept,
  onReject,
  onAddTracking,
  onMarkDelivered,
  onUploadDocs,
}: {
  order: Order;
  actionLoading: boolean;
  onAccept: () => void;
  onReject: () => void;
  onAddTracking: () => void;
  onMarkDelivered: () => void;
  onUploadDocs: () => void;
}) {
  const isVerified = order.verificationStatus === "real_and_authentic";
  const showReverificationActions =
    order.stage === "verification" &&
    (order.verificationStatus === "needs_docs" || order.verificationStatus === "rejected");

  const stageLabel =
    order.stage === "pending"
      ? "Pending"
      : order.stage === "waiting_pickup"
      ? "Accepted"
      : order.stage === "in_transit"
      ? "In Transit"
      : order.stage === "verification"
      ? isVerified
        ? "Verified"
        : "In progress"
      : order.stage === "completed"
      ? "Completed"
      : order.stage === "payment_pending"
      ? "Pending"
      : "Rejected";

  const stageClass =
    order.stage === "pending"
      ? "bg-[#FEF3C7] text-[#92400E]"
      : order.stage === "waiting_pickup"
      ? "bg-[#DCFCE7] text-[#166534]"
      : order.stage === "in_transit"
      ? "bg-[#DBEAFE] text-[#1D4ED8]"
      : order.stage === "verification"
      ? "bg-[#DBEAFE] text-[#1D4ED8]"
      : order.stage === "completed"
      ? "bg-[#DCFCE7] text-[#166534]"
      : order.stage === "payment_pending"
      ? "bg-[#E5E7EB] text-[#374151]"
      : "bg-[#FEE2E2] text-[#991B1B]";

  return (
    <div className="">
      <div
        className={`rounded-none border border-[#e0e6ed] bg-[#f9f8f8] ${
          order.stage === "in_transit" ? "border-b-0 sm:border-b" : ""
        }`}
      >
        <article className="pl-4 pr-0 py-2 sm:px-5 sm:py-4">
          {/* Row layout on all viewports: image left, text right */}
          <div className="flex flex-row gap-3 sm:gap-[calc(var(--spacing)*15)]">
            {/* Left: product image; phone only: status below image */}
            <div className="flex flex-col shrink-0">
              <div className="h-[120px] w-[120px] overflow-hidden bg-transparent sm:h-[200px] sm:w-[240px]">
                <div className="relative h-full w-full">
                  <ProductCardImage
                    src={order.productImageUrl ?? undefined}
                    alt={order.productName}
                    sizes="240px"
                    imageClassName="absolute inset-0 h-full w-full object-contain p-1"
                  />
                </div>
              </div>
              <span
                className={`mt-1.5 inline-flex h-6 min-w-[80px] items-center justify-center px-2.5 py-0.5 text-[10px] font-semibold sm:hidden ${stageClass}`}
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {stageLabel}
              </span>
            </div>

            {/* Right: content — CTAs for pending/waiting_pickup/in_transit only on desktop (sm+) */}
            <div className="min-w-0 flex-1 pt-0 sm:pl-0">
              <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
                <div className="min-w-0">
                  <h2
                    className="truncate text-[14px] font-semibold text-[#1C3040] sm:text-[18px] sm:whitespace-normal sm:overflow-visible sm:text-clip sm:leading-snug"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {order.productName}
                  </h2>
                  <p
                    className="mt-1 text-[12px] text-[#50626C] sm:mt-2 sm:text-[13px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {order.size} · Order ID: {order.orderCode}
                  </p>
                  <p
                    className="mt-1 text-[12px] text-[#50626C] sm:mt-2 sm:text-[14px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Order Date: {formatDate(order.orderDate)}
                  </p>
                  {order.stage === "rejected" && order.rejectionReason && (
                    <p
                      className="mt-2 text-[12px] font-medium text-[#991B1B] sm:text-[13px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      {order.rejectionReason === "cancelled_by_customer"
                        ? "Reason: Order was cancelled by the customer before you accepted."
                        : order.rejectionReason === "cancelled_by_admin"
                          ? "Reason: Order was cancelled by our team."
                          : `Reason: ${order.rejectionReason}`}
                    </p>
                  )}
                  {order.shippingAddress && (
                    <p
                      className="mt-1 text-[12px] text-[#50626C] sm:mt-2 sm:text-[14px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      Shipping Address: {order.shippingAddress}
                    </p>
                  )}
                  {order.trackingId && (
                    <p
                      className="mt-1 text-[12px] text-[#50626C] sm:mt-2 sm:text-[14px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      Tracking ID: {order.trackingId}
                    </p>
                  )}
                  {order.stage === "verification" && (
                    <p
                      className="mt-1 text-[12px] text-[#50626C] sm:text-[14px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      Verification Status:{" "}
                      <span className="font-semibold">
                        {order.verificationStatus === "real_and_authentic" ? "Real & Authentic" : "In progress"}
                      </span>
                    </p>
                  )}
                </div>

                <div className="mt-1 flex w-full items-start justify-between gap-2 sm:mt-1 sm:w-auto sm:flex-col sm:items-end sm:gap-12">
                  {/* Status: hidden on phone (shown below image), visible on desktop — fixed size both views */}
                  <span
                    className={`hidden h-6 min-w-[80px] items-center justify-center px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex sm:px-3 sm:py-1 sm:text-[13px] ${stageClass}`}
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {stageLabel}
                  </span>
                  <div className="text-left sm:text-right">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wide text-[#72808C] sm:text-[12px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      Payout
                    </p>
                    <p
                      className="mt-0.5 text-[12px] font-semibold text-[#1C3040] sm:mt-1 sm:text-[16px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      INR {order.payoutInr.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions per stage — desktop only for pending / waiting_pickup / in_transit */}
              {order.stage === "pending" && (
                <div className="mt-4 hidden flex-wrap gap-3 sm:mt-5 sm:flex">
                  <button
                    type="button"
                    onClick={onReject}
                    disabled={actionLoading}
                    className="min-w-[140px] rounded-none border border-[#c7a77b] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#374151] hover:bg-[#f5f0e8] disabled:opacity-60"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={onAccept}
                    disabled={actionLoading}
                    className="min-w-[160px] rounded-none bg-[#1C3040] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#2d4555] disabled:opacity-60"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Accept Order
                  </button>
                </div>
              )}

              {order.stage === "waiting_pickup" && (
                <div className="mt-4 hidden sm:mt-5 sm:block">
                  <button
                    type="button"
                    onClick={onAddTracking}
                    disabled={actionLoading}
                    className="rounded-none bg-[#1C3040] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#2d4555] disabled:opacity-60"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Add Tracking Details
                  </button>
                </div>
              )}

              {order.stage === "in_transit" && (
                <div className="mt-4 hidden sm:mt-5 sm:block">
                  <button
                    type="button"
                    onClick={onMarkDelivered}
                    disabled={actionLoading}
                    className="rounded-none border border-[#c7a77b] bg-white px-6 py-2.5 text-[14px] font-semibold text-[#051F2D] hover:bg-[#f5f0e8] disabled:opacity-60"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Marked as delivered
                  </button>
                </div>
              )}

              {showReverificationActions && (
                <div className="mt-4 flex flex-wrap gap-3 sm:mt-5">
                  <button
                    type="button"
                    className="h-[40px] min-w-[150px] rounded-none border border-[#D1D5DB] bg-white px-5 text-[13px] font-semibold text-[#051F2D] hover:bg-[#F3F4F6] sm:h-auto sm:min-w-[160px] sm:px-6 sm:py-2.5 sm:text-[14px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Contact Support
                  </button>
                  <button
                    type="button"
                    onClick={onUploadDocs}
                    className="h-[40px] min-w-[150px] rounded-none bg-[#1C3040] px-5 text-[13px] font-semibold text-white hover:bg-[#2d4555] sm:h-auto sm:min-w-[160px] sm:px-6 sm:py-2.5 sm:text-[14px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Upload documents
                  </button>
                </div>
              )}
            </div>
          </div>
        </article>
      </div>

      {/* Mobile-only: CTAs outside card, attached to bottom — half/full width, reduced height */}
      <div className="flex flex-col sm:hidden">
        {order.stage === "pending" && (
          <div className="flex w-full border border-t-0 border-[#e0e6ed] bg-[#f9f8f8]">
            <button
              type="button"
              onClick={onReject}
              disabled={actionLoading}
              className="h-11 flex-1 rounded-none border border-[#c7a77b] bg-white text-[12px] font-semibold text-[#374151] hover:bg-[#f5f0e8] disabled:opacity-60"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onAccept}
              disabled={actionLoading}
              className="h-11 flex-1 rounded-none border-l border-[#e0e6ed] bg-[#1C3040] text-[12px] font-semibold text-white hover:bg-[#2d4555] disabled:opacity-60"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              Accept Order
            </button>
          </div>
        )}
        {order.stage === "waiting_pickup" && (
          <button
            type="button"
            onClick={onAddTracking}
            disabled={actionLoading}
            className="h-11 w-full rounded-none border border-t-0 border-[#e0e6ed] bg-[#1C3040] text-[12px] font-semibold text-white hover:bg-[#2d4555] disabled:opacity-60"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
          >
            Add Tracking Details
          </button>
        )}
        {order.stage === "in_transit" && (
          <button
            type="button"
            onClick={onMarkDelivered}
            disabled={actionLoading}
            className="h-11 w-full rounded-none border border-[#c7a77b] bg-[#f9f8f8] text-[12px] font-semibold text-[#051F2D] hover:bg-[#f0eeeb] disabled:opacity-60"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
          >
            Marked as delivered
          </button>
        )}
      </div>

      {/* Unified bottom strip for rejected / completed / payment pending */}
      {(order.stage === "rejected" || order.stage === "completed" || order.stage === "payment_pending") && (
        <div className="border border-t-0 border-[#D1D5DB] bg-[#E6E8EA] px-3 py-2 text-[11px] text-[#1C3040] sm:px-5 sm:py-4 sm:text-[13px]">
          {order.stage === "rejected" && (
            <div
              className="flex w-full items-center justify-between gap-2"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              <span className="shrink-0 font-semibold text-[#991B1B]">Rejected:</span>
              <span className="min-w-0 max-w-[70%] truncate text-right text-[#1C3040]">
                {order.verificationStatus === "rejected"
                  ? "Authentication failed during verification."
                  : "Rejected by vendor."}
              </span>
            </div>
          )}

          {order.stage === "completed" && (
            <div
              className="flex w-full items-center justify-between gap-2"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              <span className="truncate">Profit/Loss:</span>
              {(() => {
                const value = order.profitLossInr ?? 0;
                const color =
                  value > 0 ? "#15803D" : value < 0 ? "#B91C1C" : "#1C3040";
                const signPrefix = value > 0 ? "+" : value < 0 ? "-" : "";
                return (
                  <span
                    className="truncate font-semibold"
                    style={{ color }}
                  >
                    {signPrefix}INR {Math.abs(value).toLocaleString("en-IN")}
                  </span>
                );
              })()}
            </div>
          )}

          {order.stage === "payment_pending" && (
            <div
              className="flex w-full items-center justify-between gap-2"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              <span className="flex items-center gap-1 truncate">
                <span>Payout by:</span>
                <span className="inline-flex items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/House of vendors blue.svg"
                    alt="House of Vendor"
                    className="h-6 w-auto sm:h-10"
                  />
                </span>
              </span>
              <span className="shrink-0 text-[10px] text-[#4B5563] sm:text-[12px]">
                Payout in 24–48 hrs.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnderVerificationCard({ order, variant }: { order: Order; variant: "needs_docs" | "pending" }) {
  const statusLabel = variant === "needs_docs" ? "Needs More Details" : "Pending Verification";
  const statusClass = variant === "needs_docs" ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#FEF3C7] text-[#92400E]";

  return (
    <div className="">
      <div className="rounded-none border border-[#e0e6ed] bg-[#f9f8f8]">
        <article className="pl-4 pr-0 py-2 sm:px-5 sm:py-4">
          <div className="flex flex-row gap-3 sm:gap-[calc(var(--spacing)*15)]">
            <div className="flex flex-col shrink-0">
              <div className="h-[120px] w-[120px] overflow-hidden bg-transparent sm:h-[200px] sm:w-[240px]">
                <div className="relative h-full w-full">
                  <ProductCardImage
                    src={order.productImageUrl ?? undefined}
                    alt={order.productName}
                    sizes="240px"
                    imageClassName="absolute inset-0 h-full w-full object-contain p-1"
                  />
                </div>
              </div>
              <span
                className={`mt-1.5 inline-flex h-6 min-w-[110px] items-center justify-center px-2.5 py-0.5 text-[10px] font-semibold sm:hidden ${statusClass}`}
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {statusLabel}
              </span>
            </div>

            <div className="min-w-0 flex-1 pt-0 sm:pl-0">
              <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
                <div className="min-w-0">
                  <h2
                    className="truncate text-[14px] font-semibold text-[#1C3040] sm:text-[18px] sm:whitespace-normal sm:overflow-visible sm:text-clip sm:leading-snug"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {order.productName}
                  </h2>
                  <p className="mt-1 text-[12px] text-[#50626C] sm:mt-2 sm:text-[13px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                    {order.size} · Order ID: {order.orderCode}
                  </p>
                  <p className="mt-1 text-[12px] text-[#50626C] sm:mt-2 sm:text-[14px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                    Order Date: {formatDate(order.orderDate)}
                  </p>
                  {order.trackingId && (
                    <p className="mt-1 text-[12px] text-[#50626C] sm:mt-2 sm:text-[14px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                      Tracking ID: {order.trackingId}
                    </p>
                  )}
                </div>

                <div className="mt-1 flex w-full items-start justify-between gap-2 sm:mt-1 sm:w-auto sm:flex-col sm:items-end sm:gap-12">
                  <span
                    className={`hidden h-6 min-w-[110px] items-center justify-center px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex sm:px-3 sm:py-1 sm:text-[13px] ${statusClass}`}
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {statusLabel}
                  </span>
                  <div className="text-left sm:text-right">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wide text-[#72808C] sm:text-[12px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      Payout
                    </p>
                    <p
                      className="mt-0.5 text-[12px] font-semibold text-[#1C3040] sm:mt-1 sm:text-[16px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      INR {order.payoutInr.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>

              {variant === "needs_docs" && (
                <div className="mt-4 hidden flex-wrap gap-3 sm:mt-5 sm:flex">
                  <a
                    href={`https://wa.me/${POC_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I need help with my order ${order.orderCode}. It has been flagged for more details during verification.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-[160px] rounded-none border border-[#c7a77b] bg-white px-6 py-2.5 text-center text-[14px] font-semibold text-[#374151] hover:bg-[#f5f0e8]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Contact Your POC
                  </a>
                  <a
                    href={`/dashboard/support?orderId=${encodeURIComponent(order.orderCode)}`}
                    className="min-w-[160px] rounded-none bg-[#1C3040] px-6 py-2.5 text-center text-[14px] font-semibold text-white hover:bg-[#2d4555]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Raise a Ticket
                  </a>
                </div>
              )}
            </div>
          </div>
        </article>
      </div>

      {/* Mobile-only: attached strip for "Needs More Details" */}
      {variant === "needs_docs" && (
        <div className="flex flex-col sm:hidden">
          <div className="flex w-full border border-t-0 border-[#e0e6ed] bg-[#f9f8f8]">
            <a
              href={`https://wa.me/${POC_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I need help with my order ${order.orderCode}. It has been flagged for more details during verification.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 flex-1 items-center justify-center rounded-none border border-[#c7a77b] bg-white text-[12px] font-semibold text-[#374151] hover:bg-[#f5f0e8]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              Contact Your POC
            </a>
            <a
              href={`/dashboard/support?orderId=${encodeURIComponent(order.orderCode)}`}
              className="flex h-11 flex-1 items-center justify-center rounded-none border-l border-[#e0e6ed] bg-[#1C3040] text-[12px] font-semibold text-white hover:bg-[#2d4555]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              Raise a Ticket
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day.toString().padStart(2, "0")}/${month}/${year}`;
}

function formatPickupDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day.toString().padStart(2, "0")} ${month} ${year}`;
}

function formatDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(month: Date): (Date | null)[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const days: (Date | null)[] = [];
  const offset = firstOfMonth.getDay();
  for (let i = 0; i < offset; i++) {
    days.push(null);
  }
  const lastDate = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= lastDate; day++) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  return days;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>
    </svg>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      fill="#000000"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M200,40H184V32a8,8,0,0,0-16,0v8H88V32a8,8,0,0,0-16,0v8H56A24,24,0,0,0,32,64V200a24,24,0,0,0,24,24H200a24,24,0,0,0,24-24V64A24,24,0,0,0,200,40Zm8,160a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V104H208Z" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M160,48a8,8,0,0,1,5.66,13.66L118.63,108,160,149.37A8,8,0,0,1,148.69,160l-48-48a8,8,0,0,1,0-11.31l48-48A8,8,0,0,1,160,48Z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="currentColor"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M104,208a8,8,0,0,1-5.66-13.66L145.37,148,104,106.63A8,8,0,0,1,115.31,96l48,48a8,8,0,0,1,0,11.31l-48,48A8,8,0,0,1,104,208Z" />
    </svg>
  );
}

function FilePreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={file.name} className="h-full w-full object-cover" />
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OrdersPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F8F8] p-6 text-[#1C3040]">Loading orders…</div>}>
      <OrdersPage />
    </Suspense>
  );
}
