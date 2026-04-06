"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ProductCard } from "@/components/product-card";
import gridStyles from "@/components/ProductCard.module.css";
import { useBrandProductsInfinite } from "@/lib/catalog-queries";

const PAGE_SIZE = 12;

export default function BrandPage() {
  const params = useParams();
  const router = useRouter();
  const brand = typeof params.brand === "string" ? decodeURIComponent(params.brand) : "";
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } = useBrandProductsInfinite(brand, PAGE_SIZE);
  const products = data?.pages.flat() ?? [];
  const loading = isPending && products.length === 0;
  const loadingMore = isFetchingNextPage;
  const hasMore = !!hasNextPage;

  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchNextPage]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 rounded-lg border border-[#c7a77b] bg-white px-3 py-2 text-[15px] font-medium text-[#1C3040] hover:bg-[#c7a77b]/10"
        >
          ← Back
        </button>
      </div>
      <h1 className="font-serif text-[28px] font-semibold text-[#1C3040] sm:text-[32px]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        {brand} Edit
      </h1>
      <p className="mt-1 text-[15px] text-[#72808C]">Curated {brand} products.</p>

      {loading && products.length === 0 ? (
        <div className="py-12 text-center text-[16px] text-[#72808C]">Loading…</div>
      ) : (
        <>
          <div className={`${gridStyles.grid} mt-8`}>
            {products.map((p) => (
              <ProductCard key={`${p.category}-${p.id}`} product={p} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-8" />
          {loadingMore && <div className="py-4 text-center text-[15px] text-[#72808C]">Loading more…</div>}
        </>
      )}
    </div>
  );
}
