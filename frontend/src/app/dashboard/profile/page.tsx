"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import SiteFooter from "@/components/site-footer";
import MobileFooterDropdown from "@/components/mobile-footer-dropdown";
import { getOnboardingPhone, setOnboardingPhone } from "@/lib/onboarding-session";
import { useProfileQuery, useOrdersQuery, useInventoryQuery, useVouchStatusQuery } from "@/lib/dashboard-queries";
import { normalizePhone } from "@/lib/msg91-widget";

const DARK_BG = "#051f2d";
const PANEL_BORDER = "#364B56";
const ICON_COLOR = "#c7a77b";
const VALUE_COLOR = "#051f2d";
const LABEL_COLOR = "#50626c";

function formatINR(cents: number): string {
  const inr = Math.round(cents / 100);
  return "₹ " + inr.toLocaleString("en-IN");
}

function formatMobileINR(cents: number | null): string {
  const safeCents = cents ?? 0;
  const rupees = Math.round(safeCents / 100);
  const sign = rupees < 0 ? "-" : "";
  const absRupees = Math.abs(rupees);

  if (absRupees === 0) return "₹ 0";

  const LAKH = 100_000;
  const CRORE = 10_000_000;

  // Requirement: after 99L, show "1 CR" (instead of 99.xxL).
  if (absRupees >= 99 * LAKH) {
    if (absRupees < CRORE) return `${sign}₹ 1 CR`;

    const cr = Math.floor(absRupees / CRORE);
    const remRupees = absRupees - cr * CRORE;
    let remLakh = Math.round(remRupees / LAKH);

    // Rounding can push the remainder to 100L => next CR.
    if (remLakh === 100) {
      return `${sign}₹ ${cr + 1} CR`;
    }

    return remLakh > 0 ? `${sign}₹ ${cr} CR ${remLakh}L` : `${sign}₹ ${cr} CR`;
  }

  const lakh = absRupees / LAKH;
  return `${sign}₹ ${lakh.toFixed(2)}L`;
}

function useProfileData() {
  const phone = typeof window !== "undefined" ? getOnboardingPhone() : "";
  const profileQuery = useProfileQuery(phone);
  const ordersQuery = useOrdersQuery(phone);
  const inventoryQuery = useInventoryQuery(phone);
  const vouchQuery = useVouchStatusQuery(phone);

  const loading = profileQuery.isPending || ordersQuery.isPending || inventoryQuery.isPending || vouchQuery.isPending;

  const {
    profile,
    userInitial,
    totalSalesCents,
    vouchCount,
    totalPurchaseCents,
    totalProfitCents,
    inventoryItemCount,
    listedItemCount,
    unlistedItemCount,
  } = useMemo(() => {
    const p = profileQuery.data;
    const orders = ordersQuery.data ?? [];
    const inv = inventoryQuery.data ?? [];
    const vouch = vouchQuery.data?.vouchCount ?? 0;

    const profile = p ? { fullName: (p.fullName ?? "").trim(), email: p.email ?? "" } : null;
    const userInitial = profile?.fullName?.charAt(0).toUpperCase() || "V";

    const completedOrders = orders.filter((o) => o.status === "completed");
    const totalSalesCents = completedOrders.reduce((s, o) => s + (o.payoutCents ?? 0), 0);
    const totalProfitCents = completedOrders.length ? completedOrders.reduce((s, o) => s + (o.profitLossCents ?? 0), 0) : null;

    const notSoldOut = inv.filter((i) => !i.soldOut);
    const totalPurchaseCents = notSoldOut.reduce((s, i) => s + (i.purchasePriceCents ?? 0), 0);
    const inventoryItemCount = notSoldOut.length;
    const listedItems = notSoldOut.filter((i) => i.listingStatus === "list_now");
    const unlistedItems = notSoldOut.filter((i) => i.listingStatus === "save_for_later");

    return {
      profile,
      userInitial,
      totalSalesCents,
      vouchCount: vouch,
      totalPurchaseCents,
      totalProfitCents,
      inventoryItemCount,
      listedItemCount: listedItems.length,
      unlistedItemCount: unlistedItems.length,
    };
  }, [profileQuery.data, ordersQuery.data, inventoryQuery.data, vouchQuery.data]);

  return {
    profile,
    userInitial,
    totalSalesCents,
    vouchCount,
    totalPurchaseCents,
    totalProfitCents,
    inventoryItemCount,
    listedItemCount,
    unlistedItemCount,
    loading: !!phone && loading,
  };
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-none bg-[#EAF2FF] px-2 py-1 sm:bg-transparent sm:px-0 sm:py-0">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1E5CC8] sm:h-5 sm:w-5">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" fill="none" stroke="white" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="48 144 96 192 208 64" />
        </svg>
      </span>
      <span className="text-[13px] font-medium text-[#1E5CC8] sm:text-[14px] sm:text-[#16a34a]" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
        Verified
      </span>
    </span>
  );
}

