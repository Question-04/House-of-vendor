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

function LegalSection({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <section className="space-y-2 sm:space-y-3">
      <h2 className="text-[16px] font-semibold text-[#1C3040] sm:text-[20px]">{title}</h2>
      <ul className="list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-[#50626C] sm:space-y-4 sm:pl-7 sm:text-[20px] sm:leading-[1.75]">
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </section>
  );
}

export default function TermsPage() {
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
            Terms &amp; Conditions
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
            Terms &amp; Conditions
          </h1>
        </div>

        <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-10" style={{ fontFamily: "'Montserrat', Arial, sans-serif" }}>
          <section className="space-y-2 sm:space-y-3">
            <h2 className="text-[16px] font-semibold text-[#1C3040] sm:text-[20px]">Introduction</h2>
            <p className="text-[16px] leading-relaxed text-[#50626C] sm:text-[20px] sm:leading-[1.75]">
              These Terms and Conditions (“Agreement”) govern the use of the House of Vendors platform available at www.houseofvendors.com
              and the associated services provided by VOF Online (“Company”). By using the Platform, you agree to be bound by this Agreement,
              as well as the “Seller”, “Vendor”, and “Buyer” terms as applicable under the terms of use.
            </p>
          </section>

          <LegalSection
            title="1. Definitions"
            bullets={["House of Vendors refers to the consumer marketplace platform for the purchase and sale of luxury goods."]}
          />

          <LegalSection
            title="2. Registration and Account integrity"
            bullets={[
              "Sellers must maintain an account on the website. Accurate and complete information is required for registration.",
              "Sellers are responsible for maintaining the confidentiality of their account and for all activities under their account.",
            ]}
          />

          <LegalSection
            title="3. Product Listings and Sales"
            bullets={[
              "Sellers may list luxury goods for sale on House of Plutus and through the House of Vendors platform. The company reserves the right to review and approve all listings for compliance with relevant standards and policies.",
            ]}
          />

          <LegalSection
            title="4. Payout Terms"
            bullets={[
              "Sales on House of Plutus will be processed and delivered to the Seller 15 days after sale confirmation.",
              "If any order is voided or disputed, the payout timing may change and may be subject to adjustments based on the resolution process mentioned in the terms.",
            ]}
          />

          <LegalSection
            title="5. Responsibilities of Sellers"
            bullets={[
              "Sellers must ensure the authenticity and quality of all products listed.",
              "Sellers are responsible for fulfilling orders in a timely manner and providing tracking information to the company.",
              "Sellers must adhere to all applicable laws and regulations in relation to the sale of their products.",
            ]}
          />

          <LegalSection
            title="6. Intellectual Property Rights"
            bullets={[
              "The company owns all rights, titles, and interests in the website, including all related intellectual property rights.",
              "Sellers grant the company a non-exclusive license to use, display, and distribute their product information and trademarks for the purpose of facilitating sales.",
            ]}
          />

          <LegalSection
            title="7. Termination"
            bullets={[
              "The company may terminate a Seller’s access to the website for breach of these Terms and Conditions.",
              "Sellers may terminate their account by providing written notice to the company.",
            ]}
          />

          <LegalSection
            title="8. Indemnification"
            bullets={[
              "Sellers agree to indemnify and hold harmless the company from any claims, damages, or expenses arising from their use of the Website or breach of the Agreement.",
            ]}
          />

          <LegalSection
            title="9. Limitation of Liability"
            bullets={[
              "The company shall not be liable for any indirect, special, consequential, or punitive damages including lost profits, arising out of or relating to this agreement.",
            ]}
          />

          <LegalSection
            title="10. Dispute Resolution"
            bullets={[
              "Any disputes arising from this Agreement will be resolved through binding arbitration in accordance with the rules of the Indian Arbitration Association.",
            ]}
          />

          <LegalSection
            title="11. Miscellaneous"
            bullets={[
              "These Terms constitute the entire agreement between the Seller and the Company and supersede all prior agreements or understandings.",
              "The Company reserves the right to update or modify these Terms at any time. Continued use of the platform after such changes indicates acceptance of the revised Terms.",
              "If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will continue to remain in full force and effect.",
            ]}
          />

          <section className="space-y-2 sm:space-y-3">
            <h2 className="text-[16px] font-semibold text-[#1C3040] sm:text-[20px]">Acceptance</h2>
            <p className="text-[16px] leading-relaxed text-[#50626C] sm:text-[20px] sm:leading-[1.75]">
              By using the House of Vendors platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions.
            </p>
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

