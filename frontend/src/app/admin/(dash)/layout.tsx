"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/verification", label: "Verification" },
  { href: "/admin/vouch", label: "Vouch queue" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/tickets", label: "Tickets" },
  { href: "/admin/product-requests", label: "Product requests" },
];

function navLinkClass(active: boolean, mobile: boolean) {
  const base = mobile
    ? "shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition"
    : "rounded-lg px-3 py-2 text-sm font-medium transition";
  return `${base} ${active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`;
}

export default function AdminDashLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [refreshing, setRefreshing] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && Boolean(pathname?.startsWith(href)));

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 700);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 md:flex-row md:min-h-screen">
      {/* Phone: top bar + horizontal nav — full-width content below */}
      <header className="sticky top-0 z-50 flex flex-col bg-[#0f172a] text-slate-100 shadow-md md:hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">House of Vendors</p>
            <p className="truncate text-sm font-semibold">Admin</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10 disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10"
            >
              Main site
            </Link>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Admin sections"
        >
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(isActive(item.href), true)}>
              {item.label}
            </Link>
          ))}
        </nav>
        {session?.user?.phone ? (
          <p className="border-t border-white/10 px-4 py-2 font-mono text-[11px] text-slate-400">{session.user.phone}</p>
        ) : null}
      </header>

      {/* Desktop: left sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-[#0f172a] text-slate-100 md:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">House of Vendors</p>
          <p className="mt-1 text-sm font-semibold">Admin</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Admin sections">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClass(isActive(item.href), false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3 text-xs text-slate-400">
          <p className="truncate font-medium text-slate-300">{session?.user?.phone}</p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-2 block w-full rounded-lg px-2 py-1.5 text-left text-slate-300 hover:bg-white/5 hover:text-white disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh data"}
          </button>
          <Link
            href="/"
            className="mt-1 block rounded-lg px-2 py-1.5 text-left text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Back to main site
          </Link>
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-slate-400 hover:bg-white/5 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 w-full flex-1 overflow-x-hidden bg-slate-50 p-4 pb-10 md:p-6 lg:p-10">{children}</main>
    </div>
  );
}
