"use client";

import Link from "next/link";
import DashboardNavbar from "@/components/dashboard-navbar";
import MobileBottomNav from "@/components/mobile-bottom-nav";

/**
 * Home layout: same navbar and search bar as dashboard so /home is the main landing
 * with search and nav. Home page content (feed) is shown below.
 */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#ffffff]">
      <DashboardNavbar />
      <div className="w-full bg-[#ffffff] px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        <Link
          href="/dashboard/search"
          className="flex w-full items-center gap-2 rounded-none border border-[#DCE1E6] bg-[#f2f3f4] px-3 py-3 text-left text-[15px] sm:gap-3 sm:px-4 sm:py-4 sm:text-[18px]"
        >
          <SearchIcon className="h-5 w-5 shrink-0 text-[#828f96]" />
          <span className="text-[#828f96]">Search Products…</span>
        </Link>
      </div>
      <main className="bg-[#ffffff] pb-16 sm:pb-0">{children}</main>
      <MobileBottomNav />
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
