"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/product-card";
import gridStyles from "@/components/ProductCard.module.css";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import { searchOverlay } from "@/lib/api";
import type { ProductCard as ProductCardType } from "@/lib/api";

const SEARCH_DEBOUNCE_MS = 350;
const CATEGORIES = [
  { id: "sneakers", label: "Sneakers" },
  { id: "apparel", label: "Apparel" },
  { id: "accessories", label: "Accessories" },
  { id: "perfumes", label: "Perfumes" },
  { id: "watches", label: "Watches" },
  { id: "handbags", label: "Handbags" },
];

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductCardType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchOverlay(query, {
        limit: 24,
        offset: 0,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      });
      setProducts(res.products ?? []);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategories]);

  // Debounce: only send request when user has typed something or selected categories (avoids unnecessary API calls).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const hasInput = query.trim() !== "" || selectedCategories.length > 0;
    if (!hasInput) {
      setProducts([]);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      runSearch();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedCategories, runSearch]);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const noResults = searched && !loading && products.length === 0;

  return (
    <div className="flex w-full flex-col px-2 pb-20 pt-6 sm:px-6 lg:px-8">
      {/* Back + search row: mobile-friendly, matches Explore Edit style */}
      <div className="mb-5 flex w-full items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center border border-[#c7a77b] bg-white sm:h-14 sm:w-14"
          aria-label="Go back"
        >
          <BackIcon className="h-5 w-5 text-[#051F2D]" />
        </button>
        <div className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 sm:h-14">
          <SearchIcon className="h-5 w-5 shrink-0 text-[#828F96]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Looking for something specific?"
            className="hide-search-cancel min-w-0 flex-1 bg-transparent text-[16px] text-[#1C3040] outline-none placeholder:text-[16px] placeholder:text-[#828F96] sm:text-[20px] sm:placeholder:text-[20px]"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontWeight: 500 }}
            autoFocus
          />
          {query.trim() !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 p-1 text-[#1C3040] hover:opacity-70"
              aria-label="Clear search"
            >
              <ClearIcon className="h-6 w-6 sm:h-8 sm:w-8" />
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-[13px] font-semibold text-[#1C3040] sm:text-[14px]">Browse by category</p>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mb-8 sm:flex-wrap sm:gap-6 sm:overflow-visible">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => toggleCategory(cat.id)}
            className={`min-w-[96px] rounded-none border px-3 py-1.5 text-[12px] font-medium transition sm:min-w-0 sm:px-5 sm:py-3 sm:text-[15px] ${
              selectedCategories.includes(cat.id)
                ? "border-[#9BA5AB] bg-[#f2f3f4] text-[#50626C]"
                : "border-[#9BA5AB] bg-white text-[#50626C] hover:bg-[#f2f3f4]"
            }`}
            style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading && <div className="py-8 text-center text-[15px] text-[#72808C]">Searching…</div>}

      {noResults && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
          <h2 className="font-semibold text-[#c7a77b]" style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "22px" }}>
            We don&apos;t have this product yet
          </h2>
          <p className="mt-3 max-w-[320px] text-[#828F96] sm:max-w-[700px]" style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "14px", fontWeight: 500 }}>
            Our catalogue is always expanding. If you have this product, submit it for review and we&apos;ll verify it for listing.
          </p>
          <Link
            href="/dashboard/add-product"
            className="mt-8 inline-block rounded-none bg-[#1C3040] px-6 py-3 font-semibold text-white hover:bg-[#1C3040]/90"
            style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "16px" }}
          >
            Add Product for Review
          </Link>
        </div>
      )}

      {!loading && !noResults && products.length === 0 && !query && (
        <div className="text-center" style={{ marginTop: "calc(var(--spacing) * 38)" }}>
          <h2 className="font-semibold text-[#c7a77b]" style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "22px" }}>
            Search products
          </h2>
          <p className="mt-2 text-[#828F96]" style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "13px", fontWeight: 500 }}>
            Search for the Best Product in our Catalogue
          </p>
        </div>
      )}

      {!loading && products.length > 0 && (
        <div className={`${gridStyles.gridVertical} mt-4 sm:mt-8`}>
          {products.map((p) => (
            <ProductCard key={`${p.category}-${p.id}`} product={p} />
          ))}
        </div>
      )}
      <MobileBottomNav />
    </div>
  );
}


function BackIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256" className={className}>
      <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
    </svg>
  );
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#000000" viewBox="0 0 256 256" className={className}>
      <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
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
