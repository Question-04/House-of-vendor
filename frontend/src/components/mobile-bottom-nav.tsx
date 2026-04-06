"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

type NavItem = {
  href: string;
  label: string;
  key: "home" | "dashboard" | "inventory" | "orders" | "profile";
};

const NAV_ITEMS: NavItem[] = [
  { key: "home", href: "/home", label: "Home" },
  { key: "dashboard", href: "/dashboard", label: "Dashboard" },
  { key: "inventory", href: "/dashboard/inventory", label: "Inventory" },
  { key: "orders", href: "/dashboard/orders", label: "Orders" },
  { key: "profile", href: "/dashboard/profile", label: "Profile" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.add("has-mobile-bottom-nav");

    return () => {
      document.body.classList.remove("has-mobile-bottom-nav");
    };
  }, []);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 translate-y-0 transition-transform duration-200 sm:hidden"
      aria-label="Primary mobile navigation"
    >
      <div className="grid h-[65px] grid-cols-5 items-center border-t border-white/40 bg-white/80 px-1 text-xs font-medium text-[#7A8793] shadow-[0_-10px_30px_rgba(5,21,36,0.35)] backdrop-blur">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.key === "home"
              ? pathname === "/home"
              : item.key === "dashboard"
                ? pathname === "/dashboard"
                : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-center"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                {renderIcon(item.key, isActive)}
              </span>
              <span
                className={`w-full whitespace-nowrap text-center text-[11px] leading-tight tracking-tight ${
                  isActive ? "text-[#051F2D] font-semibold" : "text-[#7A8793]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function renderIcon(key: NavItem["key"], active: boolean) {
  switch (key) {
    case "home":
      return active ? <HomeFilled /> : <HomeOutline />;
    case "dashboard":
      return active ? <DashboardFilled /> : <DashboardOutline />;
    case "inventory":
      return active ? <InventoryFilled /> : <InventoryOutline />;
    case "orders":
      return active ? <OrdersFilled /> : <OrdersOutline />;
    case "profile":
      return active ? <ProfileFilled /> : <ProfileOutline />;
    default:
      return null;
  }
}

function HomeOutline() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1C3040" viewBox="0 0 256 256">
      <path d="M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z"></path>
    </svg>
  );
}

function HomeFilled() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#051F2D" viewBox="0 0 256 256">
      <path d="M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z"></path>
    </svg>
  );
}

function DashboardOutline() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1C3040" viewBox="0 0 256 256">
      <path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z"></path>
    </svg>
  );
}

function DashboardFilled() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#051F2D" viewBox="0 0 256 256">
      <path d="M216,56v60a4,4,0,0,1-4,4H136V44a4,4,0,0,1,4-4h60A16,16,0,0,1,216,56ZM116,40H56A16,16,0,0,0,40,56v60a4,4,0,0,0,4,4h76V44A4,4,0,0,0,116,40Zm96,96H136v76a4,4,0,0,0,4,4h60a16,16,0,0,0,16-16V140A4,4,0,0,0,212,136ZM40,140v60a16,16,0,0,0,16,16h60a4,4,0,0,0,4-4V136H44A4,4,0,0,0,40,140Z"></path>
    </svg>
  );
}

function InventoryOutline() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1C3040" viewBox="0 0 256 256">
      <path d="M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z"></path>
    </svg>
  );
}

function InventoryFilled() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#051F2D" viewBox="0 0 256 256">
      <path d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z"></path>
    </svg>
  );
}

function OrdersOutline() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1C3040" viewBox="0 0 256 256">
      <path d="M223.68,66.15,135.68,18h0a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32h0l80.34,44L128,120,47.66,76ZM40,90l80,43.78v85.79L40,175.82Zm96,129.57V133.82L216,90v85.78Z"></path>
    </svg>
  );
}

function OrdersFilled() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#051F2D" viewBox="0 0 256 256">
      <path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,120,47.65,76,128,32l80.35,44Zm8,99.64V133.83l80-43.78v85.76Z"></path>
    </svg>
  );
}

function ProfileOutline() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1C3040" viewBox="0 0 256 256">
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM96,120a32,32,0,1,1,32,32A32,32,0,0,1,96,120Zm97.76,66.41a79.66,79.66,0,0,0-36.06-28.75,48,48,0,1,0-59.4,0,79.66,79.66,0,0,0-36.06,28.75,88,88,0,1,1,131.52,0Z"></path>
    </svg>
  );
}

function ProfileFilled() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#051F2D" viewBox="0 0 256 256">
      <path d="M172,120a44,44,0,1,1-44-44A44.05,44.05,0,0,1,172,120Zm60,8A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88.09,88.09,0,0,0-91.47-87.93C77.43,41.89,39.87,81.12,40,128.25a87.65,87.65,0,0,0,22.24,58.16A79.71,79.71,0,0,1,84,165.1a4,4,0,0,1,4.83.32,59.83,59.83,0,0,0,78.28,0,4,4,0,0,1,4.83-.32,79.71,79.71,0,0,1,21.79,21.31A87.62,87.62,0,0,0,216,128Z"></path>
    </svg>
  );
}

