"use client";

import Image from "next/image";
import Link from "next/link";

const INSTAGRAM_URL = "https://www.instagram.com/houseofplutus_/";
const FACEBOOK_URL = "https://www.facebook.com/share/179REkX7F7/";
const SUPPORT_MAILTO =
  "mailto:support@houseofplutus.com?subject=" +
  encodeURIComponent("Support Request") +
  "&body=" +
  encodeURIComponent(
    "Hello House of Plutus team,\r\n\r\nI would like to get in touch regarding..."
  );

const CATEGORY_LINKS = [
  { label: "Apparel", href: "/dashboard/category/apparel" },
  { label: "Accessories", href: "/dashboard/category/accessories" },
  { label: "Handbags", href: "/dashboard/category/handbags" },
  { label: "Perfumes", href: "/dashboard/category/perfumes" },
  { label: "Sneakers", href: "/dashboard/category/sneakers" },
  { label: "Watches", href: "/dashboard/category/watches" },
] as const;

type QuickLink = { label: string; href: string };

const QUICK_LINKS_DESKTOP: QuickLink[] = [
  { label: "Edit Account Details", href: "/dashboard/profile" },
  { label: "Support", href: "/dashboard/support" },
  { label: "About Us", href: "/dashboard/about" },
  { label: "Terms & Conditions", href: "/dashboard/terms" },
  { label: "Privacy Policy", href: "/dashboard/privacy" },
  { label: "Contact Support", href: "/dashboard/support" },
  { label: "FAQs", href: "/dashboard/faqs" },
];

// Phone / extended footer quick-links: remove "Edit Account Details" and "Contact us"
const QUICK_LINKS_MOBILE: QuickLink[] = [
  { label: "About Us", href: "/dashboard/about" },
  { label: "Contact Support", href: SUPPORT_MAILTO },
  { label: "Terms & Conditions", href: "/dashboard/terms" },
  { label: "Privacy Policy", href: "/dashboard/privacy" },
  { label: "FAQs", href: "/dashboard/faqs" },
];

