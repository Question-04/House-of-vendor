"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetchJson } from "@/lib/admin-fetch";
import { adminBtnEmeraldOutline, adminPageLead, adminPageTitle, adminSelect } from "@/lib/admin-ui";

type Req = {
  id: number;
  vendorPhone: string;
  productName: string;
  status: string;
  createdAt: string;
  brand?: string;
  category?: string;
  notes?: string;
  adminNotes?: string;
};

const nextStatus = ["pending", "in_review", "approved", "rejected"] as const;

export default function AdminProductRequestsPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const res = await adminFetchJson<{ success: boolean; requests: Req[] }>("product-requests?limit=200&offset=0");
    setRows(res.requests || []);
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function updateStatus(id: number, status: string) {
    setMsg("");
    try {
      await adminFetchJson("product-requests/status", {
        method: "POST",
        body: JSON.stringify({ id, status, adminNotes: "" }),
      });
      setMsg("Updated.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  async function markCatalogAdded(id: number) {
    setMsg("");
    try {
      await adminFetchJson("product-requests/mark-catalog-added", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      setMsg("Vendor notified — product marked as added to catalog.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <h1 className={adminPageTitle}>Product requests</h1>
      <p className={adminPageLead}>Vendors can submit via POST /api/product-requests; you manage status here.</p>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="mt-4 text-sm text-emerald-700">{msg}</p> : null}
      <div className="mt-6 space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{r.productName}</p>
                <p className="font-mono text-xs text-slate-600">{r.vendorPhone}</p>
                <p className="text-xs text-slate-500">
                  {[r.brand, r.category].filter(Boolean).join(" · ") || "—"}
                </p>
                {r.notes ? <p className="mt-2 text-sm text-slate-700">{r.notes}</p> : null}
                <p className="mt-1 text-xs text-slate-400">{new Date(r.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-xs sm:items-stretch">
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">{r.status}</span>
                <button
                  type="button"
                  className={`${adminBtnEmeraldOutline} w-full text-center sm:w-auto`}
                  onClick={() => void markCatalogAdded(r.id)}
                >
                  Mark product added (notify vendor)
                </button>
                <select
                  aria-label="Set request status"
                  className={`${adminSelect} max-w-none`}
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    e.target.value = "";
                    if (v) void updateStatus(r.id, v);
                  }}
                >
                  <option value="">Set status…</option>
                  {nextStatus.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && !err ? <p className="text-sm text-slate-500">No requests yet.</p> : null}
      </div>
    </div>
  );
}
