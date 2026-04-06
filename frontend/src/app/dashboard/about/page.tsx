"use client";

import { useRouter } from "next/navigation";
import SiteFooter from "@/components/site-footer";

function BackIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" />
    </svg>
  );
}

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1650px] px-4 pb-12 pt-8 sm:px-8 lg:px-0">
        <div className="mb-6 flex items-center gap-4 sm:hidden">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center border border-[#c7a77b] bg-white"
            aria-label="Go back"
          >
            <BackIcon className="h-5 w-5 shrink-0 text-[#1C3040]" />
          </button>
          <h1
            className="truncate text-[20px] font-medium text-[#1C3040]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
          >
            About Us
          </h1>
        </div>

        {/* Desktop / web header */}
        <div className="mb-8 hidden items-center justify-between gap-4 sm:flex">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-none border-2 border-[#c7a77b] bg-white px-3 py-2 hover:bg-[#c7a77b]/10"
          >
            <BackIcon className="h-5 w-5 shrink-0 text-[#1C3040]" />
            <span className="font-semibold text-[#1C3040]" style={{ fontSize: "15px", fontFamily: "'Montserrat', Arial, sans-serif" }}>
              Back
            </span>
          </button>
          <h1
            className="flex-1 pr-[30px] text-center text-[40px] text-[#1C3040] sm:pb-10"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
          >
            About Us
          </h1>
        </div>

        <div className="mt-6 sm:mt-8 sm:pb-24" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
          <ul className="list-disc space-y-5 pl-5 text-[16px] leading-relaxed text-[#50626C] sm:space-y-8 sm:pl-7 sm:text-[20px] sm:leading-[1.75]">
            <li>
              House of Vendors is a platform designed to empower trusted sellers to manage, list, and sell luxury products
              seamlessly. Through our ecosystem, vendors can manage inventory, track orders, and receive payouts while
              ensuring authenticity and quality for every product.
            </li>
            <li>
              Powered by VOF Online, House of Vendors connects verified sellers with House of Plutus, our customer
              Marketplace for luxury goods, creating a reliable and transparent luxury commerce experience.
            </li>
          </ul>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