export default function SiteFooter(
  { mobileHideTopBrand = false, mobileHideTopBorder = false }: { mobileHideTopBrand?: boolean; mobileHideTopBorder?: boolean } = {}
) {
  return (
    <footer
      className={`site-footer bg-white border-[#DCE1E6] ${
        mobileHideTopBorder ? "border-t-0 sm:border-t" : "border-t"
      }`}
    >
      {/* Desktop / Web */}
      <div className="hidden sm:block">
        <div className="mx-auto w-full max-w-[1650px] px-10 lg:px-0 pt-10 pb-0">
          <div className="flex w-full flex-col gap-14 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[520px]">
              <div className="flex items-center gap-3 ">
                <Image
                  src="/House of vendors blue.svg"
                  alt="Vendors"
                  width={240}
                  height={72}
                  className="-ml-7 h-auto w-[240px]"
                  priority={false}
                />
              </div>
              <p
                className="mt-4 text-[22px] italic text-[#a37442]"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
              >
                For the trusted partners behind luxury.
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-[#4b5563]">
                House of Vendors is built for our verified partners to manage products, track orders, and stay updated on
                payouts-all in one place.
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-12 lg:flex-row lg:justify-center lg:gap-24">
              <div>
                <h3 className="text-[22px] font-semibold text-[#111827]">CATEGORIES</h3>
                <ul className="mt-4 space-y-2.5 text-[16px] font-medium text-[#374151]">
                  {CATEGORY_LINKS.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="cursor-pointer font-medium text-[#374151] hover:text-[#c7a77b]">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-[22px] font-semibold text-[#111827]">QUICK LINKS</h3>
                <ul className="mt-4 space-y-2.5 text-[16px] font-medium text-[#374151]">
                  {QUICK_LINKS_DESKTOP.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="cursor-pointer font-medium text-[#374151] hover:text-[#c7a77b]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col items-start gap-4 lg:items-end">
              <div className="flex items-center pt-45 gap-4">
                <SocialIconLink href={INSTAGRAM_URL} ariaLabel="Instagram">
                  <InstagramIcon />
                </SocialIconLink>
                <SocialIconLink href={FACEBOOK_URL} ariaLabel="Facebook">
                  <FacebookIcon />
                </SocialIconLink>
                <SocialIconLink href={SUPPORT_MAILTO} ariaLabel="Email">
                  <MailIcon />
                </SocialIconLink>
              </div>
              <Link href={SUPPORT_MAILTO} className="mt-1 text-[15px] font-semibold text-[#111827]">
                support@houseofplutus.com
              </Link>
            </div>
          </div>
        </div>

        <div className="px-10 lg:px-0 mt-[60px] pb-6">
          <p className="mx-auto w-full max-w-[1650px] text-[16px] font-medium text-[#4b5563]">
            © 2026 All Rights Reserved by House of Plutus - A Unit of VOF Online Private Limited, India.
          </p>
        </div>
      </div>

      {/* Mobile / Phone */}
      <div className="sm:hidden">
        <div className="px-0  pb-8">
          {!mobileHideTopBrand && (
            <div className="flex items-center gap-3 px-6">
              <Image
                src="/House of vendors blue.svg"
                alt="Vendors"
                width={220}
                height={66}
                className="-ml-6 h-auto w-[190px]"
                priority={false}
              />
            </div>
          )}

          <p
            className="px-6 text-[20px] italic text-[#a37442]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 }}
          >
            For the trusted partners behind luxury.
          </p>
          <p className="mt-4 px-6 text-[16px] leading-[1.75] text-[#4b5563]">
            House of Vendors is built for our verified partners to manage products, track orders, and stay updated on
            payouts-all in one place.
          </p>

          <div className="mt-8 h-px w-full bg-[#DCE1E6]" />

          <div className="mt-10 grid grid-cols-2 gap-10 px-6">
            <div>
              <h3 className="text-[18px] font-medium text-[#111827]">Categories</h3>
              <ul className="mt-6 space-y-4 text-[14px] text-[#111827]">
                {CATEGORY_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="cursor-pointer hover:opacity-80">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[18px] font-medium text-[#111827]">Quick Links</h3>
              <ul className="mt-6 space-y-4 text-[14px] text-[#111827]">
                {QUICK_LINKS_MOBILE.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="cursor-pointer hover:opacity-80">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 h-px w-full bg-[#DCE1E6]" />

          <div className="mt-8 flex items-center gap-4 px-6">
            <SocialIconLink href={INSTAGRAM_URL} ariaLabel="Instagram">
              <InstagramIcon />
            </SocialIconLink>
            <SocialIconLink href={FACEBOOK_URL} ariaLabel="Facebook">
              <FacebookIcon />
            </SocialIconLink>
            <SocialIconLink href={SUPPORT_MAILTO} ariaLabel="Email">
              <MailIcon />
            </SocialIconLink>
          </div>

          <Link href={SUPPORT_MAILTO} className="mt-4 block px-6 text-[16px] font-semibold text-[#111827] sm:text-[20px]">
            support@houseofplutus.com
          </Link>

          <div className="mt-8 h-px w-full bg-[#DCE1E6]" />

          <p className="mt-6 px-6 text-[14px] leading-relaxed text-[#4b5563]">
            © 2026 All Rights Reserved by House of Plutus
            <br />A Unit of VOF Online Private Limited, India.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialIconLink({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-white sm:h-12 sm:w-12"
    >
      <span className="flex h-5 w-5 items-center justify-center sm:h-6 sm:w-6">{children}</span>
    </Link>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M7.6 2h8.8A5.6 5.6 0 0 1 22 7.6v8.8A5.6 5.6 0 0 1 16.4 22H7.6A5.6 5.6 0 0 1 2 16.4V7.6A5.6 5.6 0 0 1 7.6 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 16.1a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M17.25 6.75h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M14 8.6V7.2c0-.8.5-1.2 1.2-1.2H17V2.2h-2.3C12.1 2.2 11 3.7 11 6.7v1.9H8.6V12H11v9.8h3.4V12h2.4l.6-3.4H14Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M4.5 6.8h15A1.7 1.7 0 0 1 21.2 8.5v8.9A1.7 1.7 0 0 1 19.5 19h-15a1.7 1.7 0 0 1-1.7-1.7V8.5A1.7 1.7 0 0 1 4.5 6.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M4.2 8.2 12 13.2l7.8-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

