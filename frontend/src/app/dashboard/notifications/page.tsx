"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { deleteNotification, markNotificationsRead, type VendorNotification } from "@/lib/api";
import { getOnboardingPhone } from "@/lib/onboarding-session";
import { dashboardQueryKeys, useNotificationsQuery } from "@/lib/dashboard-queries";
import VendorFooter from "@/components/vendor-footer";

const NOTIFY_BANNER_KEY = "vendor-browser-notify-banner-dismissed";

type FilterTab = "all" | "order" | "verification" | "system";

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hour${Math.floor(s / 3600) === 1 ? "" : "s"} ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} day${Math.floor(s / 86400) === 1 ? "" : "s"} ago`;
  return `${Math.floor(s / 604800)} week${Math.floor(s / 604800) === 1 ? "" : "s"} ago`;
}

function NotificationsPageInner() {
  const router = useRouter();
  const phone = typeof window !== "undefined" ? getOnboardingPhone() : "";
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useNotificationsQuery(phone);
  const notifications = data?.notifications ?? [];
  const [filter, setFilter] = useState<FilterTab>("all");
  const [bannerVisible, setBannerVisible] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const markReadOnce = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const doMarkRead = useCallback(async () => {
    if (!phone) return;
    await markNotificationsRead(phone);
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.notifications(phone) });
    await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.notificationsUnread(phone) });
  }, [phone, queryClient]);

  useEffect(() => {
    if (!phone || markReadOnce.current) return;
    markReadOnce.current = true;
    void doMarkRead();
  }, [phone, doMarkRead]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(NOTIFY_BANNER_KEY)) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;
    setBannerVisible(true);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.category === filter);
  }, [notifications, filter]);

  const counts = useMemo(() => {
    return {
      all: notifications.length,
      order: notifications.filter((n) => n.category === "order").length,
      verification: notifications.filter((n) => n.category === "verification").length,
      system: notifications.filter((n) => n.category === "system").length,
    };
  }, [notifications]);

  const handleCardActivate = (n: VendorNotification) => {
    const meta = n.meta ?? {};
    const nav = typeof meta.nav === "string" ? meta.nav : "";
    const tab = typeof meta.tab === "string" ? meta.tab : "";
    if (nav === "orders") {
      router.push(tab ? `/dashboard/orders?tab=${encodeURIComponent(tab)}` : "/dashboard/orders");
      return;
    }
    if (nav === "support") {
      router.push(tab ? `/dashboard/support?tab=${encodeURIComponent(tab)}` : "/dashboard/support");
      return;
    }
    if (nav === "add-product") {
      router.push("/dashboard/add-product");
      return;
    }
  };

  const canNavigate = (n: VendorNotification) => {
    const nav = typeof n.meta?.nav === "string" ? n.meta.nav : "";
    return nav === "orders" || nav === "support" || nav === "add-product";
  };

  const dismissBanner = () => {
    setBannerVisible(false);
    try {
      localStorage.setItem(NOTIFY_BANNER_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const requestBrowserNotify = async () => {
    if (typeof Notification === "undefined") return;
    try {
      await Notification.requestPermission();
    } finally {
      dismissBanner();
    }
  };

  const handleDeleteNotification = useCallback(
    async (id: number) => {
      if (!phone || deletingId === id) return;
      setDeletingId(id);
      try {
        const res = await deleteNotification(phone, id);
        if (res.success) {
          setToast({ type: "success", message: "Notification deleted" });
          await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.notifications(phone) });
          await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.notificationsUnread(phone) });
        } else {
          setToast({ type: "error", message: res.message || "Could not delete notification" });
        }
      } finally {
        setDeletingId(null);
      }
    },
    [phone, deletingId, queryClient]
  );

  return (
    <div className="animate-notif-enter relative mx-auto w-full max-w-[1650px] px-4 pb-16 pt-6 sm:px-8 sm:pb-16 sm:pt-10 lg:px-0">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-20 z-[60] rounded-none border px-4 py-3 text-[14px] sm:text-[15px] ${
            toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}
      {bannerVisible && (
        <div
          className="mb-4 flex flex-col gap-3 rounded-none border border-[#c7a77b] bg-[#fdfaf5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
        >
          <p className="text-[13px] text-[#1C3040] sm:text-[14px]">
            Get alerts when you’re on another tab? Allow browser notifications — same idea as other sites, optional and
            under your control.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void requestBrowserNotify()}
              className="rounded-none border-2 border-[#1C3040] bg-[#1C3040] px-4 py-2 text-[13px] font-semibold text-white"
            >
              Allow notifications
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              className="rounded-none border border-[#9ba5ab] bg-white px-4 py-2 text-[13px] font-medium text-[#1C3040]"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 rounded-none border-2 border-[#c7a77b] bg-white px-3 py-2 hover:bg-[#c7a77b]/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="shrink-0 text-[#1C3040]">
            <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
          </svg>
          <span className="text-[15px] font-semibold text-[#1C3040]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
            Back
          </span>
        </button>
      </div>

      <header className="mb-6 sm:mb-8">
        <h1
          className="text-[25px] text-[#1C3040] sm:text-[40px]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
        >
          Notifications
        </h1>
        <p className="mt-1 text-[14px] text-[#72808C] sm:text-[16px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
          Stay updated with order alerts, status changes, and system messages.
        </p>
      </header>

      <div className="mb-6 -mx-4 flex gap-2 overflow-x-auto pb-1 pl-[5px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:pl-0 sm:flex-wrap sm:gap-[calc(var(--spacing)*5)]">
        <NotifTab label={`All (${counts.all})`} isActive={filter === "all"} onClick={() => setFilter("all")} />
        <NotifTab label={`Orders (${counts.order})`} isActive={filter === "order"} onClick={() => setFilter("order")} />
        <NotifTab
          label={`Verification (${counts.verification})`}
          isActive={filter === "verification"}
          onClick={() => setFilter("verification")}
        />
        <NotifTab label={`System (${counts.system})`} isActive={filter === "system"} onClick={() => setFilter("system")} />
      </div>

      {isPending && (
        <div className="py-12 text-center text-[15px] text-[#72808C]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
          Loading notifications…
        </div>
      )}

      {!isPending && isError && (
        <div className="py-12 text-center text-[15px] text-red-600">Could not load notifications.</div>
      )}

      {!isPending && !isError && filtered.length === 0 && notifications.length === 0 && (
        <div className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
          <h2
            className="font-semibold text-[#c7a77b] text-[24px] sm:text-[28px]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
          >
            No notifications yet
          </h2>
          <p
            className="mt-4 max-w-[700px] text-[#828F96] text-[20px] sm:text-[22px]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 500 }}
          >
            We&apos;ll notify you when there are new orders, stock alerts, or important updates.
          </p>
        </div>
      )}

      {!isPending && !isError && filtered.length === 0 && notifications.length > 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center py-12 text-center">
          <h2
            className="font-semibold text-[#c7a77b]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "28px" }}
          >
            Nothing in this tab
          </h2>
          <p className="mt-3 text-[#828F96]" style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "18px", fontWeight: 500 }}>
            Try All or another category.
          </p>
        </div>
      )}

      {!isPending && !isError && filtered.length > 0 && (
        <ul className="space-y-3 sm:space-y-4">
          {filtered.map((n) => {
            const unread = !n.readAt;
            const clickable = canNavigate(n);
            return (
              <li key={n.id}>
                <div
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : -1}
                  onClick={() => clickable && handleCardActivate(n)}
                  onKeyDown={(e) => {
                    if (!clickable) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardActivate(n);
                    }
                  }}
                  className={`w-full rounded-none border px-4 py-4 text-left transition sm:px-5 sm:py-5 ${
                    unread ? "border-[#2563EB] bg-[#f2f3f4]" : "border-[#e0e6ed] bg-[#f2f3f4]"
                  } ${clickable ? "cursor-pointer hover:border-[#1C3040]/40" : "cursor-default"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2
                      className="text-[15px] font-semibold text-[#1C3040] sm:text-[16px]"
                      style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                    >
                      {n.title}
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="shrink-0 text-[11px] text-[#828F96] sm:text-[12px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                        {relativeTime(n.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteNotification(n.id);
                        }}
                        disabled={deletingId === n.id}
                        className="shrink-0 text-[#72808C] hover:text-[#1C3040] disabled:opacity-50"
                        aria-label="Delete notification"
                        title="Delete notification"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                          <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p
                    className="mt-2 text-[13px] leading-relaxed text-[#50626C] sm:text-[14px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {n.body}
                  </p>
                  {clickable && (
                    <p className="mt-3 text-[13px] font-medium text-[#2563EB]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
                      {n.meta?.nav === "orders" ? "View orders →" : "View support →"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <VendorFooter variant="minimal" />
    </div>
  );
}

function NotifTab({ label, isActive, onClick }: { label: string; isActive: boolean; onClick: () => void }) {
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

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white p-6 text-[#1C3040]">Loading…</div>}>
      <NotificationsPageInner />
    </Suspense>
  );
}
