"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getProductDetail, getInventory, updateListingStatus, markInventorySold } from "@/lib/api";
import { dashboardQueryKeys } from "@/lib/dashboard-queries";
import type { ProductCard as ProductCardType, VendorInventory } from "@/lib/api";
import { getOnboardingPhone } from "@/lib/onboarding-session";
import VendorFooter from "@/components/vendor-footer";

// Size options by category: sneakers UK 2.5–13, apparel XS–XXL, rest OneSize
const SNEAKER_SIZES: string[] = (() => {
  const out: string[] = [];
  for (let i = 2.5; i <= 13; i += 0.5) out.push(`UK ${i}`);
  return out;
})();
const APPAREL_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"];
const ONE_SIZE = ["OneSize"];

function getSizesForCategory(category: string): string[] {
  const c = (category || "").toLowerCase();
  if (c === "sneakers") return SNEAKER_SIZES;
  if (c === "apparel") return APPAREL_SIZES;
  return ONE_SIZE;
}

function ProductDetailPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fromInventory = searchParams.get("inventory") === "1";
  const id = typeof params.id === "string" ? params.id : "";
  const categoryParam = searchParams.get("category") || "";
  const [product, setProduct] = useState<ProductCardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState<string>("");
  const [sizeOpen, setSizeOpen] = useState(false);
  const [inventory, setInventory] = useState<VendorInventory | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showListNowTooltip, setShowListNowTooltip] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [showUnlistConfirm, setShowUnlistConfirm] = useState(false);

  const category = categoryParam || (product?.category ?? "").toLowerCase();
  const sizes = getSizesForCategory(category);
  const displaySize = size || (sizes[0] ?? "");

  // For web dropdown: keep all sizes, but move the selected size to the top
  // so it stays visible even when it is far down in the full list.
  const desktopSizes = useMemo(() => {
    if (!displaySize || !sizes.includes(displaySize)) return sizes;
    const rest = sizes.filter((s) => s !== displaySize);
    return [displaySize, ...rest];
  }, [sizes, displaySize]);

  const loadProduct = useCallback(async () => {
    const cat = categoryParam || "";
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getProductDetail(cat || "sneakers", id);
      if (res.success && res.product) {
        setProduct(res.product);
        const nextCat = cat || (res.product.category ?? "").toLowerCase();
        const nextSizes = getSizesForCategory(nextCat);
        setSize((prev) => (nextSizes.includes(prev) ? prev : nextSizes[0] ?? ""));
      }
    } finally {
      setLoading(false);
    }
  }, [id, categoryParam]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const phone = typeof window !== "undefined" ? getOnboardingPhone() : "";
  useEffect(() => {
    if (!fromInventory || !id || !category || !phone || !product) return;
    getInventory(phone, id, category).then((res) => {
      if (res.success && res.inventory) setInventory(res.inventory);
    });
  }, [fromInventory, id, category, phone, product]);

  // When coming from Enter Details with a freshly saved inventory (unlisted by default),
  // block accidental browser back / tab close until the user explicitly chooses
  // List Now or Save for Later (which both navigate away via router.push).
  useEffect(() => {
    const shouldGuard =
      fromInventory &&
      inventory != null &&
      !inventory.soldOut &&
      inventory.listingStatus === "save_for_later";

    if (!shouldGuard) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [fromInventory, inventory]);

  const handleUpdateListingStatus = useCallback(
    async (status: "save_for_later" | "list_now") => {
      if (!inventory || updatingStatus) return;
      setUpdatingStatus(true);
      try {
        const res = await updateListingStatus({
          vendorPhone: getOnboardingPhone(),
          id: inventory.id,
          listingStatus: status,
        });
        if (res.success) {
          const phone = getOnboardingPhone();
          if (phone) {
            await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.inventory(phone) });
          }
          setInventory((prev) => (prev ? { ...prev, listingStatus: status } : null));
          const tab = status === "list_now" ? "listed" : "unlisted";
          router.push(`/dashboard/inventory?tab=${tab}`);
        }
      } finally {
        setUpdatingStatus(false);
      }
    },
    [inventory, updatingStatus, router, queryClient]
  );

  const handleListNow = useCallback(() => {
    void handleUpdateListingStatus("list_now");
  }, [handleUpdateListingStatus]);

  const handleSaveForLater = useCallback(() => {
    void handleUpdateListingStatus("save_for_later");
  }, [handleUpdateListingStatus]);

  const handleMarkAsSold = useCallback(async () => {
    if (!inventory || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await markInventorySold({
        vendorPhone: getOnboardingPhone(),
        id: inventory.id,
        soldOut: true,
      });
      if (res.success) {
        const phone = getOnboardingPhone();
        if (phone) {
          await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.inventory(phone) });
        }
        setInventory((prev) => (prev ? { ...prev, soldOut: true } : null));
        setPopup("Marked as sold");
      }
    } finally {
      setUpdatingStatus(false);
    }
  }, [inventory, updatingStatus, queryClient]);

  const handleSaveForLaterClick = useCallback(() => {
    if (inventory?.listingStatus === "list_now" && !inventory.soldOut) {
      setShowUnlistConfirm(true);
    } else {
      handleSaveForLater();
    }
  }, [inventory, handleSaveForLater]);

  const handleBackClick = useCallback(() => {
    if (inventory && !inventory.soldOut && inventory.listingStatus === "save_for_later") {
      setShowBackConfirm(true);
    } else {
      router.back();
    }
  }, [inventory, router]);

  if (loading && !product) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 text-center text-[16px] text-[#72808C]">
        Loading…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12 text-center">
        <p className="text-[16px] text-[#72808C]">Product not found.</p>
        <Link href="/home" className="mt-4 inline-block text-[15px] font-medium text-[#c7a77b] hover:underline">
          Return to Home
        </Link>
        <VendorFooter variant="minimal" />
      </div>
    );
  }

  const categoryLabel = (category || product.category || "").toUpperCase();
  const brandLabel = (product.brand || "").toUpperCase();

  const imageSrc = (product.image || "").trim();
  const isValidImageUrl = imageSrc.startsWith("http://") || imageSrc.startsWith("https://");

  const listingRows = [
    { label: "Inventory ID", value: inventory?.inventoryId != null ? String(inventory.inventoryId) : "—" },
    { label: "Selected size", value: inventory?.size ?? "—" },
    {
      label: "Listing Status",
      value: inventory
        ? inventory.soldOut
          ? "Sold"
          : inventory.listingStatus === "list_now"
          ? "Listed"
          : "Save for later"
        : "—",
    },
    { label: "Purchase Date", value: inventory?.purchaseDate ? formatListingDate(inventory.purchaseDate) : "—" },
    { label: "Place of Purchase", value: inventory?.placeOfPurchase ?? "—" },
    { label: "Purchase Price", value: inventory?.purchasePriceCents != null ? `₹ ${(inventory.purchasePriceCents / 100).toLocaleString("en-IN")}` : "—" },
    { label: "Product Location", value: inventory?.pairLocation ?? "—" },
    { label: "Box Condition", value: inventory?.boxCondition ?? "—" },
    { label: "Availability", value: inventory?.availability ?? "—" },
  ];

  const fontMontserrat = { fontFamily: "'Montserrat', Arial, sans-serif" };
  const spacingStyle = { ["--spacing"]: "4px" } as React.CSSProperties;

  return (
    <div className="min-h-screen w-full bg-[#ffffff] py-6" style={{ ...fontMontserrat, ...spacingStyle }}>
      {/* Content width: change max-w-[1280px] to e.g. max-w-[1400px] or max-w-[1100px] to stretch or shrink */}
      <div className="mx-auto w-full max-w-[1500px] px-6 sm:px-8 lg:px-16">
        {/* Two columns: left = back CTA + image, right = details + Listing Details in same column */}
        <div className={`grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,0.46fr)_minmax(0,0.54fr)] lg:gap-12 ${!inventory ? "pb-24 md:pb-0" : ""}`}>
          {/* Left: phone = back+name row then image; desktop = back CTA + image — sticky card */}
          <div className="flex flex-col lg:sticky lg:top-[95px] lg:self-start">
            {/* Phone only: back button + product name in same row above image */}
            <div className="mb-3 flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={handleBackClick}
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#c7a77b] bg-white hover:bg-[#f5f0e8]"
                aria-label="Go back"
              >
                <BackIcon className="h-5 w-5 text-[#051F2D]" />
              </button>
              <h1 className="min-w-0 flex-1 text-[18px] font-medium leading-tight text-[#051f2d] line-clamp-2">
                {product.name}
              </h1>
            </div>
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={handleBackClick}
                className="mt-1 hidden h-13 w-14 items-center justify-center border border-[#c7a77b] bg-white hover:bg-[#f5f0e8] lg:flex"
                aria-label="Go back"
              >
                <BackIcon className="h-5 w-5 text-[#051F2D]" />
              </button>
              <div className="relative aspect-square w-full overflow-hidden rounded-none border border-[#e0e6ed] bg-white">
              {imageSrc && isValidImageUrl ? (
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[#f2f3f4] text-[#828f96]">
                  {imageSrc ? "Image unavailable" : "No image"}
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Right: info, actions, then Listing Details in same column (scrolls) */}
          <div className="flex min-w-0 flex-col">
          <p className="hidden text-[13px] font-medium uppercase tracking-wider text-[#72808C] md:block">
            {categoryLabel} • {brandLabel}
          </p>
          <h1 className="mt-1.5 hidden text-[22px] font-semibold leading-tight text-[#051f2d] lg:block sm:text-[26px]">
            {product.name}
          </h1>

          {/* Value cards — Inventory Value (purchase cost), Profit/Loss with up/down arrow */}
          <div className="mt-[calc(var(--spacing)*8)] grid grid-cols-2 gap-3">
            <div className="rounded-none border border-[#e0e6ed] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#72808C]">Inventory Value</p>
              <p className="mt-1 text-[17px] font-semibold text-[#051f2d]">
                {inventory?.purchasePriceCents != null ? `₹ ${(inventory.purchasePriceCents / 100).toLocaleString("en-IN")}` : "—"}
              </p>
            </div>
            <div className="rounded-none border border-[#e0e6ed] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#72808C]">Profit/Loss</p>
              {(() => {
                const cents = inventory?.profitLossCents ?? null;
                if (cents == null) {
                  return <p className="mt-1 text-[17px] font-semibold text-[#dc2626]">—</p>;
                }
                const amount = cents / 100;
                const isPositive = cents > 0;
                const isNegative = cents < 0;
                const isZero = cents === 0;
                const color =
                  isPositive ? "text-[#16a34a]" : isNegative ? "text-[#dc2626]" : "text-[#eab308]";
                return (
                  <p className={`mt-1 flex items-center gap-1 text-[17px] font-semibold ${color}`}>
                    {`₹ ${amount.toLocaleString("en-IN")}`}
                    {isPositive && <UpArrowIcon className="h-4 w-4 shrink-0 text-[#16a34a]" />}
                    {isNegative && <DownArrowIcon className="h-4 w-4 shrink-0 text-[#dc2626]" />}
                  </p>
                );
              })()}
            </div>
          </div>

          {!inventory && (
            <div className="relative mt-[calc(var(--spacing)*8)] hidden overflow-visible md:block">
              <button
                type="button"
                onClick={() => setShowListNowTooltip(true)}
                className="w-full rounded-none bg-[#1C3040] px-4 py-[calc(var(--spacing)*5)] text-[18px] font-semibold uppercase tracking-wide text-white hover:bg-[#2d4555]"
              >
                List Now
              </button>
              {showListNowTooltip && (
                <div className="absolute bottom-full left-1/2 z-20 mb-2 w-[min(280px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border-0 bg-[#F2F4F7] px-4 py-3 text-center text-[14px] font-medium text-[#333C48] shadow-lg">
                  <p className="leading-snug">Enter details below to list your product</p>
                  <span
                    className="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-[#F2F4F7]"
                    style={{ marginTop: "-1px" }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => setShowListNowTooltip(false)}
                    className="absolute right-2 top-2.5 text-[#50626C] hover:text-[#1C3040]"
                    aria-label="Close"
                  >
                    <CloseIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="mt-[calc(var(--spacing)*8)]">
            <label className="block text-[18px] font-semibold text-[#051f2d]">Select the size</label>
            {!inventory ? (
              <div className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setSizeOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-left text-[16px] text-[#051f2d]"
                >
                  <span>{displaySize}</span>
                  <ChevronIcon className={`h-5 w-5 shrink-0 text-[#051f2d] transition-transform ${sizeOpen ? "rotate-180" : ""}`} />
                </button>
                {/* Desktop: dropdown below. Mobile: use bottom sheet instead (rendered below). */}
                {sizeOpen && (
                  <div className="absolute z-10 mt-1 hidden max-h-[260px] w-full overflow-y-auto border border-[#e0e6ed] bg-white shadow-lg md:block">
                    {desktopSizes.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setSize(s); setSizeOpen(false); }}
                        className={`block w-full px-4 py-2.5 text-left text-[16px] ${s === displaySize ? "bg-[#c7a77b] font-medium text-[#051f2d]" : "text-[#828f96] hover:bg-[#f5f0e8]"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-[16px] text-[#c7a77b]">
                {inventory.size}
              </div>
            )}
          </div>

          {!inventory ? (
            <Link
              href={`/dashboard/product/${encodeURIComponent(id)}/enter-details?category=${encodeURIComponent(
                category
              )}&size=${encodeURIComponent(displaySize)}`}
              className="mt-[calc(var(--spacing)*8)] flex w-full items-center justify-center rounded-none border-2 border-[#c7a77b] bg-white px-4 py-3 text-[15px] font-semibold uppercase tracking-wide text-[#051f2d] hover:bg-[#c7a77b]/10"
            >
              Enter Details
            </Link>
          ) : (
            <>
              <p className="mt-4 text-[13px] text-[#16a34a]">Adding inventory to your portfolio</p>
              <div className="mt-3 flex gap-3">
                <Link
                  href={`/dashboard/product/${encodeURIComponent(id)}/enter-details?category=${encodeURIComponent(
                    category
                  )}&size=${encodeURIComponent(inventory.size || displaySize)}&edit=1`}
                  className="flex-1 flex items-center justify-center rounded-none border border-[#c7a77b] bg-white px-4 py-[calc(var(--spacing)*4)] text-[12px] font-semibold text-[#051f2d] hover:bg-[#f5f0e8] md:text-[18px]"
                >
                  Edit Inventory
                </Link>
                <button
                  type="button"
                  onClick={handleMarkAsSold}
                  disabled={updatingStatus || inventory.soldOut}
                  className="flex-1 flex items-center justify-center rounded-none border border-[#c7a77b] bg-white px-4 py-[calc(var(--spacing)*4)] text-[12px] font-semibold text-[#051f2d] hover:bg-[#f5f0e8] disabled:opacity-60 md:text-[18px]"
                >
                  {inventory.soldOut ? "Marked as Sold" : "Mark as Sold"}
                </button>
              </div>
            </>
          )}

          {/* Listing Details — border only below heading, not between rows; info icon with hover tooltip */}
          <section className="mt-[calc(var(--spacing)*8)] rounded-none border border-[#e8eaed] bg-[#f2f3f4] p-5">
            <div className="flex items-center gap-2 border-b border-[#e0e6ed] pb-3">
              <h2 className="text-[18px] font-bold text-[#051f2d] leading-tight">
                Listing details
              </h2>
              <div className="relative group flex items-center">
                <span className="inline-flex cursor-help items-center justify-center" aria-label="Info" style={{ width: 18, height: 18 }}>
                  <InfoIconSmall className="h-4 w-4 shrink-0 text-[#72808C]" />
                </span>
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-[#1C3040] px-2 py-1.5 text-[12px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Details appear after you enter and submit them
                </span>
              </div>
            </div>
            <div className="space-y-0 pt-1">
              {listingRows.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-3 py-2.5 text-[14px] font-medium text-[#50626C]">
                  <span className="shrink-0">{label}</span>
                  <span className="min-w-0 truncate text-right">{value}</span>
                </div>
              ))}
            </div>
          </section>
          </div>
        </div>
      </div>

      {/* Mobile-only size bottom sheet: back button + "Select Size", sizes only (no price), single size = full-width large */}
      {sizeOpen && (
        <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-labelledby="size-sheet-title">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSizeOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-[60vh] max-h-[85vh] overflow-hidden rounded-t-xl border-t border-[#e0e6ed] bg-white shadow-lg animate-slide-up-sheet">
            <div className="flex items-center gap-3 border-b border-[#e0e6ed] px-4 py-3">
              <button
                type="button"
                onClick={() => setSizeOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#c7a77b] bg-white"
                aria-label="Close"
              >
                <BackIcon className="h-5 w-5 text-[#051F2D]" />
              </button>
              <h2 id="size-sheet-title" className="text-[18px] font-semibold text-[#051f2d]">Select Size</h2>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSize(s);
                      setSizeOpen(false);
                    }}
                    className={`rounded-none border px-4 py-4 text-[15px] font-medium ${
                      s === displaySize
                        ? "border-[#c7a77b] bg-[#c7a77b] text-[#051f2d]"
                        : "border-[#DCE1E6] bg-white text-[#051f2d] hover:bg-[#f5f0e8]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky bottom action bar for Save for Later / List Now (desktop + when inventory exists) */}
      {inventory && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e0e6ed] bg-white/95 backdrop-blur">
          <div className="mx-auto grid w-full max-w-[1200px] grid-cols-2 items-stretch gap-0 px-0 py-0 md:flex md:items-center md:justify-center md:gap-6 md:px-6 md:py-4">
            <button
              type="button"
              onClick={handleSaveForLaterClick}
              disabled={updatingStatus || inventory.soldOut}
              className="h-full w-full rounded-none border border-[#c7a77b] bg-white px-3 py-4 text-[12px] font-semibold uppercase tracking-wide text-[#051f2d] hover:bg-[#f5f0e8] disabled:cursor-not-allowed disabled:opacity-40 md:flex-1 md:px-6 md:py-[calc(var(--spacing)*4)] md:text-[18px]"
            >
              Save for Later
            </button>
            <button
              type="button"
              onClick={handleListNow}
              disabled={updatingStatus || inventory.listingStatus === "list_now"}
              className="h-full w-full rounded-none border border-[#051f2d] bg-[#1C3040] px-3 py-4 text-[12px] font-semibold uppercase tracking-wide text-white hover:bg-[#2d4555] disabled:opacity-60 md:flex-1 md:px-6 md:py-[calc(var(--spacing)*4)] md:text-[18px]"
            >
              {inventory.soldOut
                ? "List again"
                : inventory.listingStatus === "list_now"
                ? "Listed"
                : "List Now"}
            </button>
          </div>
        </div>
      )}

      {/* Phone only: fixed bottom List Now when no inventory yet (replaces bottom navbar area) */}
      {!inventory && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e0e6ed] bg-white/95 backdrop-blur md:hidden">
          <div className="relative px-0 py-0">
            <button
              type="button"
              onClick={() => setShowListNowTooltip(true)}
              className="w-full rounded-none bg-[#1C3040] px-4 py-4 text-[18px] font-semibold uppercase tracking-wide text-white hover:bg-[#2d4555]"
            >
              List Now
            </button>
            {showListNowTooltip && (
              <div className="absolute bottom-full left-1/2 z-20 mb-2 w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 rounded-none border-0 bg-[#F2F3F4] px-4 py-3 text-center text-[14px] font-medium text-[#333C48] shadow-lg">
                <p className="leading-snug">Enter details to list your product</p>
                <span
                  className="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-[#F2F4F7]"
                  style={{ marginTop: "-1px" }}
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() => setShowListNowTooltip(false)}
                  className="absolute right-2 top-2.5 text-[#50626C] hover:text-[#1C3040]"
                  aria-label="Close"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popup toast */}
      {popup && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[#16a34a] bg-[#f0fdf4] px-6 py-3 text-[15px] font-medium text-[#166534] shadow-lg"
          role="alert"
        >
          {popup}
          <button
            type="button"
            onClick={() => setPopup(null)}
            className="ml-4 font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Back confirmation modal for unlisted inventory */}
      {showBackConfirm && inventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[480px] rounded-none border border-[#e0e6ed] bg-white px-6 py-6 shadow-2xl sm:px-8 sm:py-7">
            <h2 className="text-[20px] font-semibold text-[#1C3040]">
              What would you like to do with this listing?
            </h2>
            <p className="mt-2 text-[14px] text-[#50626C]">
              Choose whether to keep this product as <span className="font-semibold">Save for Later</span> or
              <span className="font-semibold"> List Now</span> before you leave.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowBackConfirm(false);
                  handleSaveForLater();
                }}
                disabled={updatingStatus}
                className="w-full rounded-none border border-[#c7a77b] bg-white px-4 py-3 text-[15px] font-semibold text-[#051f2d] hover:bg-[#f5f0e8] disabled:opacity-60"
              >
                Save for Later
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBackConfirm(false);
                  handleListNow();
                }}
                disabled={updatingStatus}
                className="w-full rounded-none bg-[#1C3040] px-4 py-3 text-[15px] font-semibold text-white hover:bg-[#2d4555] disabled:opacity-60"
              >
                List Now
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowBackConfirm(false)}
              className="mt-4 text-[13px] font-medium text-[#72808C] hover:text-[#1C3040]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Product detail pages should always use the normal full footer (mobile + web). */}
      <VendorFooter variant="full" />

      {/* Unlist confirmation modal for listed inventory */}
      {showUnlistConfirm && inventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[480px] rounded-none border border-[#e0e6ed] bg-white px-6 py-6 shadow-2xl sm:px-8 sm:py-7">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fef3c7]">
                <WarningIcon className="h-5 w-5 text-[#92400e]" />
              </span>
              <h2 className="text-[20px] font-semibold text-[#1C3040]">
                Remove from listing?
              </h2>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-[#50626C]">
              If you save this for later, it will be <span className="font-semibold text-[#1C3040]">removed from your active listings</span> and
              will no longer be visible to buyers. You can always relist it later from your inventory.
            </p>
            <p className="mt-2 text-[13px] text-[#72808C]">
              Would you like to go ahead?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowUnlistConfirm(false);
                  handleSaveForLater();
                }}
                disabled={updatingStatus}
                className="w-full rounded-none border border-[#b91c1c] bg-white px-4 py-3 text-[15px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-60"
              >
                {updatingStatus ? "Removing…" : "Yes, Remove from Listing"}
              </button>
              <button
                type="button"
                onClick={() => setShowUnlistConfirm(false)}
                className="w-full rounded-none bg-[#1C3040] px-4 py-3 text-[15px] font-semibold text-white hover:bg-[#2d4555]"
              >
                No, Keep Listed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatListingDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return iso;
  }
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256" className={className}>
      <path d="M227.32,28.68a16,16,0,0,0-15.66-4.08l-.15,0L19.57,82.84a16,16,0,0,0-2.49,29.8L102,154l41.3,84.87A15.86,15.86,0,0,0,157.74,248q.69,0,1.38-.06a15.88,15.88,0,0,0,14-11.51l58.2-191.94c0-.05,0-.1,0-.15A16,16,0,0,0,227.32,28.68ZM157.83,231.85l-.05.14,0-.07-40.06-82.3,48-48a8,8,0,0,0-11.31-11.31l-48,48L24.08,98.25l-.07,0,.14,0L216,40Z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80a8,8,0,0,1,11.32-11.32L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

function DownArrowIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M205.66,117.66a8,8,0,0,0-11.32,0L136,176V40a8,8,0,0,0-16,0V176L61.66,117.66a8,8,0,0,0-11.32,11.32l80,80a8,8,0,0,0,11.32,0l80-80A8,8,0,0,0,205.66,117.66Z" />
    </svg>
  );
}

function UpArrowIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
    </svg>
  );
}

function InfoIconSmall({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256" className={className}>
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" />
    </svg>
  );
}

export default function ProductDetailPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F8F8] p-6 text-[#1C3040]">Loading product…</div>}>
      <ProductDetailPage />
    </Suspense>
  );
}