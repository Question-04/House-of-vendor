"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetchJson } from "@/lib/admin-fetch";
import {
  adminBtnAmberOutline,
  adminBtnDanger,
  adminBtnOutline,
  adminBtnSuccessStrong,
  adminPageLead,
  adminPageTitle,
} from "@/lib/admin-ui";

type Item = {
  phone: string;
  vendorUserId: number;
  vouchCount: number;
  vendorName: string;
  reviewStatus: string;
  stepStatus: string;
};

type Entry = {
  id: number;
  voucherName: string;
  voucherBrandName: string;
  voucherEmail: string;
  voucherPhone: string;
  source: string;
  createdAt: string;
};

export default function AdminVouchPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const res = await adminFetchJson<{ success: boolean; items: Item[] }>("vouch/queue");
    setItems(res.items || []);
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function loadEntries(phone: string) {
    setSelectedPhone(phone);
    setEntries([]);
    const res = await adminFetchJson<{ success: boolean; entries: Entry[] }>(
      `vouch/entries?phone=${encodeURIComponent(phone)}`
    );
    setEntries(res.entries || []);
  }

  async function review(phone: string, decision: "approve" | "disapprove" | "needs_resubmit") {
    setBusy(phone);
    setMsg("");
    try {
      await adminFetchJson("vouch/review", {
        method: "POST",
        body: JSON.stringify({ phone, decision }),
      });
      setMsg(decision === "needs_resubmit" ? "Marked for KYC resubmission." : "Review saved.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  async function skipCooldown(phone: string) {
    setBusy(`cd-${phone}`);
    setMsg("");
    try {
      await adminFetchJson("vouch/skip-cooldown", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      setMsg("Cooldown cleared.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h1 className={adminPageTitle}>Vouch queue</h1>
      <p className={adminPageLead}>Vendors at 30 vouches pending team review (replaces dev-only /api/dev/vouch/review).</p>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="mt-4 text-sm text-emerald-700">{msg}</p> : null}
      <div className="mt-6 space-y-4">
        {items.map((it) => (
          <div key={it.phone} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{it.phone}</p>
                <p className="text-sm text-slate-700">{it.vendorName || "—"}</p>
                <p className="text-xs text-slate-500">
                  Vouches: {it.vouchCount} · Step: {it.stepStatus} · Review: {it.reviewStatus}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void loadEntries(it.phone)}
                  className={adminBtnOutline}
                >
                  Entries
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void review(it.phone, "approve")}
                  className={adminBtnSuccessStrong}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void review(it.phone, "disapprove")}
                  className={adminBtnDanger}
                >
                  Disapprove
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void review(it.phone, "needs_resubmit")}
                  className={adminBtnAmberOutline}
                >
                  Need resubmission
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void skipCooldown(it.phone)}
                  className={adminBtnAmberOutline}
                >
                  {busy === `cd-${it.phone}` ? "…" : "Skip cooldown"}
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && !err ? <p className="text-sm text-slate-500">No vendors awaiting vouch review.</p> : null}
      </div>

      {selectedPhone ? (
        <div className="mt-10">
          <h2 className="text-lg font-semibold">Vouch entries — {selectedPhone}</h2>
          <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            {entries.map((e) => (
              <li key={e.id} className="border-b border-slate-200 pb-2 last:border-0">
                <span className="font-medium">{e.voucherName}</span> · {e.voucherBrandName} · {e.voucherPhone} ·{" "}
                <span className="text-slate-500">{e.source}</span>
              </li>
            ))}
            {entries.length === 0 ? <li className="text-slate-500">No entries.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
