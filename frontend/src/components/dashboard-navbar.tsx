"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getProfile } from "@/lib/api";
import { getOnboardingPhone } from "@/lib/onboarding-session";
import { useNotificationsUnreadQuery } from "@/lib/dashboard-queries";
import { useTheme } from "@/contexts/theme-context";
import { DayNightToggle } from "@/components/day-night-toggle";


// Design tokens: nav text semibold 20px, icons 24px, explore colour #c7a77b
const navLinks = [
  { href: "/home", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/inventory", label: "Inventory" },
  { href: "/dashboard/orders", label: "Orders" },
];

export default function DashboardNavbar() {
  const pathname = usePathname();
  const { isDark: darkMode, toggleTheme: setDarkMode } = useTheme();
  const [userInitial, setUserInitial] = useState<string>("V");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    setPhone(getOnboardingPhone() || "");
  }, []);
  const { data: unreadCount = 0 } = useNotificationsUnreadQuery(phone);
  const prevUnreadRef = useRef<number | undefined>(undefined);
  const [dotPulse, setDotPulse] = useState(false);

  useEffect(() => {
    const p = getOnboardingPhone();
    if (!p) return;
    getProfile(p).then((res) => {
      if (res.success && res.profile?.fullName?.trim()) {
        const first = res.profile.fullName.trim().charAt(0).toUpperCase();
        setUserInitial(first);
      }
    });
  }, []);

  useEffect(() => {
    const prev = prevUnreadRef.current;
    prevUnreadRef.current = unreadCount;
    if (prev !== undefined && unreadCount > prev && unreadCount > 0) {
      setDotPulse(true);
      const t = window.setTimeout(() => setDotPulse(false), 1400);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("House of Vendors", { body: "You have a new notification. Open the bell to read it." });
        } catch {
          /* ignore */
        }
      }
      return () => window.clearTimeout(t);
    }
  }, [unreadCount]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#DCE1E6] bg-white pb-0 sm:pb-2 shadow-sm dark:border-white/10 dark:bg-[#051f2d]">
      <div className="flex h-[65px] w-full items-center justify-between pr-4 sm:h-[76px] sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8 md:grid md:grid-cols-3">
        {/* Left: logo — match onboarding logo sizing */}
        <div className="flex items-center justify-start">
          <Link href="/home" className="-ml-0.5 flex items-center gap-2">
            <Image
              src={darkMode ? "/House of vendors white.svg" : "/House of vendors blue.svg"}
              alt="Vendors"
              width={220}
              height={66}
              className="h-auto w-[190px] sm:w-[240px]"
            />
          </Link>
        </div>

        {/* Center: Home, Dashboard, Inventory, Orders — medium weight */}
        <nav className="hidden items-center justify-center gap-8 md:flex" aria-label="Main">
          {navLinks.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className={`text-[18px] font-medium sm:text-[20px] dark:text-white/90 dark:hover:text-white ${
                pathname === href ? "text-[#1C3040] dark:text-white" : "text-[#1C3040]/80 hover:text-[#1C3040]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right: theme toggle (pill) + notification. Profile hidden on phone. */}
        <div className="flex items-center justify-end gap-3">
          <DayNightToggle isDark={darkMode} onToggle={setDarkMode} disabled disabledMessage="Feature will be available soon" />
          <Link
            href="/dashboard/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="Notifications"
          >
            <NotificationIcon className="h-6 w-6 text-[#1C3040] dark:text-white" />
            {unreadCount > 0 && (
              <span
                className={`absolute right-1 top-1 h-2 w-2 rounded-full bg-[#051f2d] ring-1 ring-white ${dotPulse ? "notif-dot-pulse" : ""}`}
                aria-hidden
              />
            )}
          </Link>
          <Link
            href="/dashboard/profile"
            className="hidden h-9 w-9 items-center justify-center rounded-full bg-[#6B4E9B] text-[14px] font-medium text-white md:flex"
            aria-label="Profile"
          >
            {userInitial}
          </Link>
        </div>
      </div>
    </header>
  );
}

function LightModeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
    </svg>
  );
}

function DarkModeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z" />
    </svg>
  );
}

function NotificationIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256" className={className}>
      <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" />
    </svg>
  );
}
