"use client";

import { useEffect, useState } from "react";
import { adminFetchJson } from "@/lib/admin-fetch";
import { adminPageLead, adminPageTitle } from "@/lib/admin-ui";

type Row = {
  id: number;
  phone: string;
  createdAt: string;
  fullName?: string | null;
  email?: string | null;
  profileStatus?: string | null;
  verificationStepStatus?: string | null;
  adminKycDecision?: string | null;
  vouchStepStatus?: string | null;
  vouchReviewStatus?: string | null;
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminFetchJson<{ success: boolean; users: Row[] }>("users?limit=100&offset=0");
        setRows(res.users || []);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  return (
    <div>
      <h1 className={adminPageTitle}>Users</h1>
      <p className={adminPageLead}>Vendor accounts and onboarding snapshot.</p>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[720px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 sm:px-4">Phone</th>
              <th className="px-3 py-3 sm:px-4">Name</th>
              <th className="px-3 py-3 sm:px-4">Email</th>
              <th className="px-3 py-3 sm:px-4">Profile</th>
              <th className="px-3 py-3 sm:px-4">Verification</th>
              <th className="px-3 py-3 sm:px-4">KYC</th>
              <th className="px-3 py-3 sm:px-4">Vouch</th>
              <th className="px-3 py-3 sm:px-4">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-3 font-mono text-xs sm:px-4">{r.phone}</td>
                <td className="px-3 py-3 sm:px-4">{r.fullName || "—"}</td>
                <td className="px-3 py-3 sm:px-4">{r.email || "—"}</td>
                <td className="px-3 py-3 sm:px-4">{r.profileStatus || "—"}</td>
                <td className="px-3 py-3 sm:px-4">{r.verificationStepStatus || "—"}</td>
                <td className="px-3 py-3 sm:px-4">{r.adminKycDecision || "—"}</td>
                <td className="px-3 py-3 sm:px-4">{r.vouchStepStatus || "—"}</td>
                <td className="px-3 py-3 sm:px-4">{r.vouchReviewStatus || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !err ? <p className="p-6 text-sm text-slate-500">No users yet.</p> : null}
      </div>
    </div>
  );
}
