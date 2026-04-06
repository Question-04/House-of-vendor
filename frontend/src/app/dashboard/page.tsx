"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { getOnboardingPhone } from "@/lib/onboarding-session";
import { useProfileQuery, useOrdersQuery, useInventoryQuery } from "@/lib/dashboard-queries";
import SiteFooter from "@/components/site-footer";
import {
  EyeClosedIcon,
  EyeOpenIcon,
  InfoIcon,
  ArrowRightIcon,
  TrendUpIcon,
  TrendDownIcon,
} from "@/components/dashboard-icons";

const ACCENT = "#c7a77b";
const VALUE_COLOR = "#051f2d";
const LABEL_COLOR = "#50626c";
const PANEL_BORDER = "#9BA5AB";
const TREND_UP = "#16a34a";
const TREND_DOWN = "#dc2626";
const TREND_ZERO = "#ca8a04";

function formatINR(cents: number): string {
  const inr = Math.round(cents / 100);
  return "₹ " + inr.toLocaleString("en-IN");
}

function useDashboardData() {
  const phone = typeof window !== "undefined" ? getOnboardingPhone() : "";
  const profileQuery = useProfileQuery(phone);
  const ordersQuery = useOrdersQuery(phone);
  const inventoryQuery = useInventoryQuery(phone);

  const loading = profileQuery.isPending || ordersQuery.isPending || inventoryQuery.isPending;

  const { userName, orderCounts, inventoryStats, listingValue, sales, profitLoss } = useMemo(() => {
    const orders = ordersQuery.data ?? [];
    const inv = inventoryQuery.data ?? [];
    const profile = profileQuery.data;

    const userName = profile?.fullName?.trim() ?? "";

    const pending = orders.filter((o) => o.status === "pending").length;
    const waiting_pickup = orders.filter((o) => o.status === "waiting_pickup").length;
    const in_transit = orders.filter((o) => o.status === "in_transit").length;
    const payment_pending = orders.filter((o) => o.status === "payment_pending").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const orderCounts = { pending, waiting_pickup, in_transit, payment_pending, completed };

    const notSoldOut = inv.filter((i) => !i.soldOut);
    const totalCostCents = notSoldOut.reduce((s, i) => s + (i.purchasePriceCents ?? 0), 0);
    const listed = notSoldOut.filter((i) => i.listingStatus === "list_now");
    const unlisted = notSoldOut.filter((i) => i.listingStatus === "save_for_later");
    const listedCostCents = listed.reduce((s, i) => s + (i.purchasePriceCents ?? 0), 0);
    const unlistedCostCents = unlisted.reduce((s, i) => s + (i.purchasePriceCents ?? 0), 0);
    const inventoryStats = {
      totalCostCents,
      totalSkus: notSoldOut.length,
      listedSkus: listed.length,
      unlistedSkus: unlisted.length,
      listedCostCents,
      unlistedCostCents,
    };

    const totalListedPriceCents = listed.reduce((s, i) => s + (i.listedPriceCents ?? 0), 0);
    const listingValue = {
      totalListedPriceCents,
      totalListedPurchaseCents: listedCostCents,
      listedCount: listed.length,
    };

    const completedOrders = orders.filter((o) => o.status === "completed");
    const nowMs = completedOrders.reduce((max, o) => {
      const t = new Date(o.updatedAt).getTime();
      return Number.isFinite(t) ? Math.max(max, t) : max;
    }, 0);
    const oneDay = 24 * 60 * 60 * 1000;
    const allTimeCents = completedOrders.reduce((s, o) => s + (o.payoutCents ?? 0), 0);
    const last7Cents = completedOrders
      .filter((o) => new Date(o.updatedAt).getTime() >= nowMs - 7 * oneDay)
      .reduce((s, o) => s + (o.payoutCents ?? 0), 0);
    const last30Cents = completedOrders
      .filter((o) => new Date(o.updatedAt).getTime() >= nowMs - 30 * oneDay)
      .reduce((s, o) => s + (o.payoutCents ?? 0), 0);
    const sales = {
      allTimeCents,
      countSold: completedOrders.length,
      last7Cents,
      last30Cents,
    };

    const plAll = completedOrders.reduce((s, o) => s + (o.profitLossCents ?? 0), 0);
    const todayStartMs = new Date(nowMs).setHours(0, 0, 0, 0);
    const plToday = completedOrders
      .filter((o) => new Date(o.updatedAt).getTime() >= todayStartMs)
      .reduce((s, o) => s + (o.profitLossCents ?? 0), 0);
    const pl7 = completedOrders
      .filter((o) => new Date(o.updatedAt).getTime() >= nowMs - 7 * oneDay)
      .reduce((s, o) => s + (o.profitLossCents ?? 0), 0);
    const pl30 = completedOrders
      .filter((o) => new Date(o.updatedAt).getTime() >= nowMs - 30 * oneDay)
      .reduce((s, o) => s + (o.profitLossCents ?? 0), 0);
    const profitLoss = {
      allTimeCents: completedOrders.length ? plAll : null,
      todayCents: completedOrders.length ? plToday : null,
      last7Cents: completedOrders.length ? pl7 : null,
      last30Cents: completedOrders.length ? pl30 : null,
    };

    return { userName, orderCounts, inventoryStats, listingValue, sales, profitLoss };
  }, [profileQuery.data, ordersQuery.data, inventoryQuery.data]);

  return {
    userName,
    orderCounts,
    inventoryStats,
    listingValue,
    sales,
    profitLoss,
    loading: !!phone && loading,
  };
}

