"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getBrandPage, getCategoryPage, type ProductCard } from "@/lib/api";

/** Catalog slices: short stale window + background refetch — new DB products show within ~2 min without stale-forever. */
export const CATALOG_STALE_MS = 120_000;

export const catalogQueryKeys = {
  category: (slug: string, pageSize: number) => ["catalog", "category", slug, pageSize] as const,
  brand: (brand: string, pageSize: number) => ["catalog", "brand", brand, pageSize] as const,
};

export function useCategoryProductsInfinite(slug: string, pageSize: number) {
  return useInfiniteQuery({
    queryKey: catalogQueryKeys.category(slug, pageSize),
    queryFn: async ({ pageParam }): Promise<ProductCard[]> => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      const res = await getCategoryPage(slug, pageSize, offset);
      const raw =
        res.success && Array.isArray(res.products)
          ? res.products.filter((p) => (p.category || "").toLowerCase() === slug.toLowerCase())
          : [];
      return raw;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < pageSize) return undefined;
      return allPages.reduce((sum, page) => sum + page.length, 0);
    },
    enabled: !!slug,
    staleTime: CATALOG_STALE_MS,
    gcTime: 30 * 60_000,
  });
}

export function useBrandProductsInfinite(brand: string, pageSize: number) {
  return useInfiniteQuery({
    queryKey: catalogQueryKeys.brand(brand, pageSize),
    queryFn: async ({ pageParam }): Promise<ProductCard[]> => {
      const offset = typeof pageParam === "number" ? pageParam : 0;
      const res = await getBrandPage(brand, pageSize, offset);
      if (!res.success || !Array.isArray(res.products)) return [];
      return res.products;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < pageSize) return undefined;
      return allPages.reduce((sum, page) => sum + page.length, 0);
    },
    enabled: !!brand,
    staleTime: CATALOG_STALE_MS,
    gcTime: 30 * 60_000,
  });
}
