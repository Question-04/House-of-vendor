"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { deleteInventory } from "@/lib/api";
import { ProductCardImage } from "@/components/product-card-image";
import { getOnboardingPhone } from "@/lib/onboarding-session";
import { useInventoryQuery, dashboardQueryKeys, type InventoryRow } from "@/lib/dashboard-queries";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import VendorFooter from "@/components/vendor-footer";

type TabId = "all" | "listed" | "unlisted" | "sold" | "in_stock";

function InventoryPage() {
  const searchParams = useSearchParams();
  const tabParam = (searchParams.get("tab") || "").toLowerCase();
  const initialTab: TabId =
    tabParam === "listed" || tabParam === "unlisted" || tabParam === "sold" || tabParam === "in_stock"
      ? (tabParam as TabId)
      : "all";

  const phone = typeof window !== "undefined" ? getOnboardingPhone() : "";
  const queryClient = useQueryClient();
  const { data: items = [], isPending: loading, error: queryError } = useInventoryQuery(phone);
  const error = queryError ? "Could not load inventory." : null;

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const buckets = useMemo(() => {
    const all = items;
    const listed = all.filter((i) => !i.soldOut && i.listingStatus === "list_now");
    const unlisted = all.filter((i) => !i.soldOut && i.listingStatus === "save_for_later");
    const sold = all.filter((i) => i.soldOut);
    const inStock = all.filter((i) => !i.soldOut);
    return { all, listed, unlisted, sold, inStock };
  }, [items]);

  const counts = {
    all: buckets.all.length,
    listed: buckets.listed.length,
    unlisted: buckets.unlisted.length,
    sold: buckets.sold.length,
  };

  const visible: InventoryRow[] = useMemo(() => {
    switch (activeTab) {
      case "listed":
        return buckets.listed;
      case "unlisted":
        return buckets.unlisted;
      case "sold":
        return buckets.sold;
      case "in_stock":
        return buckets.inStock;
      default:
        return buckets.all;
    }
  }, [activeTab, buckets]);

  const hasAny = items.length > 0;

  const handleRequestDelete = (item: InventoryRow) => {
    setDeleteError(null);
    setDeleteTarget(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (!phone) {
        setDeleteError("You need to be signed in to delete inventory.");
        return;
      }
      const res = await deleteInventory({ vendorPhone: phone, id: deleteTarget.id });
      if (res.success) {
        setDeleteTarget(null);
        await queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.inventory(phone) });
      } else {
        setDeleteError(res.message || "Could not delete this inventory item.");
      }
    } catch {
      setDeleteError("Could not delete this inventory item.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  return (
    <div className="relative mx-auto w-full max-w-[1650px] px-4 pb-24 pt-6 sm:pb-16 sm:pt-10 sm:px-8 lg:px-0">
      {/* Heading — match home page typography: 25px on mobile, 40px on desktop */}
      <header className="mb-6 sm:mb-8">
        <h1
          className="text-[25px] text-[#1C3040] sm:text-[40px]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
        >
          Inventory
        </h1>
        <p
          className="mt-1 text-[14px] text-[#72808C] sm:text-[16px]"
          style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
        >
          Manage your product listings and inventory
        </p>
      </header>

      {/* Tabs — styled like home brand tabs, but act as filters */}
      <div className="mb-6 -mx-4 flex gap-2 overflow-x-auto pb-1 pl-[5px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:pl-0 sm:flex-wrap sm:gap-[calc(var(--spacing)*5)]">
        <InventoryTab
          label={`ALL (${counts.all})`}
          isActive={activeTab === "all"}
          onClick={() => setActiveTab("all")}
        />
        <InventoryTab
          label={`Listed (${counts.listed})`}
          isActive={activeTab === "listed"}
          onClick={() => setActiveTab("listed")}
        />
        <InventoryTab
          label={`Unlisted (${counts.unlisted})`}
          isActive={activeTab === "unlisted"}
          onClick={() => setActiveTab("unlisted")}
        />
        <InventoryTab
          label={`Sold (${counts.sold})`}
          isActive={activeTab === "sold"}
          onClick={() => setActiveTab("sold")}
        />
        <InventoryTab
          label="In stock (Listed + Unlisted)"
          isActive={activeTab === "in_stock"}
          onClick={() => setActiveTab("in_stock")}
        />
      </div>

      {loading && (
        <div className="py-12 text-center text-[15px] text-[#72808C]">Loading inventory…</div>
      )}

      {!loading && error && (
        <div className="py-12 text-center text-[15px] text-red-600">{error}</div>
      )}

      {!loading && !error && !hasAny && (
        <div className="flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
          <h2
            className="font-semibold text-[#c7a77b]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "32px" }}
          >
            No products yet
          </h2>
          <p
            className="mt-4 max-w-[700px] text-[#828F96]"
            style={{
              fontFamily: "'Montserrat', Arial, sans-serif",
              fontSize: "24px",
              fontWeight: 500,
            }}
          >
            Start building your inventory by adding your products.
          </p>
        </div>
      )}

      {!loading && !error && hasAny && visible.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center py-12 text-center">
          <h2
            className="font-semibold text-[#c7a77b]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "28px" }}
          >
            No products in this view
          </h2>
          <p
            className="mt-3 text-[#828F96]"
            style={{
              fontFamily: "'Montserrat', Arial, sans-serif",
              fontSize: "20px",
              fontWeight: 500,
            }}
          >
            Try switching tabs to see other inventory.
          </p>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map((item) => (
            <InventoryCard key={item.id} item={item} onDeleteClick={() => handleRequestDelete(item)} />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-[420px] rounded-none border border-[#e0e6ed] bg-white px-6 py-6 shadow-2xl">
            <h2
              className="text-[20px] font-semibold text-[#1C3040]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              Delete this inventory?
            </h2>
            <p
              className="mt-3 text-[14px] text-[#50626C]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              This will permanently remove this size from your inventory. There&apos;s no undo button hiding
              anywhere.
            </p>
            <p
              className="mt-1 text-[14px] text-[#72808C]"
              style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
            >
              If you&apos;re even 1% unsure, it&apos;s totally fine to keep it for now.
            </p>
            {deleteError && (
              <p
                className="mt-3 text-[13px] text-red-600"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 min-w-[120px] rounded-none bg-[#b91c1c] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#991b1b] disabled:opacity-60"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {deleting ? "Deleting…" : "Yes, delete it"}
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deleting}
                className="flex-1 min-w-[120px] rounded-none border border-[#c7a77b] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#051f2d] hover:bg-[#f5f0e8] disabled:opacity-60"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Hmm, let&apos;s keep it
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile bottom nav — phone view only, matches home page */}
      <VendorFooter variant="minimal" />
      <MobileBottomNav />
    </div>
  );
}

function InventoryTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
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

function InventoryCard({ item, onDeleteClick }: { item: InventoryRow; onDeleteClick: () => void }) {
  const status = getStatus(item);
  const addedOn = item.createdAt ? formatDate(item.createdAt) : "—";
  const editedAgo = item.updatedAt ? relativeTimeFromNow(item.updatedAt) : null;
  const href = `/dashboard/product/${encodeURIComponent(item.productId)}?category=${encodeURIComponent(
    item.category
  )}&inventory=1`;

  return (
    <Link href={href} className="block">
      <article className="rounded-none border border-[#e0e6ed] bg-[#f9f8f8] px-4 py-2 sm:flex sm:px-5 sm:py-4">
        {/* Image + details row */}
        <div className="flex w-full">
          {/* Left: product image — fixed size on phone, larger on web */}
          <div className="h-[120px] w-[120px] shrink-0 overflow-hidden bg-transparent sm:h-[200px] sm:w-[240px]">
            <div className="relative h-full w-full">
              <ProductCardImage
                src={item.product?.image}
                alt={item.product?.name ?? "Product image"}
                sizes="200px"
                imageClassName="absolute inset-0 h-full w-full object-contain p-1"
              />
            </div>
          </div>

          {/* Right: text details (shared), web price row lives below */}
          <div className="min-w-0 flex-1 pl-3 sm:pl-[calc(var(--spacing)*15)]">
            {/* Top row: text + status/delete */}
            <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
              <div className="min-w-0">
                <h2
                  className="truncate text-[14px] font-semibold text-[#1C3040] sm:text-[18px] sm:whitespace-normal sm:overflow-visible sm:text-clip sm:leading-snug"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {item.product?.name || `Inventory #${item.inventoryId}`}
                </h2>
                <p
                  className="mt-0.5 text-[12px] text-[#50626C] sm:text-[13px]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {item.category
                    ? `${item.category.charAt(0).toUpperCase()}${item.category.slice(1)} · Inventory #${item.inventoryId}`
                    : `Inventory #${item.inventoryId}`}
                </p>
                <p
                  className="mt-1 text-[12px] text-[#50626C] sm:text-[14px]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {item.size} • Qty: {item.productQty || "1"}
                </p>
                <p
                  className="mt-1 text-[11px] text-[#72808C] sm:text-[13px]"
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  Date Added: {addedOn}
                </p>
                {editedAgo && (
                  <p
                    className="mt-1 text-[11px] text-[#72808C] sm:text-[13px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Edited: {editedAgo} ago
                  </p>
                )}
              </div>

              {/* Status tag + delete button (status left on phone, far right on web) */}
              <div className="mt-0.5 flex w-full items-center gap-2 sm:gap-3 sm:w-auto sm:ml-auto">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold sm:px-3 sm:py-1 sm:text-[13px] ${status.tagClass}`}
                  style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                >
                  {status.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteClick();
                  }}
                  className="ml-auto inline-flex h-8 w-8 items-center justify-center border border-[#e0e6ed] bg-white text-[#9ca3af] hover:border-[#b91c1c] hover:text-[#b91c1c] sm:ml-0"
                  aria-label="Delete inventory"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Bottom row: price section — under details area on web only */}
            <div className="mt-2 border-t border-[#e0e6ed] pt-3 sm:mt-4 hidden sm:block">
              <div className="mx-auto flex max-w-[260px] items-center justify-between gap-2 sm:mx-0 sm:max-w-none sm:w-full sm:justify-start sm:gap-8">
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wide text-[#72808C] sm:text-[12px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Purchased
                  </p>
                  <p
                    className="mt-1 text-[14px] font-semibold text-[#1C3040] sm:text-[16px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {item.purchasePriceCents != null
                      ? `₹ ${(item.purchasePriceCents / 100).toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                </div>
                <div className="border-l border-[#e0e6ed] pl-11 sm:pl-6">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wide text-[#72808C] sm:text-[12px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    Final payout
                  </p>
                  <p
                    className="mt-1 text-[14px] font-semibold text-[#1C3040] sm:text-[16px]"
                    style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
                  >
                    {item.finalPayoutCents != null
                      ? `₹ ${(item.finalPayoutCents / 100).toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-only price row spanning full card width */}
        <div className="mt-2 border-t border-[#e0e6ed] pt-3 basis-full sm:hidden">
          <div className="mx-auto flex max-w-[260px] items-center justify-between gap-2">
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-wide text-[#72808C]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Purchased
              </p>
              <p
                className="mt-1 text-[14px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {item.purchasePriceCents != null
                  ? `₹ ${(item.purchasePriceCents / 100).toLocaleString("en-IN")}`
                  : "—"}
              </p>
            </div>
            <div className="border-l border-[#e0e6ed] pl-11">
              <p
                className="text-[11px] font-semibold uppercase tracking-wide text-[#72808C]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                Final payout
              </p>
              <p
                className="mt-1 text-[14px] font-semibold text-[#1C3040]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
              >
                {item.finalPayoutCents != null
                  ? `₹ ${(item.finalPayoutCents / 100).toLocaleString("en-IN")}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      className={className}
    >
      <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
    </svg>
  );
}

function getStatus(item: InventoryRow): { label: string; tagClass: string } {
  if (item.soldOut) {
    return {
      label: "Sold",
      tagClass: "bg-[#dcfce7] text-[#166534]",
    };
  }
  if (item.listingStatus === "list_now") {
    return {
      label: "Listed",
      tagClass: "bg-[#fef3c7] text-[#92400e]",
    };
  }
  return {
    label: "Unlisted",
    tagClass: "bg-[#fee2e2] text-[#b91c1c]",
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function relativeTimeFromNow(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 0) return `${diffDay}d`;
  if (diffHr > 0) return `${diffHr}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return "Just now";
}

export default function InventoryPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F8F8] p-6 text-[#1C3040]">Loading inventory…</div>}>
      <InventoryPage />
    </Suspense>
  );
}
