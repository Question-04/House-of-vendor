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

export default function PrivacyPage() {
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
            Privacy Policy
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
            className="flex-1 pr-12 text-center text-[40px] text-[#1C3040] sm:pb-10"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
          >
            Privacy Policy
          </h1>
        </div>

        <div className="mt-6 sm:mt-8" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
          <ul className="list-disc space-y-5 pl-5 text-[16px] leading-relaxed text-[#50626C] sm:space-y-8 sm:pl-7 sm:text-[20px] sm:leading-[1.75]">
            <li>
              House of Vendors (the &quot;Platform&quot;), accessible at www.houseofvendors.com, is operated by VOF Online
              (&quot;Company&quot;). We&apos;re committed to protecting the privacy and confidentiality of the personal information
              of our users, including sellers, partners, and visitors who access the platform.
            </li>
            <li>
              This Privacy Policy explains how we collect, use, store, process, and protect the information that you provide
              while using the House of Vendors platform. It also outlines your rights regarding your personal information and
              how you can contact us regarding privacy-related concerns.
            </li>
            <li>
              When you register as a seller or interact with the platform, we may collect certain information including but
              not limited to your name, contact details, business information, payment details, and documents required for
              vendor verification. This information is collected to facilitate onboarding, verify seller authenticity, process
              transactions, manage orders, and provide accurate and appropriate services on the platform.
            </li>
            <li>
              The information collected may also be used to improve platform functionality, communicate important updates,
              respond to support requests, and ensure compliance with applicable legal and regulatory requirements. We take
              reasonable technical and organizational measures to safeguard your information against unauthorized access, misuse,
              loss, or disclosure.
            </li>
            <li>
              House of Vendors may also share necessary information with trusted partners, payment processors, logistics providers,
              and marketplaces such as House of Plutus, solely for the purpose of enabling platform operations, and fulfilling your
              requested services, and payment settlements.
            </li>
            <li>
              By accessing or using the House of Vendors platform, you acknowledge that you have read, understood, and agreed to
              the practices described in this Privacy Policy. If you do not agree with any part of this policy, you should refrain
              from using the platform.
            </li>
            <li>
              We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or
              platform features. Any updates will be published on this page, and constitute acceptance of the revised policy.
            </li>
          </ul>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

