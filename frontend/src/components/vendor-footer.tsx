"use client";

import type { ReactNode } from "react";
import SiteFooter from "@/components/site-footer";
import MobileFooterDropdown from "@/components/mobile-footer-dropdown";

type Variant = "full" | "minimal";

export default function VendorFooter({
  variant = "full",
  mobileItems,
}: {
  variant?: Variant;
  mobileItems?: { key: string; label: string; icon: ReactNode; href?: string; onClick?: () => void }[];
}) {
  if (variant === "full") {
    return (
      <div className="mt-14">
        <SiteFooter />
      </div>
    );
  }

  const items =
    mobileItems ??
    ([
      { key: "support", label: "Support", icon: <SupportIcon />, href: "/dashboard/support" },
      { key: "about", label: "About", icon: <AboutIcon />, href: "/dashboard/about" },
      { key: "privacy", label: "Privacy", icon: <PrivacyIcon />, href: "/dashboard/privacy" },
    ] as const);

  return (
    <>
      <div className="hidden sm:block mt-14">
        <SiteFooter />
      </div>

      <div className="sm:hidden">
        <MobileFooterDropdown
          expandedContent={<SiteFooter mobileHideTopBrand mobileHideTopBorder />}
          items={
            items.map((i) =>
              i.href
                ? { key: i.key, label: i.label, icon: i.icon, href: i.href }
                : { key: i.key, label: i.label, icon: i.icon, onClick: i.onClick ?? (() => {}) }
            ) as any
          }
        />
      </div>
    </>
  );
}

function SupportIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#1C3040" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M201.89,54.66A103.43,103.43,0,0,0,128.79,24H128A104,104,0,0,0,24,128v56a24,24,0,0,0,24,24H64a24,24,0,0,0,24-24V144a24,24,0,0,0-24-24H40.36A88.12,88.12,0,0,1,190.54,65.93,87.39,87.39,0,0,1,215.65,120H192a24,24,0,0,0-24,24v40a24,24,0,0,0,24,24h24a24,24,0,0,1-24,24H136a8,8,0,0,0,0,16h56a40,40,0,0,0,40-40V128A103.41,103.41,0,0,0,201.89,54.66ZM64,136a8,8,0,0,1,8,8v40a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V136Zm128,56a8,8,0,0,1-8-8V144a8,8,0,0,1,8-8h24v56Z" />
    </svg>
  );
}

function AboutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#1C3040" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="#1C3040" viewBox="0 0 256 256" aria-hidden="true">
      <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" />
    </svg>
  );
}

