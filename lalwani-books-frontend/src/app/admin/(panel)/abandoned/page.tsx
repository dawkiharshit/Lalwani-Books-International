"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi, ApiError } from "@/admin/lib/api";
import { money } from "@/admin/lib/format";
import { Spinner } from "@/admin/components/ui";

interface SnapshotItem {
  name: string;
  quantity: number;
  price: number;
}

interface AbandonedCheckout {
  id: number;
  email: string | null;
  ship_name: string | null;
  ship_phone: string | null;
  ship_address1: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_zip: string | null;
  cart_snapshot: { items: SnapshotItem[]; count: number } | null;
  subtotal: number;
  user_id: number | null;
  updated_at: string;
}

/** dd Mon, h:mm am — enough to see how fresh a lead is. */
function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** wa.me needs digits with country code; assume India for a bare 10-digit number. */
function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const num = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${num}`;
}

export default function AdminAbandoned() {
  const [rows, setRows] = useState<AbandonedCheckout[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    clientApi<{ data: AbandonedCheckout[] }>("/admin/abandoned-checkouts")
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no abandoned checkouts.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load abandoned checkouts: ${err.message}`
            : "Could not load abandoned checkouts. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(c: AbandonedCheckout) {
    if (!confirm(`Remove this abandoned checkout${c.ship_name ? ` for ${c.ship_name}` : ""}?`)) return;
    await clientApi(`/admin/abandoned-checkouts/${c.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h1 className="font-serif text-[1.5rem] text-ink">Abandoned Carts</h1>
        <p className="mt-0.5 text-[12px] text-fog">
          Shoppers who entered their details at checkout but didn&apos;t place the order. A row
          disappears on its own once that person completes an order.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <div className="card overflow-x-auto p-6">
        {!rows ? (
          <div className="flex items-center justify-center gap-2 py-16 text-fog">
            <Spinner className="h-5 w-5" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-14 text-center text-[13px] text-fog">
            No abandoned checkouts right now. 🎉
          </p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-blush-100 text-[10.5px] uppercase tracking-wide text-fog">
                <th className="pb-2 pr-3">Customer</th>
                <th className="pb-2 pr-3">Location</th>
                <th className="pb-2 pr-3">Cart</th>
                <th className="pb-2 pr-3">Last active</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush-50">
              {rows.map((c) => {
                const items = c.cart_snapshot?.items ?? [];
                const itemNames = items.map((i) => `${i.name} × ${i.quantity}`).join(", ");
                const location = [c.ship_city, c.ship_state].filter(Boolean).join(", ");
                return (
                  <tr key={c.id} className="align-top">
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-ink">
                        {c.ship_name || "—"}
                        {c.user_id && (
                          <span className="ml-2 rounded-full bg-blush-100 px-1.5 py-0.5 text-[9px] font-medium text-fog">
                            Account
                          </span>
                        )}
                      </p>
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="block text-rose-600 hover:underline">
                          {c.email}
                        </a>
                      )}
                      {c.ship_phone && (
                        <a
                          href={whatsappHref(c.ship_phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-cocoa hover:text-rose-600 hover:underline"
                          title="Message on WhatsApp"
                        >
                          {c.ship_phone}
                        </a>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-cocoa">{location || "—"}</td>
                    <td className="py-3 pr-3 text-cocoa">
                      {items.length > 0 ? (
                        <span title={itemNames}>
                          <span className="font-medium text-ink">{money(c.subtotal)}</span>
                          <span className="text-fog">
                            {" · "}
                            {c.cart_snapshot?.count ?? items.length} item
                            {(c.cart_snapshot?.count ?? items.length) === 1 ? "" : "s"}
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-cocoa">{when(c.updated_at)}</td>
                    <td className="py-3 text-right">
                      <button onClick={() => remove(c)} className="text-fog hover:text-red-500">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
