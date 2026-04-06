"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { getProfile, createInventory, getInventory, type VendorInventory } from "@/lib/api";
import { dashboardQueryKeys } from "@/lib/dashboard-queries";
import { getOnboardingPhone } from "@/lib/onboarding-session";
import { INDIAN_CITIES } from "@/lib/indian-cities";

const INFO_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#000000" viewBox="0 0 256 256" className="shrink-0 inline-block align-middle">
    <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z" />
  </svg>
);

const PLATFORM_FEE_PERCENT = 10;
const TDS_PERCENT = 1;
const GST_PERCENT = 2;

const BOX_CONDITIONS = ["New / Original Box", "Damaged box", "Not available"];

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-IN");
}

function EnterDetailsPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const category = searchParams.get("category") || "";

  const [gstRegistered, setGstRegistered] = useState<boolean | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [pairLocation, setPairLocation] = useState("");
  const [availability, setAvailability] = useState<"ETA" | "In hand" | "">("");
  const [desiredPayout, setDesiredPayout] = useState("");
  const [productQty, setProductQty] = useState("");
  const [boxCondition, setBoxCondition] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [placeOfPurchase, setPlaceOfPurchase] = useState("");
  const [saving, setSaving] = useState(false);
  const [size, setSize] = useState("");
  const [existingInventory, setExistingInventory] = useState<VendorInventory | null>(null);
  const [purchaseCurrencyOpen, setPurchaseCurrencyOpen] = useState(false);
  const [payoutCurrencyOpen, setPayoutCurrencyOpen] = useState(false);
  const [pairLocationOpen, setPairLocationOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [boxConditionOpen, setBoxConditionOpen] = useState(false);
  const [purchaseCalendarOpen, setPurchaseCalendarOpen] = useState(false);
  const [purchaseCalendarMonth, setPurchaseCalendarMonth] = useState<Date>(() => new Date());
  const [error, setError] = useState("");

  const listedPrice = useMemo(() => {
    const payout = parseNum(desiredPayout);
    if (payout <= 0) return 0;
    return Math.round(payout * (1 + PLATFORM_FEE_PERCENT / 100));
  }, [desiredPayout]);

  const finalPayout = useMemo(() => {
    const payout = parseNum(desiredPayout);
    if (payout <= 0) return 0;
    const tds = payout * (TDS_PERCENT / 100);
    const gst = gstRegistered === true ? payout * (GST_PERCENT / 100) : 0;
    return Math.round(payout - tds - gst);
  }, [desiredPayout, gstRegistered]);

  const orderedCities = useMemo(() => {
    if (!pairLocation || !INDIAN_CITIES.includes(pairLocation)) return INDIAN_CITIES;
    const rest = INDIAN_CITIES.filter((city) => city !== pairLocation);
    return [pairLocation, ...rest];
  }, [pairLocation]);

  useEffect(() => {
    let cancelled = false;
    const phone = getOnboardingPhone();
    if (!phone) {
      setGstRegistered(false);
      return;
    }
    getProfile(phone).then((res) => {
      if (cancelled) return;
      setGstRegistered(res.success && res.profile ? res.profile.gstRegistered : false);
    });
    const isEdit = searchParams.get("edit") === "1";
    // Pre-fill form only when explicitly editing existing inventory
    if (id && category && isEdit) {
      getInventory(phone, id, category.toLowerCase()).then((res) => {
        if (cancelled || !res.success || !res.inventory) return;
        const inv = res.inventory;
        setExistingInventory(inv);
        if (inv.size) setSize(inv.size);
        if (inv.purchasePriceCents != null) {
          setPurchasePrice((inv.purchasePriceCents / 100).toLocaleString("en-IN"));
        }
        if (inv.desiredPayoutCents != null) {
          setDesiredPayout((inv.desiredPayoutCents / 100).toLocaleString("en-IN"));
        }
        if (inv.pairLocation) setPairLocation(inv.pairLocation);
        if (inv.availability === "ETA" || inv.availability === "In hand") {
          setAvailability(inv.availability);
        }
        if (inv.boxCondition) setBoxCondition(inv.boxCondition);
        if (inv.productQty) setProductQty(inv.productQty);
        if (inv.purchaseDate) {
          const iso = inv.purchaseDate;
          const dateOnly = iso.length >= 10 ? iso.slice(0, 10) : iso;
          setPurchaseDate(dateOnly);
        }
        if (inv.placeOfPurchase) setPlaceOfPurchase(inv.placeOfPurchase);
      });
    }
    return () => { cancelled = true; };
  }, [id, category, searchParams]);

  const sizeParam = searchParams.get("size");
  useEffect(() => {
    if (sizeParam) setSize(sizeParam);
  }, [sizeParam]);

  const handleSave = useCallback(async () => {
    // Require all fields to be filled with valid values before saving
    const purchaseNum = parseNum(purchasePrice);
    const desiredNum = parseNum(desiredPayout);
    if (
      !size.trim() ||
      !pairLocation.trim() ||
      !availability.trim() ||
      !boxCondition.trim() ||
      !purchaseDate.trim() ||
      !placeOfPurchase.trim() ||
      !productQty.trim() ||
      purchaseNum <= 0 ||
      desiredNum <= 0
    ) {
      setError("Please fill in all details (including valid purchase price and desired payout) before saving.");
      return;
    }

    setError("");

    const phone = getOnboardingPhone();
    const purchaseCents = Math.round(purchaseNum * 100);
    const desiredCents = Math.round(desiredNum * 100);
    const listedCents = Math.round(listedPrice * 100);
    const finalCents = Math.round(finalPayout * 100);
    const profitLossCents = finalCents - purchaseCents;
    setSaving(true);
    try {
      const res = await createInventory({
        vendorPhone: phone,
        productId: id,
        category,
        size: size || "OneSize",
        purchasePriceCents: purchaseNum > 0 ? purchaseCents : null,
        desiredPayoutCents: desiredNum > 0 ? desiredCents : null,
        listedPriceCents: listedPrice > 0 ? listedCents : null,
        finalPayoutCents: finalPayout > 0 ? finalCents : null,
        profitLossCents: purchaseNum > 0 && finalPayout > 0 ? profitLossCents : null,
        pairLocation: pairLocation,
        availability: availability,
        boxCondition: boxCondition,
        productQty: productQty,
        purchaseDate: purchaseDate,
        placeOfPurchase: placeOfPurchase,
      });
      if (res.success) {
        const phone = getOnboardingPhone();
        if (phone) {
          await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.inventory(phone) });
        }
        router.replace(
          `/dashboard/product/${encodeURIComponent(id)}?category=${encodeURIComponent(
            category
          )}&saved=1&inventory=1`
        );
      }
    } finally {
      setSaving(false);
    }
  }, [queryClient, router, id, category, purchasePrice, desiredPayout, listedPrice, finalPayout, pairLocation, availability, boxCondition, productQty, purchaseDate, placeOfPurchase, size]);

  return (
    <>
      <div className="mx-auto max-w-[900px] px-4 pt-10 pb-24 sm:px-8 sm:pb-10 lg:px-10" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
      {/* Mobile: back + "Enter Details" in same row (like search). Desktop: centered title + X. */}
      <div className="mb-10 flex w-full items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#c7a77b] bg-white sm:hidden"
          aria-label="Go back"
        >
          <BackIcon className="h-5 w-5 text-[#051F2D]" />
        </button>
        <div className="flex min-w-0 flex-1 pr-8 justify-center">
          {/* Mobile: tighter lines + single-row title */}
          <div className="flex items-center gap-3 sm:hidden">
            <span className="h-px w-14 bg-[#e0e6ed]" />
            <h1 className="whitespace-nowrap text-[20px] font-semibold text-[#1C3040]">
              Enter Details
            </h1>
            <span className="h-px w-14 bg-[#e0e6ed]" />
          </div>
          {/* Web (tablet/desktop): original centered title with longer lines */}
          <div className="hidden items-center gap-4 sm:flex">
            <span className="h-px w-24 bg-[#e0e6ed]" />
            <h1 className="text-[22px] font-semibold text-[#1C3040] sm:text-[24px]">
              Enter Details
            </h1>
            <span className="h-px w-24 bg-[#e0e6ed]" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="hidden shrink-0 rounded p-2 hover:bg-[#f2f3f4] sm:ml-4 sm:flex"
          aria-label="Close"
        >
          <CloseIcon className="h-6 w-6 text-[#72808C]" />
        </button>
      </div>

      <div className="space-y-8">
        {error && (
          <p className="rounded-none border border-[#b91c1c] bg-[#fef2f2] px-4 py-3 text-[14px] font-medium text-[#b91c1c]">
            {error}
          </p>
        )}
        {/* Purchase Price */}
        <div>
          <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">
            <span className="sm:hidden">Purchase Price</span>
            <span className="hidden sm:inline">Enter your Purchase Price</span>
          </label>
          <div className="mt-1 flex gap-3">
            <div className="relative w-[85px]">
              <button
                type="button"
                onClick={() => setPurchaseCurrencyOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-3 py-3 text-left text-[15px] text-[#051f2d]"
              >
                <span>INR</span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-[#051f2d] transition-transform ${purchaseCurrencyOpen ? "rotate-180" : ""}`}
                />
              </button>
              {purchaseCurrencyOpen && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden border border-[#e0e6ed] bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => setPurchaseCurrencyOpen(false)}
                    className="block w-full px-4 py-2.5 text-left text-[15px] bg-[#c7a77b] font-medium text-[#051f2d]"
                  >
                    INR
                  </button>
                </div>
              )}
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="flex-1 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-[16px] text-[#1C3040] sm:text-[15px]"
            />
          </div>
          <div className="mt-2 flex items-start gap-2 text-[13px] text-[#2563eb]">
            {INFO_ICON}
            <span>This price will only be used for your profit/loss calculation and will not be shared ahead with customers.</span>
          </div>
        </div>

        {/* Pair Location & Availability */}
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
          <div>
            <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Pair Location</label>
            <div className="relative mt-1">
              <button
                type="button"
                onClick={() => setPairLocationOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-left text-[15px] text-[#051f2d]"
              >
                <span>{pairLocation || "Select"}</span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-[#051f2d] transition-transform ${pairLocationOpen ? "rotate-180" : ""}`}
                />
              </button>
              {pairLocationOpen && (
                <div className="absolute z-20 mt-1 max-h-[260px] w-full overflow-y-auto border border-[#e0e6ed] bg-white shadow-lg">
                  {orderedCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => {
                        setPairLocation(city);
                        setPairLocationOpen(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-[15px] ${
                        city === pairLocation
                          ? "bg-[#c7a77b] font-medium text-[#051f2d]"
                          : "text-[#828f96] hover:bg-[#f5f0e8]"
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Enter Pair Availability</label>
            <div className="relative mt-1">
              <button
                type="button"
                onClick={() => setAvailabilityOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-left text-[15px] text-[#051f2d]"
              >
                <span>{availability || "Select"}</span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-[#051f2d] transition-transform ${availabilityOpen ? "rotate-180" : ""}`}
                />
              </button>
              {availabilityOpen && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden border border-[#e0e6ed] bg-white shadow-lg">
                  {["ETA", "In hand"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setAvailability(option as "ETA" | "In hand");
                        setAvailabilityOpen(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-[15px] ${
                        option === availability
                          ? "bg-[#c7a77b] font-medium text-[#051f2d]"
                          : "text-[#828f96] hover:bg-[#f5f0e8]"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desired Payout */}
        <div>
          <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Enter Desired Payout</label>
          <div className="mt-1 flex gap-3">
            <div className="relative w-[85px]">
              <button
                type="button"
                onClick={() => setPayoutCurrencyOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-3 py-3 text-left text-[15px] text-[#051f2d]"
              >
                <span>INR</span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-[#051f2d] transition-transform ${payoutCurrencyOpen ? "rotate-180" : ""}`}
                />
              </button>
              {payoutCurrencyOpen && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden border border-[#e0e6ed] bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => setPayoutCurrencyOpen(false)}
                    className="block w-full px-4 py-2.5 text-left text-[15px] bg-[#c7a77b] font-medium text-[#051f2d]"
                  >
                    INR
                  </button>
                </div>
              )}
            </div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={desiredPayout}
              onChange={(e) => setDesiredPayout(e.target.value)}
              className="flex-1 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-[16px] text-[#1C3040] sm:text-[15px]"
            />
          </div>
          <div className="mt-2 flex items-start gap-2 text-[13px] text-[#2563eb]">
            {INFO_ICON}
            <span>
              {gstRegistered === true
                ? "1% TDS + 2% GST. All deductions will appear in your payout statement and confirmation email."
                : "1% TDS. All deductions will appear in your payout statement and confirmation email."}
            </span>
          </div>
        </div>

        {/* Listed Price (read-only) */}
        <div>
          <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Listed Price</label>
          <div className="mt-1 flex items-center justify-between rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-[15px] text-[#1C3040]">
            <span>House of Plutus</span>
            <span className="font-medium">{formatNum(listedPrice)}</span>
          </div>
        </div>

        {/* Your Final Payout Amount (read-only) */}
        <div>
          <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Your Final Payout Amount</label>
          <div className="mt-1 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-[15px] text-[#1C3040]">
            <span className="font-medium">{formatNum(finalPayout)}</span>
          </div>
        </div>

        {/* Product Qty & Box Condition */}
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
          <div>
            <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Product Qty</label>
            <input
              type="text"
              placeholder="If any"
              value={productQty}
              onChange={(e) => setProductQty(e.target.value)}
              className="mt-1 w-full rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-[16px] text-[#1C3040] sm:text-[15px]"
            />
          </div>
          <div>
            <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Box Condition</label>
            <div className="relative mt-1">
              <button
                type="button"
                onClick={() => setBoxConditionOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-left text-[15px] text-[#051f2d]"
              >
                <span>{boxCondition || "Select"}</span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-[#051f2d] transition-transform ${boxConditionOpen ? "rotate-180" : ""}`}
                />
              </button>
              {boxConditionOpen && (
                <div className="absolute z-20 mt-1 w-full overflow-hidden border border-[#e0e6ed] bg-white shadow-lg">
                  {BOX_CONDITIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setBoxCondition(option);
                        setBoxConditionOpen(false);
                      }}
                      className={`block w-full px-4 py-2.5 text-left text-[15px] ${
                        option === boxCondition
                          ? "bg-[#c7a77b] font-medium text-[#051f2d]"
                          : "text-[#828f96] hover:bg-[#f5f0e8]"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Purchase Date & Place of Purchase */}
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
          <div>
            <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Purchase Date</label>
            <button
              type="button"
              onClick={() => setPurchaseCalendarOpen(true)}
              className="mt-1 flex w-full items-center justify-between rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-left text-[15px] text-[#1C3040] sm:hidden"
            >
              <span>{purchaseDate ? formatPickupDisplay(purchaseDate) : "Select purchase date"}</span>
              <CalendarIcon className="h-4 w-4 text-[#8B97A1]" />
            </button>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="mt-1 hidden w-full rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-[16px] text-[#1C3040] sm:block sm:text-[15px]"
            />
          </div>
          <div>
            <label className="block text-[16px] font-medium text-[#1C3040] sm:text-[14px]">Place of Purchase</label>
            <input
              type="text"
              placeholder="e.g. Retail"
              value={placeOfPurchase}
              onChange={(e) => setPlaceOfPurchase(e.target.value)}
              className="mt-1 w-full rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-[16px] text-[#1C3040] sm:text-[15px]"
            />
          </div>
        </div>
      </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-10 hidden w-full rounded-none bg-[#1C3040] px-4 py-4 text-[16px] font-semibold uppercase tracking-wide text-white hover:bg-[#2d4555] disabled:opacity-60 sm:block"
        >
          {saving ? "Saving…" : "Save Details"}
        </button>
      </div>

      {/* Mobile fixed bottom Save Details, same style as List Now CTA; form content remains scrollable */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e0e6ed] bg-white/95 backdrop-blur sm:hidden">
        <div className="px-0 py-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-none bg-[#1C3040] px-4 py-4 text-[16px] font-semibold uppercase tracking-wide text-white hover:bg-[#2d4555] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Details"}
          </button>
        </div>
      </div>

      {/* Mobile-only purchase date bottom sheet */}
      {purchaseCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:hidden">
          <div className="relative w-full rounded-none bg-white pb-3 pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.25)]">
            <button
              type="button"
              onClick={() => setPurchaseCalendarOpen(false)}
              className="absolute -top-6 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-md"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#4B5563" viewBox="0 0 256 256">
                <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
              </svg>
            </button>

            <div className="px-5">
              <p className="text-[13px] text-[#72808C]">When</p>
              <p className="mt-1 text-[16px] font-semibold text-[#1C3040]">
                {purchaseDate ? formatPickupDisplay(purchaseDate) : "Select purchase date"}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-b border-[#E5E7EB] px-5 pb-3">
              <button
                type="button"
                onClick={() =>
                  setPurchaseCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F3F4F6]"
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="h-4 w-4 text-[#4B5563]" />
              </button>
              <p className="text-[15px] font-semibold text-[#1C3040]">
                {purchaseCalendarMonth.toLocaleString("default", { month: "long", year: "numeric" })}
              </p>
              <button
                type="button"
                onClick={() =>
                  setPurchaseCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F3F4F6]"
                aria-label="Next month"
              >
                <ChevronRightIcon className="h-4 w-4 text-[#4B5563]" />
              </button>
            </div>

            <div className="mt-3 px-5">
              <div className="grid grid-cols-7 gap-y-2 text-center text-[11px] uppercase tracking-wide text-[#9CA3AF]">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-y-2 text-center text-[14px]">
                {buildCalendarDays(purchaseCalendarMonth).map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} />;
                  }
                  const iso = formatDateInputValue(day);
                  const isSelected = purchaseDate === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => {
                        setPurchaseDate(iso);
                        setPurchaseCalendarOpen(false);
                      }}
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-none ${
                        isSelected ? "bg-[#c7a77b] text-white" : "text-[#111827] hover:bg-[#F3F4F6]"
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
                onClick={() => setPurchaseCalendarOpen(false)}
                className="mt-1 h-[48px] w-full rounded-none bg-[#1C3040] text-[15px] font-semibold text-white"
              >
                Set purchase date
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256" className={className}>
      <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M205.66,194.34a8,8,0,0,0-11.32,11.32L128.68,128l65.66-65.66a8,8,0,0,0-11.32-11.32L117.36,116.68,51.7,51A8,8,0,0,0,40.34,62.34L106,128,40.34,193.66a8,8,0,0,0,11.32,11.32L117.36,139.31l65.66,65.65a8,8,0,0,0,11.32-11.32L128.68,128Z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M200,40H184V32a8,8,0,0,0-16,0v8H88V32a8,8,0,0,0-16,0v8H56A24,24,0,0,0,32,64V200a24,24,0,0,0,24,24H200a24,24,0,0,0,24-24V64A24,24,0,0,0,200,40Zm8,160a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V104H208Z" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M160,48a8,8,0,0,1,5.66,13.66L118.63,108,160,149.37A8,8,0,0,1,148.69,160l-48-48a8,8,0,0,1,0-11.31l48-48A8,8,0,0,1,160,48Z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M104,208a8,8,0,0,1-5.66-13.66L145.37,148,104,106.63A8,8,0,0,1,115.31,96l48,48a8,8,0,0,1,0,11.31l-48,48A8,8,0,0,1,104,208Z" />
    </svg>
  );
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

export default function EnterDetailsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F8F8] p-6 text-[#1C3040]">Loading…</div>}>
      <EnterDetailsPage />
    </Suspense>
  );
}
