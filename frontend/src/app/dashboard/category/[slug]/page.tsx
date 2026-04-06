"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ProductCard } from "@/components/product-card";
import gridStyles from "@/components/ProductCard.module.css";
import { useCategoryProductsInfinite } from "@/lib/catalog-queries";

const FALLBACK_BRANDS = ["Nike", "Adidas", "Jordan 1", "Jordan 4", "Dior", "Yeezy", "Vans", "Crocs"];

const CATEGORY_META: Record<string, { title: string; subtitle: string }> = {
  sneakers: { title: "The Sneakers Edit", subtitle: "Curated sneakers, selected for quality and authenticity." },
  perfumes: { title: "Fragrance Selection", subtitle: "Curated fragrances for every preference." },
  watches: { title: "Timepiece Collection", subtitle: "Curated timepieces, selected for quality and authenticity." },
  apparel: { title: "The Apparel Edit", subtitle: "Curated apparel, selected for quality and authenticity." },
  handbags: { title: "The Handbags Edit", subtitle: "Curated handbags, selected for quality and authenticity." },
  accessories: { title: "The Accessories Edit", subtitle: "Curated accessories, selected for quality and authenticity." },
};

const PAGE_SIZE = 8;

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isPending, isFetchingNextPage, hasNextPage, fetchNextPage } = useCategoryProductsInfinite(
    slug,
    PAGE_SIZE
  );
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
      { rootMargin: "400px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchNextPage]);

  const meta = CATEGORY_META[slug] ?? { title: slug, subtitle: "" };

  return (
    <div className="w-full px-2 pb-16 sm:px-6 lg:px-8">
      {/* Mobile: back arrow + compact search bar */}
      <div className="mb-5 mt-8 flex items-center gap-3 sm:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center border border-[#c7a77b] bg-white"
          aria-label="Go back"
        >
          <BackArrowIcon className="h-5 w-5 text-[#051F2D]" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/search")}
          className="flex-1"
          aria-label="Search products"
        >
          <div className="flex h-11 items-center gap-3 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 text-[15px]">
            <SearchIcon className="h-5 w-5 text-[#828f96]" />
            <span className="truncate text-[#828f96]">Looking for something specific?</span>
          </div>
        </button>
      </div>

      {/* Brand tabs — hidden on phone, visible on web */}
      <div className="mb-10 hidden flex-wrap gap-6 sm:flex">
        {FALLBACK_BRANDS.map((brand) => (
          <Link
            key={brand}
            href={`/dashboard/brand/${encodeURIComponent(brand)}`}
            className="rounded-none border border-[#9ba5ab] bg-white px-8 py-2 text-[15px] font-medium text-[#828f96] hover:border-[#6b7280] hover:text-[#1C3040]"
          >
            {brand}
          </Link>
        ))}
      </div>

      {/* Heading row — same as home: title left, "Return to home" in place of "Explore the Edit" */}
      <div className="mb-2 mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-[25px] text-[#1C3040] sm:text-[40px]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
          >
            {meta.title}
          </h1>
          <p
            className="mt-1 font-medium text-[#72808C]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "14px" }}
          >
            {meta.subtitle}
          </p>
        </div>
        <Link
          href="/home"
          className="hidden shrink-0 rounded-none border-2 border-[#c7a77b] bg-white px-4 py-2 text-[15px] font-semibold text-[#c7a77b] hover:bg-[#c7a77b]/10 hover:text-[#c7a77b] sm:inline-flex"
        >
          Return to home
        </Link>
      </div>

      {loading && products.length === 0 ? (
        <div className="py-12 text-center text-[16px] text-[#72808C]">Loading…</div>
      ) : (
        <>
          <div className={`${gridStyles.gridVertical} mt-4 sm:mt-8`}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} category={slug} />
            ))}
          </div>
          <div ref={sentinelRef} className="h-8" />
          {loadingMore && <div className="py-4 text-center text-[15px] text-[#72808C]">Loading more…</div>}
        </>
      )}
    </div>
  );
}

function BackArrowIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M164.24,203.76a6,6,0,1,1-8.48,8.48l-80-80a6,6,0,0,1,0-8.48l80-80a6,6,0,0,1,8.48,8.48L88.49,128Z"></path>
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
    </svg>
  );
}