export default function DashboardPage() {
  const {
    userName,
    orderCounts,
    inventoryStats,
    listingValue,
    sales,
    profitLoss,
    loading,
  } = useDashboardData();

  const [hiddenPanels, setHiddenPanels] = useState<Record<number, boolean>>({});
  const [activeDot, setActiveDot] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelCount = 4;

  const toggleHidden = useCallback((index: number) => {
    setHiddenPanels((h) => ({ ...h, [index]: !h[index] }));
  }, []);

  const scrollTo = useCallback((index: number) => {
    setActiveDot(index);
    scrollRef.current?.querySelector(`[data-panel="${index}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, []);

  const PANEL_GAP_PX = 24; // gap-6 between panels
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const step = (el.offsetWidth || 1) + PANEL_GAP_PX;
    const idx = Math.round(el.scrollLeft / step);
    setActiveDot(Math.min(Math.max(0, idx), panelCount - 1));
  }, []);

  const orderCards = useMemo(
    () => [
      {
        key: "pending",
        title: "Pending Orders",
        desc: "New orders awaiting your approval.",
        mobileDesc: "Awaiting your approval.",
        count: orderCounts.pending,
        tab: "pending",
      },
      {
        key: "waiting_pickup",
        title: "Waiting for Pickup",
        desc: "Accepted orders ready to be shipped or scheduled for pickup.",
        mobileDesc: "Accepted — ready to ship.",
        count: orderCounts.waiting_pickup,
        tab: "waiting_pickup",
      },
      {
        key: "in_transit",
        title: "In Transit",
        desc: "Orders currently on the way to the HOP warehouse.",
        mobileDesc: "On the way to warehouse.",
        count: orderCounts.in_transit,
        tab: "in_transit",
      },
      {
        key: "payment_pending",
        title: "Pending Payout",
        desc: "Payment that will be released after order completion.",
        mobileDesc: "Payout processing.",
        count: orderCounts.payment_pending,
        tab: "payment_pending",
      },
      {
        key: "completed",
        title: "Completed",
        desc: "Successfully delivered and closed orders.",
        mobileDesc: "Delivered & closed.",
        count: orderCounts.completed,
        tab: "completed",
      },
      {
        key: "rejected_products",
        title: "Rejected Products",
        desc: "Products that didn’t pass verification and require updates.",
        mobileDesc: "Needs updates to verify.",
        count: 0,
        tab: "rejected_products",
      },
    ],
    [orderCounts]
  );

  const listingTrendUp = listingValue.totalListedPriceCents > listingValue.totalListedPurchaseCents;
  const listingTrendDown = listingValue.totalListedPurchaseCents > listingValue.totalListedPriceCents;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
        <p className="text-[16px] text-[#72808C]">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-[1650px] px-4 pb-24 pt-6 sm:px-8 sm:pb-5 sm:pt-10 lg:px-0"
      style={{ fontFamily: "'Montserrat', Arial, sans-serif", ["--spacing" as string]: "4px" }}
    >
      {/* Welcome */}
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#72808C] sm:text-[18px]">Welcome back,</p>
      <h1
        className="mt-1 text-[26px] font-bold text-[#1C3040] sm:text-[40px]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
      >
        {userName || "Vendor"}
      </h1>
      <p className="mt-1.5 text-[13px] font-normal leading-snug text-[#50626C] sm:mt-2 sm:text-[15px] sm:leading-normal">
        Real-time insights into your sales, verification status and inventory performance.
      </p>

      {/* Order summary cards: 2 per row, gap and padding use --spacing */}
      <div className="mt-6 rounded-none bg-[#051f2d] p-4 sm:mt-10 sm:p-[calc(var(--spacing)*10)]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-[calc(var(--spacing)*5)]">
          {orderCards.map((card) => (
            <Link
              key={card.key}
              href={`/dashboard/orders?tab=${card.tab}`}
              className="flex min-h-[140px] items-start justify-between rounded-none bg-[#1d3542] p-3 text-left transition hover:opacity-95 sm:min-h-[220px] sm:p-[calc(var(--spacing)*10)]"
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-medium leading-snug text-white break-words sm:text-[28px]">
                  {card.title}
                </h3>
                <p className="mt-1.5 text-[11px] font-normal leading-snug text-white/90 sm:mt-2 sm:text-[18px]">
                  {card.mobileDesc}
                </p>
                <p className="mt-3 text-[18px] font-semibold sm:mt-5 sm:text-[36px]" style={{ color: ACCENT }}>
                  {card.count}
                </p>
              </div>
              <span className="ml-2 shrink-0 text-white/80 sm:ml-4">
                <ArrowRightIcon />
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Scrollable panels: one box at a time, with gap so panels don't feel edge-to-edge */}
      <div className="mt-10 w-full">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* Panel 0: Current Inventory Cost */}
          <section
            data-panel="0"
            className="w-full min-w-full shrink-0 snap-start snap-always rounded-none border bg-white p-5 sm:p-[calc(var(--spacing)*5)]"
            style={{ borderColor: PANEL_BORDER }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[24px] font-medium sm:text-[32px]" style={{ color: VALUE_COLOR }}>
                  {hiddenPanels[0] ? "xx,xxx" : formatINR(inventoryStats.totalCostCents)}
                </p>
                <p className="mt-1 text-[14px] font-medium sm:mt-1.5 sm:text-[18px]" style={{ color: LABEL_COLOR }}>
                  Current Inventory Cost
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleHidden(0)}
                  className="rounded p-1.5 hover:bg-[#f2f3f4]"
                  style={{ color: LABEL_COLOR }}
                  aria-label={hiddenPanels[0] ? "Show value" : "Hide value"}
                >
                  {hiddenPanels[0] ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
                <span className="relative group">
                  <span className="cursor-help rounded p-1.5 hover:bg-[#f2f3f4]" style={{ color: LABEL_COLOR }}>
                    <InfoIcon />
                  </span>
                  <span className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 hidden w-52 rounded bg-[#1C3040] px-2 py-1.5 text-[12px] text-white shadow group-hover:block">
                    Total purchase cost of all inventory (excluding sold-out items).
                  </span>
                </span>
              </div>
            </div>
            <div className="mt-6 border-t pt-5" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex justify-between text-[13px] sm:text-[16px]">
                <span className="font-medium" style={{ color: LABEL_COLOR }}>Total SKUs in Inventory</span>
                <span className="font-medium" style={{ color: VALUE_COLOR }}>{inventoryStats.totalSkus}</span>
              </div>
              <div className="flex justify-between text-[13px] sm:text-[16px]" style={{ marginTop: "calc(var(--spacing) * 5)" }}>
                <span className="font-medium" style={{ color: LABEL_COLOR }}>Listed SKUs</span>
                <span className="font-medium" style={{ color: VALUE_COLOR }}>{formatINR(inventoryStats.listedCostCents)}</span>
              </div>
              <div className="flex justify-between text-[13px] sm:text-[16px]" style={{ marginTop: "calc(var(--spacing) * 5)" }}>
                <span className="font-medium" style={{ color: LABEL_COLOR }}>Unlisted SKUs</span>
                <span className="font-medium" style={{ color: VALUE_COLOR }}>{formatINR(inventoryStats.unlistedCostCents)}</span>
              </div>
            </div>
          </section>

          {/* Panel 1: Current Listing Value — value green when trend up, red when trend down */}
          <section
            data-panel="1"
            className="w-full min-w-full shrink-0 snap-start snap-always rounded-none border bg-white p-5 sm:p-[calc(var(--spacing)*5)]"
            style={{ borderColor: PANEL_BORDER }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-3">
                  <p
                    className="text-[24px] font-medium sm:text-[32px]"
                    style={{
                      color: hiddenPanels[1]
                        ? VALUE_COLOR
                        : listingTrendUp
                          ? TREND_UP
                          : listingTrendDown
                            ? TREND_DOWN
                            : VALUE_COLOR,
                    }}
                  >
                    {hiddenPanels[1] ? "xx,xxx" : formatINR(listingValue.totalListedPriceCents)}
                  </p>
                  {!hiddenPanels[1] && listingTrendUp && <span style={{ color: TREND_UP }}><TrendUpIcon /></span>}
                  {!hiddenPanels[1] && listingTrendDown && <span style={{ color: TREND_DOWN }}><TrendDownIcon /></span>}
                </div>
                <p className="mt-1 text-[14px] font-medium sm:mt-1.5 sm:text-[18px]" style={{ color: LABEL_COLOR }}>
                  Current Listing Value
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-2">
                <button type="button" onClick={() => toggleHidden(1)} className="rounded p-1.5 hover:bg-[#f2f3f4]" style={{ color: LABEL_COLOR }} aria-label={hiddenPanels[1] ? "Show value" : "Hide value"}>
                  {hiddenPanels[1] ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
                <span className="relative group">
                  <span className="cursor-help rounded p-1.5 hover:bg-[#f2f3f4]" style={{ color: LABEL_COLOR }}><InfoIcon /></span>
                  <span className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 hidden w-52 rounded bg-[#1C3040] px-2 py-1.5 text-[12px] text-white shadow group-hover:block">
                    Total listed price of products currently live on the main website (list now only).
                  </span>
                </span>
              </div>
            </div>
            <div className="mt-6 border-t pt-5" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex justify-between text-[13px] sm:text-[16px]">
                <span className="font-medium" style={{ color: LABEL_COLOR }}>Listed SKUs</span>
                <span className="font-medium" style={{ color: VALUE_COLOR }}>{listingValue.listedCount}</span>
              </div>
              <div className="flex justify-between text-[13px] sm:text-[16px]" style={{ marginTop: "calc(var(--spacing) * 5)" }}>
                <span className="font-medium" style={{ color: LABEL_COLOR }}>Listed Inventory Cost</span>
                <span className="font-medium" style={{ color: VALUE_COLOR }}>{formatINR(listingValue.totalListedPurchaseCents)}</span>
              </div>
            </div>
          </section>

          {/* Panel 2: Sales */}
          <section
            data-panel="2"
            className="w-full min-w-full shrink-0 snap-start snap-always rounded-none border bg-white p-5 sm:p-[calc(var(--spacing)*5)]"
            style={{ borderColor: PANEL_BORDER }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[24px] font-medium sm:text-[32px]" style={{ color: VALUE_COLOR }}>
                  {hiddenPanels[2] ? "xx,xxx" : formatINR(sales.allTimeCents)}
                </p>
                <p className="mt-1 text-[14px] font-medium sm:mt-1.5 sm:text-[18px]" style={{ color: LABEL_COLOR }}>
                  Sales (All Time)
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-2">
                <button type="button" onClick={() => toggleHidden(2)} className="rounded p-1.5 hover:bg-[#f2f3f4]" style={{ color: LABEL_COLOR }} aria-label={hiddenPanels[2] ? "Show value" : "Hide value"}>
                  {hiddenPanels[2] ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
                <span className="relative group">
                  <span className="cursor-help rounded p-1.5 hover:bg-[#f2f3f4]" style={{ color: LABEL_COLOR }}><InfoIcon /></span>
                  <span className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 hidden w-52 rounded bg-[#1C3040] px-2 py-1.5 text-[12px] text-white shadow group-hover:block">
                    Total sales from completed orders.
                  </span>
                </span>
              </div>
            </div>
            <div className="mt-6 border-t pt-5" style={{ borderColor: PANEL_BORDER }}>
              <div className="flex justify-between text-[13px] sm:text-[16px]">
                <span className="font-medium" style={{ color: LABEL_COLOR }}>Count of SKUs Sold</span>
                <span className="font-medium" style={{ color: VALUE_COLOR }}>{sales.countSold}</span>
              </div>
              <div className="flex justify-between text-[13px] sm:text-[16px]" style={{ marginTop: "calc(var(--spacing) * 5)" }}>
                <span className="font-medium" style={{ color: LABEL_COLOR }}>Sales (7 days)</span>
                <span className="font-medium" style={{ color: VALUE_COLOR }}>{hiddenPanels[2] ? "xx,xxx" : formatINR(sales.last7Cents)}</span>
              </div>
              <div className="flex justify-between text-[13px] sm:text-[16px]" style={{ marginTop: "calc(var(--spacing) * 5)" }}>
                <span className="font-medium" style={{ color: LABEL_COLOR }}>Sales (30 days)</span>
                <span className="font-medium" style={{ color: VALUE_COLOR }}>{hiddenPanels[2] ? "xx,xxx" : formatINR(sales.last30Cents)}</span>
              </div>
            </div>
          </section>

          {/* Panel 3: Released Profit/Loss — value green/red/yellow to match trend */}
          <section
            data-panel="3"
            className="w-full min-w-full shrink-0 snap-start snap-always rounded-none border bg-white p-5 sm:p-[calc(var(--spacing)*5)]"
            style={{ borderColor: PANEL_BORDER }}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-3">
                  <p
                    className="text-[24px] font-medium sm:text-[32px]"
                    style={{
                      color: hiddenPanels[3]
                        ? VALUE_COLOR
                        : profitLoss.allTimeCents === null
                          ? TREND_ZERO
                          : profitLoss.allTimeCents >= 0
                            ? TREND_UP
                            : TREND_DOWN,
                    }}
                  >
                    {hiddenPanels[3] ? "xx,xxx" : profitLoss.allTimeCents === null ? "0" : formatINR(profitLoss.allTimeCents)}
                  </p>
                  {!hiddenPanels[3] && profitLoss.allTimeCents !== null && (
                    profitLoss.allTimeCents >= 0 ? <span style={{ color: TREND_UP }}><TrendUpIcon /></span> : <span style={{ color: TREND_DOWN }}><TrendDownIcon /></span>
                  )}
                  {!hiddenPanels[3] && profitLoss.allTimeCents === null && <span className="text-[24px] font-medium" style={{ color: TREND_ZERO }}>0</span>}
                </div>
                <p className="mt-1 text-[14px] font-medium sm:mt-1.5 sm:text-[18px]" style={{ color: LABEL_COLOR }}>
                  Released Profit/Loss
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-2">
                <button type="button" onClick={() => toggleHidden(3)} className="rounded p-1.5 hover:bg-[#f2f3f4]" style={{ color: LABEL_COLOR }} aria-label={hiddenPanels[3] ? "Show value" : "Hide value"}>
                  {hiddenPanels[3] ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </button>
                <span className="relative group">
                  <span className="cursor-help rounded p-1.5 hover:bg-[#f2f3f4]" style={{ color: LABEL_COLOR }}><InfoIcon /></span>
                  <span className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 hidden w-52 rounded bg-[#1C3040] px-2 py-1.5 text-[12px] text-white shadow group-hover:block">
                    Profit/loss from completed orders (payout vs cost).
                  </span>
                </span>
              </div>
            </div>
            <div className="mt-6 border-t pt-5" style={{ borderColor: PANEL_BORDER }}>
              {(["today", "last7", "last30"] as const).map((key, i) => {
                const label = key === "today" ? "Profit/Loss (today)" : key === "last7" ? "Profit/Loss (7 days)" : "Profit/Loss (30 days)";
                const val = key === "today" ? profitLoss.todayCents : key === "last7" ? profitLoss.last7Cents : profitLoss.last30Cents;
                const color = val === null ? TREND_ZERO : val >= 0 ? TREND_UP : TREND_DOWN;
                return (
                  <div
                    key={key}
                    className="flex justify-between text-[13px] sm:text-[16px]"
                    style={i > 0 ? { marginTop: "calc(var(--spacing) * 5)" } : undefined}
                  >
                    <span className="font-medium" style={{ color: LABEL_COLOR }}>{label}</span>
                    <span className="font-medium" style={{ color: hiddenPanels[3] ? VALUE_COLOR : color }}>
                      {hiddenPanels[3] ? "xx,xxx" : val === null ? "0" : formatINR(val)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        {/* Dots */}
        <div className="mt-4 flex justify-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              className={`h-2 w-2 rounded-full transition ${activeDot === i ? "bg-[#1C3040]" : "bg-[#D1D5DB]"}`}
              aria-label={`Panel ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Helpful Tips */}
      <section className="mt-14">
        <h2 className="text-[24px] font-medium text-[#1C3040] sm:text-[32px]" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}>
          Helpful Tips
        </h2>
        <p className="mt-2 text-[13px] font-normal leading-snug text-[#50626C] sm:text-[16px] sm:leading-normal">
          Watch this quick walkthrough to understand how the platform works and where and how to manage your inventory, orders, and payouts.
        </p>
        <div
          className="mt-5 flex w-full items-center justify-center rounded-none border border-[#E5E7EB] bg-[#f9fafb] shadow-lg aspect-video sm:mt-6 sm:min-h-[480px] sm:aspect-auto"
          style={{ boxShadow: `0 0 0 1px rgba(0,0,0,0.05), 0 8px 24px -4px rgba(199, 167, 123, 0.25), 0 4px 12px -2px rgba(199, 167, 123, 0.15)` }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-[#1C3040] shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256">
              <path d="M240,128a15.74,15.74,0,0,0-7.6-13.51L88.32,35.0A15.91,15.91,0,0,0,72,48V208a15.91,15.91,0,0,0,16.32,13,16,16,0,0,0,9.47-5.48L240,141.49A15.74,15.74,0,0,0,240,128ZM88,208.46V47.54L224.91,128Z" />
            </svg>
          </div>
          <p className="sr-only">Video placeholder — video will be added later</p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
