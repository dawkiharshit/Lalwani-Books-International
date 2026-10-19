"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, ApiError } from "@/admin/lib/api";
import type { OrderDetail } from "@/admin/lib/types";
import { formatDate, money, STATUS_COLORS, STATUS_LABELS } from "@/admin/lib/format";
import { OrderCard } from "@/admin/components/OrderCard";
import { EyeIcon, InvoiceIcon } from "@/admin/components/icons";
import { Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";
import { AwbDialog } from "./awb-dialog";

interface Row {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  items_count: number;
  placed_at: string;
  customer: string;
  email: string;
  shiprocket_order_id: string | null;
  shiprocket_shipment_id: string | null;
  awb_code: string | null;
  courier_name: string | null;
  tracking_url: string | null;
}

const STATUSES = ["", "pending", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "refunded"];

export default function AdminOrders() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [shipBusy, setShipBusy] = useState<number | null>(null);
  const [shipError, setShipError] = useState("");
  const [error, setError] = useState("");
  const [shippingError, setShippingError] = useState("");
  const [shipping, setShipping] = useState({ enabled: false });
  // The order whose AWB number is being typed in.
  const [awbFor, setAwbFor] = useState<Row | null>(null);

  useEffect(() => {
    clientApi<{ data: { enabled: boolean } }>("/admin/shipping/status")
      .then((r) => {
        setShipping(r.data);
        setShippingError("");
      })
      .catch((err) => {
        /*
         * A failed probe is not the same as shipping being switched off, and
         * silently assuming "off" just hides the Shiprocket buttons.
         */
        setShippingError(
          err instanceof ApiError
            ? `Could not check the Shiprocket connection: ${err.message}`
            : "Could not check the Shiprocket connection. Its buttons are hidden; an AWB number can still be added by hand."
        );
      });
  }, []);

  // A brief confirmation, so a click that worked never looks like nothing happened.
  const [shipNotice, setShipNotice] = useState("");
  useEffect(() => {
    if (!shipNotice) return;
    const t = setTimeout(() => setShipNotice(""), 7000);
    return () => clearTimeout(t);
  }, [shipNotice]);

  /** Push to Shiprocket, then book a courier — two steps, one button each. */
  async function ship(row: Row, step: "push" | "awb") {
    setShipBusy(row.id);
    setShipError("");
    setShipNotice("");
    try {
      const res = await clientApi<{ message?: string }>(
        step === "push"
          ? `/admin/orders/${row.id}/shiprocket`
          : `/admin/orders/${row.id}/shiprocket/awb`,
        { method: "POST" }
      );
      setShipNotice(res.message ?? (step === "push" ? "Sent to Shiprocket." : "Courier assigned."));
      load();
    } catch (err) {
      /*
       * Shown as-is. This used to rewrite anything matching /billing|pickup/
       * into canned advice that named a pickup location ("work") the backend
       * never sends — so following it could not fix anything, and it buried
       * genuine billing errors under the wrong explanation. The server now
       * checks the Shiprocket account and says what is actually wrong.
       */
      setShipError(err instanceof Error ? err.message : "Shiprocket request failed.");
    } finally {
      setShipBusy(null);
    }
  }

  /*
   * The effect owns the fetch; anything that changes an order bumps `reloadAt`
   * to ask for a fresh list. That replaces a useCallback the React Compiler
   * could not memoise, and lets a reply be dropped when the filters move on
   * before it lands.
   */
  const [reloadAt, setReloadAt] = useState(0);
  const load = () => setReloadAt((n) => n + 1);

  useEffect(() => {
    const params = new URLSearchParams({
      ...(status ? { status } : {}),
      ...(search ? { search } : {}),
    });

    let cancelled = false;
    clientApi<{ data: Row[] }>(`/admin/orders?${params}`)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no orders.
         */
        if (cancelled) return;
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load orders: ${err.message}`
            : "Could not load orders. Check that the API is running."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [status, search, reloadAt]);

  /**
   * The endpoint always wants a status, so a payment-only change sends the
   * row's current status alongside it.
   */
  async function updateStatus(row: Row, patch: { status?: string; payment_status?: string }) {
    setBusyId(row.id);
    try {
      await clientApi(`/admin/orders/${row.id}/status`, {
        method: "PUT",
        body: { status: patch.status ?? row.status, ...patch },
      });
      load();
      if (selected?.id === row.id) setSelected(null);
    } finally {
      setBusyId(null);
    }
  }

  async function view(row: Row) {
    const res = await clientApi<{ data: OrderDetail }>(`/admin/orders/${row.id}`);
    setSelected(res.data);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-center gap-3 p-5">
        <h1 className="mr-auto font-serif text-[1.5rem] text-ink">Orders</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search number, email, name..."
          className="input-base max-w-60"
        />
        <Select
          value={status}
          onChange={setStatus}
          options={STATUSES.map((s) => ({
            value: s,
            label: s === "" ? "All statuses" : STATUS_LABELS[s],
          }))}
          ariaLabel="Filter by status"
          className="w-44"
          buttonClassName="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-blush-200 bg-white px-3 py-2 text-left text-[12.5px] text-cocoa outline-none"
        />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
      {shippingError && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{shippingError}</p>}

      <div className="card overflow-x-auto p-6">
        {!rows ? (
          <div className="flex items-center justify-center gap-2 py-16 text-fog">
            <Spinner className="h-5 w-5" /> Loading orders...
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-blush-100 text-[10.5px] uppercase tracking-wide text-fog">
                <th className="pb-2 pr-3">Order</th>
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Customer</th>
                <th className="pb-2 pr-3">Items</th>
                <th className="pb-2 pr-3">Payment</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Shipment</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush-50">
              {rows.map((row) => (
                <tr key={row.id} className="align-middle">
                  <td className="py-3 pr-3">
                    <button
                      onClick={() => view(row)}
                      className="block font-medium text-ink hover:text-rose-600"
                    >
                      {row.order_number}
                    </button>

                    {/* Both actions spelled out — the order number opened the
                        detail all along, but nothing said so. */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => view(row)}
                        className="inline-flex items-center gap-1 rounded-full border border-blush-200 px-2.5 py-1 text-[10.5px] font-medium text-cocoa transition-colors hover:border-rose-300 hover:bg-blush-50 hover:text-rose-600"
                      >
                        <EyeIcon className="h-3 w-3" />
                        View
                      </button>
                      <Link
                        href={`/admin/orders/${row.id}/invoice`}
                        className="inline-flex items-center gap-1 rounded-full border border-blush-200 px-2.5 py-1 text-[10.5px] font-medium text-cocoa transition-colors hover:border-rose-300 hover:bg-blush-50 hover:text-rose-600"
                      >
                        <InvoiceIcon className="h-3 w-3" />
                        Invoice
                      </Link>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-fog">{formatDate(row.placed_at)}</td>
                  <td className="py-3 pr-3">
                    <span className="block text-cocoa">{row.customer}</span>
                    <span className="text-[10.5px] text-fog">{row.email}</span>
                  </td>
                  <td className="py-3 pr-3 text-cocoa">{row.items_count}</td>
                  <td className="py-3 pr-3">
                    <Select
                      value={row.payment_status}
                      disabled={busyId === row.id}
                      onChange={(v) => updateStatus(row, { payment_status: v })}
                      options={PAYMENT_STATUSES.map((p) => ({ value: p, label: p }))}
                      ariaLabel="Payment status"
                      buttonClassName={`flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-full border-0 px-2.5 py-1 text-left text-[10.5px] font-semibold capitalize outline-none disabled:opacity-60 ${
                        row.payment_status === "paid"
                          ? "bg-green-100 text-green-700"
                          : row.payment_status === "refunded"
                            ? "bg-blush-150 text-maroon-800"
                            : "bg-blush-100 text-cocoa"
                      }`}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Select
                      value={row.status}
                      disabled={busyId === row.id}
                      onChange={(v) => updateStatus(row, { status: v })}
                      options={STATUSES.slice(1).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                      ariaLabel="Order status"
                      buttonClassName={`flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-full border-0 px-2.5 py-1 text-left text-[10.5px] font-semibold outline-none disabled:opacity-60 ${STATUS_COLORS[row.status] ?? "bg-blush-100"}`}
                    />
                  </td>
                  {/* One way per order: Shiprocket (send, then assign a courier)
                      or the AWB number typed in by hand. Until one is chosen
                      both are offered; after that only the chosen one shows. */}
                  <td className="py-3 pr-3">
                    {row.awb_code ? (
                      <span className="block">
                        {row.courier_name && <span className="block text-[11px] text-ink">{row.courier_name}</span>}
                        <a
                          href={row.tracking_url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10.5px] text-rose-600 hover:underline"
                        >
                          {row.awb_code}
                        </a>
                        {/* A number typed in by hand can be corrected (and emailed again). */}
                        {!row.shiprocket_order_id && row.status !== "cancelled" && (
                          <button
                            onClick={() => setAwbFor(row)}
                            aria-label={`Change the AWB number of ${row.order_number}`}
                            className="ml-2 text-[10.5px] text-fog underline-offset-2 hover:text-rose-600 hover:underline"
                          >
                            Change
                          </button>
                        )}
                      </span>
                    ) : row.status === "cancelled" ? (
                      <span className="text-[11px] text-fog">—</span>
                    ) : row.shiprocket_order_id ? (
                      shipping.enabled && row.shiprocket_shipment_id ? (
                        <button
                          onClick={() => ship(row, "awb")}
                          disabled={shipBusy === row.id}
                          className="rounded-full bg-maroon-800 px-3 py-1 text-[11px] text-white hover:bg-maroon-900 disabled:opacity-60"
                        >
                          {shipBusy === row.id ? "…" : "Assign courier"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-fog">With Shiprocket</span>
                      )
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {shipping.enabled && (
                          <button
                            onClick={() => ship(row, "push")}
                            disabled={shipBusy === row.id}
                            className="whitespace-nowrap rounded-full border border-blush-200 px-3 py-1 text-[11px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
                          >
                            {shipBusy === row.id ? "…" : "Send to Shiprocket"}
                          </button>
                        )}
                        <button
                          onClick={() => setAwbFor(row)}
                          className="whitespace-nowrap rounded-full border border-blush-200 px-3 py-1 text-[11px] text-cocoa hover:bg-blush-100"
                        >
                          + Add AWB
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-right font-medium text-ink">{money(row.total)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-fog">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {shipNotice && (
        <div
          role="status"
          className="fixed inset-x-0 top-4 z-[60] mx-auto flex max-w-lg items-start gap-3 rounded-xl bg-green-600 px-4 py-3 text-[13px] leading-relaxed text-white shadow-lift"
        >
          <span className="flex-1">{shipNotice}</span>
          <button
            onClick={() => setShipNotice("")}
            className="shrink-0 rounded px-1.5 text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {shipError && (
        <div className="fixed inset-x-0 top-4 z-[60] mx-auto flex max-w-lg items-start gap-3 rounded-xl bg-red-600 px-4 py-3 text-[13px] leading-relaxed text-white shadow-lift">
          <span className="flex-1">{shipError}</span>
          <button
            onClick={() => setShipError("")}
            className="shrink-0 rounded px-1.5 text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {awbFor && (
        <AwbDialog
          order={awbFor}
          onClose={() => setAwbFor(null)}
          onSaved={(message) => {
            setAwbFor(null);
            setShipNotice(message);
            load();
          }}
        />
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-maroon-900/50 p-6 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <OrderCard order={selected} />

            {/* The invoice belongs here too — this is where an admin looks
                when a customer asks for one. */}
            <div className="mt-4 flex items-center justify-center gap-3">
              <Link
                href={`/admin/orders/${selected.id}/invoice`}
                className="flex items-center gap-2 rounded-full bg-maroon-800 px-6 py-2.5 text-[12.5px] text-white transition-colors hover:bg-maroon-900"
              >
                <InvoiceIcon className="h-3.5 w-3.5" />
                View invoice
              </Link>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full bg-white px-6 py-2.5 text-[12.5px] text-cocoa shadow-soft"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
