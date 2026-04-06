"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetchJson } from "@/lib/admin-fetch";
import {
  adminBtnOutline,
  adminBtnSuccessStrong,
  adminBtnWarning,
  adminBtnDanger,
  adminPageLead,
  adminPageTitle,
} from "@/lib/admin-ui";

type Item = {
  phone: string;
  vendorUserId: number;
  stepStatus: string;
  submittedAt?: string | null;
  aadhaarFileName: string;
  panFileName: string;
  aadhaarDocCount?: number;
  panDocCount?: number;
};

export default function AdminVerificationPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const res = await adminFetchJson<{ success: boolean; items: Item[] }>("verification/queue");
    setItems(res.items || []);
  }, []);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function presign(phone: string, docType: "aadhaar" | "pan", index: number) {
    setBusy(`${phone}-${docType}-${index}`);
    setMsg("");
    try {
      const res = await adminFetchJson<{ success: boolean; url?: string; message?: string }>("presign", {
        method: "POST",
        body: JSON.stringify({ phone, docType, index }),
      });
      if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else setMsg(res.message || "No URL");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Presign failed");
    } finally {
      setBusy("");
    }
  }

  async function review(phone: string, decision: "approved" | "rejected" | "needs_resubmit") {
    setBusy(phone);
    setMsg("");
    try {
      await adminFetchJson("verification/review", {
        method: "POST",
        body: JSON.stringify({ phone, decision, notes: "" }),
      });
      setMsg("Saved.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h1 className={adminPageTitle}>Verification queue</h1>
      <p className={adminPageLead}>Submitted KYC awaiting admin decision (presigned R2 links).</p>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="mt-4 text-sm text-emerald-700">{msg}</p> : null}
      <div className="mt-6 space-y-4">
        {items.map((it) => (
          <div key={it.phone} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{it.phone}</p>
                <p className="text-xs text-slate-500">
                  Submitted: {it.submittedAt ? new Date(it.submittedAt).toLocaleString() : "—"} · Aadhaar files:{" "}
                  {it.aadhaarDocCount ?? (it.aadhaarFileName ? 1 : 0)} · PAN files: {it.panDocCount ?? (it.panFileName ? 1 : 0)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.max(1, it.aadhaarDocCount ?? (it.aadhaarFileName ? 1 : 0)) }, (_, i) => (
                  <button
                    key={`aadhaar-${i}`}
                    type="button"
                    disabled={!!busy}
                    onClick={() => void presign(it.phone, "aadhaar", i)}
                    className={adminBtnOutline}
                  >
                    {busy === `${it.phone}-aadhaar-${i}` ? "…" : it.aadhaarDocCount && it.aadhaarDocCount > 1 ? `Aadhaar ${i + 1}` : "View Aadhaar"}
                  </button>
                ))}
                {Array.from({ length: Math.max(1, it.panDocCount ?? (it.panFileName ? 1 : 0)) }, (_, i) => (
                  <button
                    key={`pan-${i}`}
                    type="button"
                    disabled={!!busy}
                    onClick={() => void presign(it.phone, "pan", i)}
                    className={adminBtnOutline}
                  >
                    {busy === `${it.phone}-pan-${i}` ? "…" : it.panDocCount && it.panDocCount > 1 ? `PAN ${i + 1}` : "View PAN"}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void review(it.phone, "approved")}
                  className={adminBtnSuccessStrong}
                >
                  Approve KYC
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void review(it.phone, "needs_resubmit")}
                  className={adminBtnWarning}
                >
                  Needs resubmit
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void review(it.phone, "rejected")}
                  className={adminBtnDanger}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && !err ? <p className="text-sm text-slate-500">Queue is empty.</p> : null}
      </div>
    </div>
  );
}
