"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProductCard } from "@/components/product-card";
import SiteFooter from "@/components/site-footer";
import gridStyles from "@/components/ProductCard.module.css";
import { getHomeFeed } from "@/lib/api";
import type { HomeFeedCategory as HomeFeedCategoryType } from "@/lib/api";

const FALLBACK_BRANDS = ["Nike", "Adidas", "Jordan 1", "Jordan 4", "Dior", "Yeezy", "Vans", "Crocs"];

// Simple in-memory cache so when user navigates back to home, data stays loaded (cache-first).
let cachedFeed: HomeFeedCategoryType[] | null = null;
let cachedBrands: string[] = FALLBACK_BRANDS;

const categoryToPath: Record<string, string> = {
  sneakers: "sneakers",
  perfumes: "perfumes",
  watches: "watches",
  apparel: "apparel",
  handbags: "handbags",
  accessories: "accessories",
};

export default function HomePage() {
  const [feed, setFeed] = useState<HomeFeedCategoryType[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFeed = useCallback(async (): Promise<HomeFeedCategoryType[]> => {
    try {
      const res = await getHomeFeed();
      if (!res.success || !Array.isArray(res.categories)) return [];
      return res.categories.map((section) => {
        const cat = (section.category || "").toLowerCase();
        const raw = (section.products ?? []).filter((p) => (p.category || "").toLowerCase() === cat);
        return {
          category: cat,
          title: section.title,
          subtitle: section.subtitle,
          products: raw.slice(0, 8),
        };
      });
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Cache-first: show cached data immediately when coming back to the page.
    if (cachedFeed && cachedFeed.length > 0) {
      setFeed(cachedFeed);
      setBrands(cachedBrands);
      setLoading(false);
    }
    (async () => {
      const feedData = await loadFeed();
      if (cancelled) return;
      if (feedData.length > 0) {
        cachedFeed = feedData;
        cachedBrands = FALLBACK_BRANDS;
      }
      setFeed(feedData.length > 0 ? feedData : cachedFeed ?? []);
      setBrands(cachedBrands);
      setError("");
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadFeed]);

  if (loading) {
    return (
      <div className="w-full px-4 py-12 text-center text-[18px] text-[#72808C]">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-4 py-12 text-center text-[18px] text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full px-4 pb-5 sm:pb-5 sm:px-6 lg:px-8">
      {brands.length > 0 && (
        <div className="mb-12 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mb-10 sm:flex-wrap sm:gap-6 sm:overflow-visible">
          {brands.map((brand) => (
            <Link
              key={brand}
              href={`/dashboard/brand/${encodeURIComponent(brand)}`}
              className="min-w-[96px] rounded-none border border-[#9ba5ab] bg-white px-3 py-1.5 text-center text-[12px] font-medium text-[#828f96] hover:border-[#6b7280] hover:text-[#1C3040] sm:min-w-0 sm:px-8 sm:py-2 sm:text-[15px] sm:text-left"
            >
              {brand}
            </Link>
          ))}
        </div>
      )}

      {feed.map((section) => (
        <section key={section.category} className="mb-14">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[75%] flex-1 min-w-0 sm:max-w-none">
              <h2
                className="text-[25px] text-[#1C3040] sm:text-[40px]"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
              >
                {section.title}
              </h2>
              <p
                className="mt-1 font-medium text-[#72808C]"
                style={{ fontFamily: "'Montserrat', Arial, sans-serif", fontSize: "14px" }}
              >
                {section.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/category/${categoryToPath[section.category] ?? section.category}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f3f4] text-[#1C3040] hover:bg-[#e4e6e8] sm:hidden"
                aria-label="Explore the Edit"
              >
                <ArrowCircleIcon />
              </Link>
              <Link
                href={`/dashboard/category/${categoryToPath[section.category] ?? section.category}`}
                className="hidden shrink-0 rounded-none border-2 border-[#c7a77b] bg-white px-4 py-2 text-[15px] font-semibold text-[#c7a77b] hover:bg-[#c7a77b]/10 hover:text-[#c7a77b] sm:inline-flex"
              >
                Explore the Edit
              </Link>
            </div>
          </div>
          <div className="-mx-4 overflow-x-auto pb-2 sm:mx-0 sm:overflow-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className={gridStyles.grid}>
              {(section.products ?? []).map((p) => (
                <ProductCard key={`${section.category}-${p.id}`} product={p} category={section.category} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <SiteFooter />
    </div>
  );
}

function ArrowCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#000000" viewBox="0 0 256 256">
      <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path>
    </svg>
  );
}
