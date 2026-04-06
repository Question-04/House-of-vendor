"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetchJson } from "@/lib/admin-fetch";
import { adminPageLead, adminPageTitle, adminSelect } from "@/lib/admin-ui";

type Ticket = {
  id: number;
  vendorPhone: string;
  ticketCode: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
};

const statuses = ["Open", "In Progress", "Resolved", "Closed"];

export default function AdminTicketsPage() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const res = await adminFetchJson<{ success: boolean; tickets: Ticket[] }>("tickets?limit=200&offset=0");
    setRows(res.tickets || []);
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function setStatus(id: number, status: string) {
    setMsg("");
    try {
      await adminFetchJson("tickets/status", {
        method: "POST",
        body: JSON.stringify({ ticketId: id, status }),
      });
      setMsg("Updated.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <h1 className={adminPageTitle}>Tickets</h1>
      <p className={adminPageLead}>Support tickets from all vendors.</p>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="mt-4 text-sm text-emerald-700">{msg}</p> : null}
      <div className="mt-6 space-y-3">
        {rows.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-500">{t.ticketCode}</p>
                <p className="font-semibold text-slate-900">{t.subject}</p>
                <p className="text-xs text-slate-600">
                  {t.vendorPhone} · {t.category} · {t.priority}
                </p>
                <p className="mt-1 text-xs text-slate-400">{new Date(t.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">{t.status}</span>
                <select
                  aria-label="Set ticket status"
                  className={`${adminSelect} w-full max-w-none sm:w-auto sm:max-w-xs`}
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    e.target.value = "";
                    if (v) void setStatus(t.id, v);
                  }}
                >
                  <option value="">Set status…</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && !err ? <p className="text-sm text-slate-500">No tickets.</p> : null}
      </div>
    </div>
  );
}
