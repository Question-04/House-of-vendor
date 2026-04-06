"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardNavbar from "@/components/dashboard-navbar";
import MobileBottomNav from "@/components/mobile-bottom-nav";

/**
 * Dashboard layout: same navbar for all dashboard routes.
 * Search bar below nav only on non-search pages (hidden on /dashboard/search).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isNotificationsPage = pathname === "/dashboard/notifications";
  const isProductDetail = pathname?.startsWith("/dashboard/product/");
  const isCategoryPage = pathname?.startsWith("/dashboard/category/");
  const isLegalInfoPage =
    pathname === "/dashboard/about" ||
    pathname === "/dashboard/privacy" ||
    pathname === "/dashboard/terms" ||
    pathname === "/dashboard/faqs";
  const showSearchBarOnDashboardMobile = pathname === "/dashboard";
  const showSearchBar =
    pathname !== "/dashboard" &&
    pathname !== "/dashboard/search" &&
    pathname !== "/dashboard/add-product" &&
    pathname !== "/dashboard/inventory" &&
    pathname !== "/dashboard/orders" &&
    pathname !== "/dashboard/profile" &&
    pathname !== "/dashboard/support" &&
    pathname !== "/dashboard/notifications" &&
    !isLegalInfoPage &&
    !isProductDetail;

  return (
    <div className="min-h-screen bg-[#ffffff]">
      <DashboardNavbar />
      {showSearchBarOnDashboardMobile && (
        <div className="bg-[#ffffff] px-4 py-5 sm:hidden">
          <Link
            href="/dashboard/search"
            className="flex w-full items-center gap-3 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-3 text-left text-[14px]"
          >
            <SearchIcon className="h-5 w-5 shrink-0 text-[#828f96]" />
            <span className="text-[#828f96]">Search Products…</span>
          </Link>
        </div>
      )}
      {showSearchBar && (
        <div
          className={`bg-[#ffffff] px-4 py-8 sm:px-6 lg:px-8 ${
            isCategoryPage ? "hidden sm:block" : "w-full"
          }`}
        >
          <Link
            href="/dashboard/search"
            className="flex w-full items-center gap-3 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-4 py-4 text-left text-[18px]"
          >
            <SearchIcon className="h-5 w-5 shrink-0 text-[#828f96]" />
            <span className="text-[#828f96]">Search Products…</span>
          </Link>
        </div>
      )}
      <main className="bg-[#ffffff]">{children}</main>
      {!isProductDetail && !isNotificationsPage && <MobileBottomNav />}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
    </svg>
  );
}
