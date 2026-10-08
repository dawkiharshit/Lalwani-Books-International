"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, ApiError } from "@/admin/lib/api";
import { money, formatDate } from "@/admin/lib/format";
import { Spinner } from "@/admin/components/ui";

interface Coupon {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  is_public: boolean;
}

export default function AdminCoupons() {
  const [rows, setRows] = useState<Coupon[] | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    clientApi<{ data: Coupon[] }>("/admin/coupons")
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no coupons.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load coupons: ${err.message}`
            : "Could not load coupons. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Every write re-sends the whole coupon; the admin PUT validates all fields.
  async function save(c: Coupon, changes: Partial<Coupon>) {
    setSavingId(c.id);
    try {
      await clientApi(`/admin/coupons/${c.id}`, {
        method: "PUT",
        body: {
          code: c.code,
          type: c.type,
          value: c.value,
          min_order: c.min_order,
          max_uses: c.max_uses,
          expires_at: c.expires_at,
          is_active: c.is_active,
          is_public: c.is_public,
          ...changes,
        },
      });
      load();
    } finally {
      setSavingId(null);
    }
  }

  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    await clientApi(`/admin/coupons/${c.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-center gap-3 p-5">
        <div className="mr-auto">
          <h1 className="font-serif text-[1.5rem] text-ink">Coupons</h1>
          <p className="mt-0.5 text-[12px] text-fog">
            Toggle <span className="font-medium text-emerald-700">Shown</span> to advertise a
            coupon on the checkout page. Hidden coupons still work when typed.
          </p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="rounded-full bg-rose-600 px-5 py-2 text-[12.5px] text-white hover:bg-rose-700"
        >
          + New Coupon
        </Link>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <div className="card overflow-x-auto p-6">
        {!rows ? (
          <div className="flex items-center justify-center gap-2 py-16 text-fog">
            <Spinner className="h-5 w-5" /> Loading coupons...
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-blush-100 text-[10.5px] uppercase tracking-wide text-fog">
                <th className="pb-2 pr-3">Code</th>
                <th className="pb-2 pr-3">Discount</th>
                <th className="pb-2 pr-3">Min Order</th>
                <th className="pb-2 pr-3">Usage</th>
                <th className="pb-2 pr-3">Expires</th>
                <th className="pb-2 pr-3">On Checkout</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush-50">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 pr-3 font-semibold text-ink">{c.code}</td>
                  <td className="py-3 pr-3 text-cocoa">
                    {c.type === "percent" ? `${c.value}%` : money(c.value)}
                  </td>
                  <td className="py-3 pr-3 text-cocoa">{c.min_order > 0 ? money(c.min_order) : "—"}</td>
                  <td className="py-3 pr-3 text-cocoa">
                    {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}
                  </td>
                  <td className="py-3 pr-3 text-cocoa">{c.expires_at ? formatDate(c.expires_at) : "Never"}</td>
                  <td className="py-3 pr-3">
                    {/* One-tap control over which coupons shoppers actually see. */}
                    <button
                      onClick={() => save(c, { is_public: !c.is_public })}
                      disabled={savingId === c.id}
                      title={c.is_public ? "Shown to customers — click to hide" : "Hidden — click to show on checkout"}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                        c.is_public
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-blush-100 text-fog hover:bg-blush-150"
                      }`}
                    >
                      {c.is_public ? "Shown" : "Hidden"}
                    </button>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-blush-100 text-fog"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => save(c, { is_active: !c.is_active })}
                      disabled={savingId === c.id}
                      className="mr-3 text-rose-600 hover:underline disabled:opacity-50"
                    >
                      {c.is_active ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => remove(c)} className="text-fog hover:text-red-500">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-fog">No coupons yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