// Icon wrapper for SVG assets on dark background
function IconWrap({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mt-1 flex h-14 w-14 items-center justify-center">
      <Image src={src} alt={alt} width={40} height={40} />
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const phone = typeof window !== "undefined" ? normalizePhone(getOnboardingPhone()) : "";
  const [adminVisible, setAdminVisible] = useState(false);

  const {
    profile,
    userInitial,
    totalSalesCents,
    vouchCount,
    totalPurchaseCents,
    totalProfitCents,
    inventoryItemCount,
    listedItemCount,
    unlistedItemCount,
    loading,
  } = useProfileData();

  useEffect(() => {
    if (!phone) return;
    void (async () => {
      try {
        const res = await fetch("/api/admin-visibility", { cache: "no-store" });
        const data = (await res.json()) as { allowed?: boolean };
        setAdminVisible(Boolean(data?.allowed));
      } catch {
        setAdminVisible(false);
      }
    })();
  }, [phone]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
        <p className="text-[16px] text-[#72808C]">Loading profile…</p>
      </div>
    );
  }

  const headingStyle = { fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 };
  const mobileHeadingStyle = { fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 };
  const subtitleStyle = { fontFamily: "'Montserrat', Arial, sans-serif" };
  const cardTitleStyle = { fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "20px", fontWeight: 500 };
  const cardDescStyle = { fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "14px", fontWeight: 400 };
  const cardTitleStyleMobile = { fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 500 };
  const cardDescStyleMobile = { fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 400 };

  const iconColorStyle = { color: ICON_COLOR };
  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);

    // This app uses sessionStorage for the "signed in" vendor phone.
    try {
      setOnboardingPhone("");
      window.sessionStorage.removeItem("vendor_onboarding_phone");
    } catch {
      // ignore
    }

    router.push("/");
  };

  return (
    <div
      className="mx-auto w-full max-w-[1650px] px-4 pb-24 pt-6 sm:px-8 sm:pb-5 sm:pt-10 lg:px-0"
      style={{ fontFamily: "'Montserrat', Arial, sans-serif", ["--spacing" as string]: "4px" }}
    >
      {/* Mobile header: back arrow + title in same row */}
      <div className="mb-6 flex items-center gap-4 sm:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center border border-[#c7a77b] bg-[#f2f3f4]"
          aria-label="Go back"
        >
          <BackIcon className="h-5 w-5 shrink-0 text-[#1C3040]" />
        </button>
        <h1 className="truncate text-[20px] text-[#1C3040]" style={mobileHeadingStyle}>
          Your Profile
        </h1>
      </div>

      {/* Desktop / web header */}
      <div className="hidden sm:block">
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-none border-2 border-[#c7a77b] bg-white px-3 py-2 hover:bg-[#c7a77b]/10"
          >
            <BackIcon className="h-5 w-5 shrink-0 text-[#1C3040]" />
            <span className="font-semibold text-[#1C3040]" style={{ fontSize: "15px" }}>
              Back
            </span>
          </button>
        </div>

        <h1 className="text-[40px] text-[#1C3040]" style={headingStyle}>
          Your Profile
        </h1>
      </div>

      {/* User info card */}
      <div className="mt-8 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] p-4 sm:p-8">
        <div className="flex items-center gap-3 sm:flex-wrap sm:gap-6">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[20px] font-medium text-white sm:h-24 sm:w-24 sm:text-[32px]"
            style={{ backgroundColor: "#6B4E9B" }}
          >
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-semibold text-[#1C3040] sm:text-[24px]" style={subtitleStyle}>
              {profile?.fullName || "Vendor"}
            </p>
            <p className="mt-0.5 text-[12px] text-[#50626C] sm:mt-1 sm:text-[16px]" style={subtitleStyle}>
              {profile?.email || "—"}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-start gap-15 sm:items-end">
            <VerifiedBadge />
            {adminVisible ? (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-none border border-[#DCE1E6] bg-white/70 px-3 py-2 text-[14px] font-semibold text-[#1C3040] hover:bg-white"
              >
                Admin
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="hidden items-center gap-2 text-[14px] font-semibold text-[#1C3040] hover:text-[#c7a77b] sm:inline-flex"
            >
              <LogoutIcon />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <section className="mt-12">
        <h2 className="text-[28px] text-[#1C3040] sm:text-[40px]" style={headingStyle}>
          Performance Overview
        </h2>
        <p className="mt-1 text-[14px] text-[#72808C] sm:text-[16px]" style={subtitleStyle}>
          Track your sales, purchases, and profit in one place.
        </p>
        <Link href="/dashboard" className="mt-2 block text-[13px] font-semibold text-[#2B74FF] sm:text-[14px]">
          Check your dashboard →
        </Link>

        <div
          className="mt-6 rounded-none px-4 py-10 sm:px-14 sm:py-[60px]"
          style={{ backgroundColor: DARK_BG, borderColor: PANEL_BORDER, borderWidth: 1 }}
        >
          {/* Desktop layout */}
          <div className="hidden grid-cols-1 gap-8 sm:grid sm:grid-cols-3">
            {/* Total Sales */}
            <div className="flex gap-4 border-b border-white/15 pb-6 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-10">
              <IconWrap src="/Total sales.svg" alt="Total sales" />
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-white" style={cardTitleStyle}>
                  Total Sales
                </p>
                <p className="mt-1 text-[14px] text-white/80" style={cardDescStyle}>
                  Revenue generated from completed orders.
                </p>
                <p className="mt-4 text-[26px] font-semibold" style={{ color: ICON_COLOR }}>
                  {formatINR(totalSalesCents)}
                </p>
              </div>
            </div>

            {/* Total Purchases */}
            <div className="flex gap-4 border-b border-white/15 pb-6 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-10">
              <IconWrap src="/Total purchase.svg" alt="Total purchases" />
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-white" style={cardTitleStyle}>
                  Total Purchases
                </p>
                <p className="mt-1 text-[14px] text-white/80" style={cardDescStyle}>
                  Total amount spent on inventory.
                </p>
                <p className="mt-4 text-[26px] font-semibold" style={{ color: ICON_COLOR }}>
                  {formatINR(totalPurchaseCents)}
                </p>
              </div>
            </div>

            {/* Total Profit */}
            <div className="flex gap-4 sm:pl-10">
              <IconWrap src="/Total profit.svg" alt="Total profit" />
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-white" style={cardTitleStyle}>
                  Total Profit
                </p>
                <p className="mt-1 text-[14px] text-white/80" style={cardDescStyle}>
                  Your released earnings after costs.
                </p>
                <p className="mt-4 text-[26px] font-semibold" style={{ color: ICON_COLOR }}>
                  {totalProfitCents !== null ? formatINR(totalProfitCents) : "₹ 0"}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-6">
              <div className="flex min-w-0 items-start gap-3">
                <IconWrapMobile src="/Total sales.svg" alt="Total sales" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white" style={cardTitleStyleMobile}>
                    Total Sales
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/80" style={cardDescStyleMobile}>
                    Revenue generated from completed orders.
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-[16px] font-semibold" style={iconColorStyle}>
                {formatMobileINR(totalSalesCents)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-white/15 py-6">
              <div className="flex min-w-0 items-start gap-3">
                <IconWrapMobile src="/Total purchase.svg" alt="Total purchases" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white" style={cardTitleStyleMobile}>
                    Total Purchases
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/80" style={cardDescStyleMobile}>
                    Total amount spent on inventory.
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-[16px] font-semibold" style={iconColorStyle}>
                {formatMobileINR(totalPurchaseCents)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 pt-6">
              <div className="flex min-w-0 items-start gap-3">
                <IconWrapMobile src="/Total profit.svg" alt="Total profit" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white" style={cardTitleStyleMobile}>
                    Total Profit
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/80" style={cardDescStyleMobile}>
                    Your released earnings after costs.
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-[16px] font-semibold" style={iconColorStyle}>
                {formatMobileINR(totalProfitCents)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Inventory */}
      <section className="mt-12">
        <h2 className="text-[28px] text-[#1C3040] sm:text-[40px]" style={headingStyle}>
          Inventory
        </h2>
        <p className="mt-1 text-[14px] text-[#72808C] sm:text-[16px]" style={subtitleStyle}>
          Monitor your stock value, market worth, and profit across listed items.
        </p>

        <div
          className="mt-6 rounded-none px-4 py-10 sm:px-15 sm:py-[60px]"
          style={{ backgroundColor: DARK_BG, borderColor: PANEL_BORDER, borderWidth: 1 }}
        >
          {/* Desktop layout */}
          <div className="hidden grid-cols-1 gap-8 sm:grid sm:grid-cols-2">
            {/* Total Products */}
            <div className="flex gap-4 pb-6 sm:min-h-[160px] sm:border-r sm:border-white/15 sm:pb-0 sm:pr-10">
              <IconWrap src="/Total Products.svg" alt="Total products" />
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-white" style={cardTitleStyle}>
                  Total Products
                </p>
                <p className="mt-1 text-[14px] text-white/80" style={cardDescStyle}>
                  All products currently in your inventory.
                </p>
                <p className="mt-4 text-[26px] font-semibold" style={{ color: ICON_COLOR }}>
                  {inventoryItemCount}
                </p>
              </div>
            </div>

            {/* Inventory Value */}
            <div className="flex gap-4 pb-6 sm:min-h-[160px] sm:pb-0 sm:pl-10">
              <IconWrap src="/Inventory Value.svg" alt="Inventory value" />
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-white" style={cardTitleStyle}>
                  Inventory Value
                </p>
                <p className="mt-1 text-[14px] text-white/80" style={cardDescStyle}>
                  Total market value of all products in inventory.
                </p>
                <p className="mt-4 text-[26px] font-semibold" style={{ color: ICON_COLOR }}>
                  {formatINR(totalPurchaseCents)}
                </p>
              </div>
            </div>

            {/* Listed Products */}
            <div className="flex gap-4 pb-6 sm:min-h-[160px] sm:border-r sm:border-white/15 sm:pb-0 sm:pr-10">
              <IconWrap src="/Total sales.svg" alt="Listed products" />
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-white" style={cardTitleStyle}>
                  Listed Products
                </p>
                <p className="mt-1 text-[14px] text-white/80" style={cardDescStyle}>
                  Products currently listed and available for sale.
                </p>
                <p className="mt-4 text-[26px] font-semibold" style={{ color: ICON_COLOR }}>
                  {listedItemCount}
                </p>
              </div>
            </div>

            {/* Unlisted Products */}
            <div className="flex gap-4 pb-6 sm:min-h-[160px] sm:pb-0 sm:pl-10">
              <IconWrap src="/Unlisted products icon.svg" alt="Unlisted products" />
              <div className="min-w-0">
                <p className="text-[18px] font-medium text-white" style={cardTitleStyle}>
                  Unlisted Products
                </p>
                <p className="mt-1 text-[14px] text-white/80" style={cardDescStyle}>
                  Products in your inventory that are not listed on the platform yet.
                </p>
                <p className="mt-4 text-[26px] font-semibold" style={{ color: ICON_COLOR }}>
                  {unlistedItemCount}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile layout */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-6">
              <div className="flex min-w-0 items-start gap-3">
                <IconWrapMobile src="/Total Products.svg" alt="Total products" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white" style={cardTitleStyleMobile}>
                    Total Products
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/80" style={cardDescStyleMobile}>
                    All products currently in your inventory.
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-[16px] font-semibold" style={iconColorStyle}>
                {inventoryItemCount}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-white/15 py-6">
              <div className="flex min-w-0 items-start gap-3">
                <IconWrapMobile src="/Inventory Value.svg" alt="Inventory value" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white" style={cardTitleStyleMobile}>
                    Inventory Value
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/80" style={cardDescStyleMobile}>
                    Total market value of all products in inventory.
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-[16px] font-semibold" style={iconColorStyle}>
                {formatMobileINR(totalPurchaseCents)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-white/15 py-6">
              <div className="flex min-w-0 items-start gap-3">
                <IconWrapMobile src="/Total sales.svg" alt="Listed products" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white" style={cardTitleStyleMobile}>
                    Listed Products
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/80" style={cardDescStyleMobile}>
                    Products currently listed and available for sale.
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-[16px] font-semibold" style={iconColorStyle}>
                {listedItemCount}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 pt-6">
              <div className="flex min-w-0 items-start gap-3">
                <IconWrapMobile src="/Unlisted products icon.svg" alt="Unlisted products" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white" style={cardTitleStyleMobile}>
                    Unlisted Products
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/80" style={cardDescStyleMobile}>
                    Products in your inventory that are not listed on the platform yet.
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-[16px] font-semibold" style={iconColorStyle}>
                {unlistedItemCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer: desktop uses the full SiteFooter, mobile uses the collapsed dropdown */}
      <div className="hidden sm:block mt-14">
        <SiteFooter />
      </div>

      <div className="sm:hidden">
        <MobileFooterDropdown
          expandedContent={<SiteFooter mobileHideTopBrand mobileHideTopBorder />}
          items={[
            { key: "support", label: "Support", icon: <SupportIcon /> , href: "/dashboard/support" },
            { key: "about", label: "About", icon: <AboutIcon />, href: "/dashboard/about" },
            { key: "privacy", label: "Privacy", icon: <PrivacyIcon />, href: "/dashboard/privacy" },
            { key: "logout", label: "Log out", icon: <LogoutIcon />, onClick: () => setShowLogoutConfirm(true) },
          ]}
        />
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[92%] max-w-[420px] rounded-none border border-[#DCE1E6] bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f3f4]">
                <LogoutIcon />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-semibold text-[#1C3040]">Leave now?</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#50626C]">
                  Would you like to leave now? Wouldn&apos;t your inventory wait for you like this?
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-none border border-[#DCE1E6] bg-white py-3 text-[14px] font-semibold text-[#1C3040]"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 rounded-none bg-[#c7a77b] py-3 text-[14px] font-semibold text-white"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IconWrapMobile({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center">
      <Image src={src} alt={alt} width={32} height={32} />
    </div>
  );
}

function SupportIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#1C3040" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M201.89,54.66A103.43,103.43,0,0,0,128.79,24H128A104,104,0,0,0,24,128v56a24,24,0,0,0,24,24H64a24,24,0,0,0,24-24V144a24,24,0,0,0-24-24H40.36A88.12,88.12,0,0,1,190.54,65.93,87.39,87.39,0,0,1,215.65,120H192a24,24,0,0,0-24,24v40a24,24,0,0,0,24,24h24a24,24,0,0,1-24,24H136a8,8,0,0,0,0,16h56a40,40,0,0,0,40-40V128A103.41,103.41,0,0,0,201.89,54.66ZM64,136a8,8,0,0,1,8,8v40a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V136Zm128,56a8,8,0,0,1-8-8V144a8,8,0,0,1,8-8h24v56Z" />
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#1C3040" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#1C3040" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#1C3040" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z" />
    </svg>
  );
}
