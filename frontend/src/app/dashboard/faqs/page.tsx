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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="space-y-1 sm:space-y-3">
      <h2 className="text-[16px] font-semibold text-[#1C3040] sm:text-[20px]">{question}</h2>
      <p className="text-[16px] leading-relaxed text-[#50626C] sm:text-[20px] sm:leading-[1.75]">{answer}</p>
    </div>
  );
}

export default function FaqsPage() {
  const router = useRouter();

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1650px] px-4 pb-12 pt-8 sm:px-8 lg:px-0">
        {/* Mobile header */}
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
            FAQs
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
            FAQs
          </h1>
        </div>

        <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-10" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
          <FaqItem
            question="1. What is House of Vendors?"
            answer="House of Vendors is a platform that allows verified sellers to manage inventory, track orders, and sell luxury products through marketplace such as House of Plutus."
          />
          <FaqItem
            question="2. Who can become a vendor on the platform?"
            answer="Only verified sellers who meet the platform's requirements and complete the onboarding process can sell products through House of Vendors."
          />
          <FaqItem
            question="3. How does product verification work?"
            answer="Products listed by vendors may go through a verification process to ensure authenticity, quality, and compliance with marketplace standards."
          />
          <FaqItem
            question="4. When do vendors receive payouts?"
            answer="Payouts for sales made on House of Plutus are processed after the verification and order completion process, according to the payout schedule mentioned in the terms."
          />
          <FaqItem
            question="5. What happens if a product fails verification?"
            answer="If a product does not pass verification, it will be marked as rejected and the vendor will be notified with the reason for rejection."
          />
          <FaqItem
            question="6. How can I contact support?"
            answer="Vendors can raise a support ticket through the platform's support section to get help with orders, payments, verification, or account-related issues."
          />
          <FaqItem
            question="7. How do I list products on the platform?"
            answer="Once your vendor account is approved, you can add and manage product listings through the vendor dashboard."
          />
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

