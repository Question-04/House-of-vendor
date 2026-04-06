"use client";

import { useEffect, useState } from "react";
import { adminFetchJson } from "@/lib/admin-fetch";
import { adminPageLead, adminPageTitle } from "@/lib/admin-ui";

type Stats = {
  vendorUsers: number;
  pendingKycReviews: number;
  pendingVouchReviews: number;
  openTickets: number;
  pendingProductRequests: number;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminFetchJson<{ success: boolean; stats: Stats }>("stats");
        setStats(res.stats);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  const cards = stats
    ? [
        { label: "Vendor users", value: stats.vendorUsers },
        { label: "KYC queue", value: stats.pendingKycReviews },
        { label: "Vouch review queue", value: stats.pendingVouchReviews },
        { label: "Open tickets", value: stats.openTickets },
        { label: "Product requests", value: stats.pendingProductRequests },
      ]
    : [];

  return (
    <div>
      <h1 className={adminPageTitle}>Overview</h1>
      <p className={adminPageLead}>Operational snapshot for House of Vendors.</p>
      {err ? <p className="mt-6 text-sm text-red-600">{err}</p> : null}
      {!stats && !err ? <p className="mt-8 text-sm text-slate-500">Loading…</p> : null}
      {stats ? (
        <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">{c.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
