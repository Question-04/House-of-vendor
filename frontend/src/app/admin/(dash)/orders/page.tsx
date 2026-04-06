"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetchJson } from "@/lib/admin-fetch";
import {
  adminBtnDangerSoft,
  adminBtnNeutralBorder,
  adminBtnPrimary,
  adminBtnSuccess,
  adminBtnWarning,
  adminPageLead,
  adminPageTitle,
  adminSelect,
} from "@/lib/admin-ui";

type Order = {
  id: number;
  vendorPhone: string;
  externalOrderId: string;
  status: string;
  verificationStatus?: string | null;
  productName?: string | null;
  payoutCents?: number | null;
  payoutReleasedAt?: string | null;
  payoutReleasedBy?: string | null;
  createdAt: string;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(0);

  const load = useCallback(async () => {
    setErr("");
    const q = statusFilter ? `?limit=150&status=${encodeURIComponent(statusFilter)}` : "?limit=150";
    const res = await adminFetchJson<{ success: boolean; orders: Order[] }>(`orders${q}`);
    setOrders(res.orders || []);
  }, [statusFilter]);

  useEffect(() => {
    void load().catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, [load]);

  async function setVerification(orderId: number, vendorPhone: string, verificationStatus: string) {
    setBusy(orderId);
    setMsg("");
    try {
      await adminFetchJson("orders/set-verification", {
        method: "POST",
        body: JSON.stringify({ orderId, vendorPhone, verificationStatus }),
      });
      setMsg("Verification updated.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(0);
    }
  }

  async function markPayment(orderId: number, vendorPhone: string) {
    setBusy(orderId);
    setMsg("");
    try {
      await adminFetchJson("orders/mark-payment-done", {
        method: "POST",
        body: JSON.stringify({ orderId, vendorPhone }),
      });
      setMsg("Marked paid.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(0);
    }
  }

  async function releasePayout(orderId: number) {
    setBusy(orderId);
    setMsg("");
    try {
      await adminFetchJson("orders/release-payout", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });
      setMsg("Payout released (logged).");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(0);
    }
  }

  async function cancelOrder(orderId: number) {
    if (!window.confirm("Cancel / reject this order?")) return;
    setBusy(orderId);
    setMsg("");
    try {
      await adminFetchJson("orders/cancel", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });
      setMsg("Order cancelled.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(0);
    }
  }

  return (
    <div>
      <h1 className={adminPageTitle}>Orders</h1>
      <p className={adminPageLead}>All vendor orders — verification, payment, payout release, cancel.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:flex-row sm:items-center">
          <span>Status filter</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${adminSelect} ml-0 max-w-none sm:ml-2 sm:max-w-xs`}
          >
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="waiting_pickup">waiting_pickup</option>
            <option value="in_transit">in_transit</option>
            <option value="verification">verification</option>
            <option value="payment_pending">payment_pending</option>
            <option value="completed">completed</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
      </div>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="mt-4 text-sm text-emerald-700">{msg}</p> : null}
      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[920px] w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">External</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Verify</th>
              <th className="px-3 py-2">Payout</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                <td className="px-3 py-2 font-mono text-xs">{o.vendorPhone}</td>
                <td className="max-w-[140px] truncate px-3 py-2 text-xs">{o.externalOrderId}</td>
                <td className="max-w-[120px] truncate px-3 py-2 text-xs">{o.productName || "—"}</td>
                <td className="px-3 py-2 text-xs">{o.status}</td>
                <td className="px-3 py-2 text-xs">{o.verificationStatus || "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {o.payoutReleasedAt ? (
                    <span className="text-emerald-700">Released</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex max-w-[320px] flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === o.id}
                      onClick={() => void setVerification(o.id, o.vendorPhone, "real_and_authentic")}
                      className={adminBtnPrimary}
                    >
                      Verify OK
                    </button>
                    <button
                      type="button"
                      disabled={busy === o.id}
                      onClick={() => void setVerification(o.id, o.vendorPhone, "needs_docs")}
                      className={adminBtnWarning}
                    >
                      Needs docs
                    </button>
                    <button
                      type="button"
                      disabled={busy === o.id}
                      onClick={() => void markPayment(o.id, o.vendorPhone)}
                      className={adminBtnSuccess}
                    >
                      Paid
                    </button>
                    <button
                      type="button"
                      disabled={busy === o.id}
                      onClick={() => void releasePayout(o.id)}
                      className={adminBtnNeutralBorder}
                    >
                      Release payout
                    </button>
                    <button
                      type="button"
                      disabled={busy === o.id}
                      onClick={() => void cancelOrder(o.id)}
                      className={adminBtnDangerSoft}
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && !err ? <p className="p-6 text-sm text-slate-500">No orders.</p> : null}
      </div>
    </div>
  );
}
