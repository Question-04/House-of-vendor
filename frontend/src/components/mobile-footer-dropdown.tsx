"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type FooterItem =
  | {
      key: string;
      label: string;
      icon: ReactNode;
      href: string;
      onClick?: never;
    }
  | {
      key: string;
      label: string;
      icon: ReactNode;
      href?: never;
      onClick: () => void;
    };

export default function MobileFooterDropdown({
  items,
  expandedContent,
}: {
  items: FooterItem[];
  expandedContent: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const copyrightText = useMemo(
    () => (
      <>
        © 2026 All Rights Reserved by House of Plutus
        <br />
        A Unit of VOF Online Private Limited, India.
      </>
    ),
    []
  );

  if (expanded) {
    return (
      <section className="mobile-footer-dropdown mt-8 border-t border-[#DCE1E6] bg-white sm:hidden">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex w-full items-center justify-between px-4 pt-4 pb-0"
          aria-label="Collapse vendor footer"
        >
          <Image
            src="/House of vendors blue.svg"
            alt="Vendors"
            width={220}
            height={66}
            className="-ml-4 h-auto w-[170px]"
            priority={false}
          />
          <ChevronUp />
        </button>
        <div>{expandedContent}</div>
      </section>
    );
  }

  return (
    <section className="mobile-footer-dropdown mt-8 border-t border-[#DCE1E6] bg-white sm:hidden">
      <div className="flex flex-col">
        <div className="flex flex-col border-b border-[#DCE1E6]">
          {items.map((item, idx) => {
            const content = (
              <>
                <div className="flex w-10 items-center justify-center">{item.icon}</div>
                <div className="flex-1 text-[15px] font-medium text-[#1C3040]">{item.label}</div>
                <div className="flex w-10 items-center justify-center">
                  <ChevronRight />
                </div>
              </>
            );

            return item.href ? (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-2 px-4 py-4"
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className="flex w-full items-center gap-2 px-4 py-4 text-left"
              >
                {content}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-between px-4 py-4"
          aria-label="Open vendor footer"
        >
          <Image
            src="/House of vendors blue.svg"
            alt="Vendors"
            width={220}
            height={66}
            className="-ml-6 h-auto w-[170px]"
            priority={false}
          />
          <ChevronDown />
        </button>

        <div className="px-4 pb-3 text-[12px] leading-relaxed text-[#7A8793]">{copyrightText}</div>
      </div>
    </section>
  );
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#1C3040" viewBox="0 0 256 256" aria-hidden>
      <path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="#7A8793" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 15l6-6 6 6" stroke="#7A8793" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

