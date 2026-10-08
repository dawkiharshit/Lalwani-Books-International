"use client";

import { useState } from "react";
import { apiUpload, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { OrderDetail, OrderReturn } from "@/lib/types";
import { Spinner } from "@/components/ui";
import { Select } from "@/components/Select";

const REASONS = [
  "Damaged / broken",
  "Wrong item received",
  "Not as described",
  "Missing parts / accessories",
  "Changed my mind",
];

const STATUS: Record<OrderReturn["status"], { label: string; cls: string }> = {
  requested: { label: "Requested · under review", cls: "bg-gold/15 text-gold" },
  approved: { label: "Approved · pickup arranged", cls: "bg-blush-150 text-maroon-700" },
  rejected: { label: "Declined", cls: "bg-red-100 text-red-600" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
};

/**
 * Where a refund lands, worded for how the order was paid. An online payment
 * is reversed to the card or UPI it came from; a COD order has nothing to
 * reverse, so it is paid to the UPI ID or bank account the customer gave —
 * shown in part, as the refund email does.
 */
function refundDestination(order: OrderDetail, ret: OrderReturn): string {
  if (order.payment_method !== "cod") return "your original payment method";
  if (ret.refund_upi) {
    const [user, host = ""] = ret.refund_upi.split("@");
    return `your UPI ID ${user.slice(0, 2)}${"•".repeat(Math.max(user.length - 2, 2))}${host ? `@${host}` : ""}`;
  }
  const account = ret.refund_bank?.account_number;
  if (account) return `your ${ret.refund_bank?.bank_name || "bank"} account ending ${account.slice(-4)}`;
  return "the UPI ID or bank account you gave us";
}

/**
 * On a delivered order this shows the existing return's status, or — while the
 * order is still returnable — the "Return / Replace" request form (item picker,
 * reason, refund-or-replacement, photos).
 *
 * Pass `email` for the guest flow (the order-tracking page): the request is
 * verified by that email instead of a signed-in token.
 */
export function ReturnSection({ order, email }: { order: OrderDetail; email?: string }) {
  const [current, setCurrent] = useState<OrderReturn | null>(order.return ?? null);
  const [open, setOpen] = useState(false);

  const [type, setType] = useState<"refund" | "replacement">("refund");
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [refundMethod, setRefundMethod] = useState<"upi" | "bank">("upi");
  const [upi, setUpi] = useState("");
  const [bank, setBank] = useState({ account_name: "", account_number: "", ifsc: "", bank_name: "" });
  // A COD refund has no online payment to reverse, so we collect a payout target.
  const codRefund = type === "refund" && order.payment_method === "cod";
  const [chosen, setChosen] = useState<Set<number>>(() => new Set(order.items.map((it) => it.id)));
  const [qty, setQty] = useState<Record<number, number>>(() =>
    Object.fromEntries(order.items.map((it) => [it.id, it.quantity]))
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: number) {
    setChosen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const items = order.items
      .filter((it) => chosen.has(it.id))
      .map((it) => ({ name: it.name, quantity: qty[it.id] ?? it.quantity, product_id: it.product?.id ?? null }));
    if (items.length === 0) {
      setError("Choose at least one item to return.");
      return;
    }
    if (codRefund) {
      if (refundMethod === "upi" && !upi.trim()) {
        setError("Enter your UPI ID for the refund.");
        return;
      }
      if (
        refundMethod === "bank" &&
        (!bank.account_name.trim() || !bank.account_number.trim() || !bank.ifsc.trim() || !bank.bank_name.trim())
      ) {
        setError("Fill in all bank details — name, account number, IFSC and bank.");
        return;
      }
    }
    setBusy(true);
    try {
      const fd = new FormData();
      // Guest flow: the order email verifies ownership (no signed-in token).
      if (email) fd.append("email", email);
      fd.append("type", type);
      fd.append("reason", reason);
      if (note) fd.append("note", note);
      if (codRefund) {
        fd.append("refund_method", refundMethod);
        if (refundMethod === "upi") {
          fd.append("refund_upi", upi.trim());
        } else {
          fd.append("refund_account_name", bank.account_name.trim());
          fd.append("refund_account_number", bank.account_number.trim());
          fd.append("refund_ifsc", bank.ifsc.trim());
          fd.append("refund_bank_name", bank.bank_name.trim());
        }
      }
      fd.append("items", JSON.stringify(items));
      photos.slice(0, 5).forEach((f) => fd.append("photos[]", f));

      const res = await apiUpload<{ data: OrderReturn }>(`/orders/${order.order_number}/return`, fd);
      setCurrent(res.data);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }

  // ---- An existing return: show its status ----
  if (current) {
    const s = STATUS[current.status];
    return (
      <section className="card p-6" aria-label="Return status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-fog">Return / Replacement</p>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
        </div>
        <p className="mt-3 text-[12.5px] text-cocoa">
          <span className="font-medium capitalize text-ink">{current.type}</span> · {current.reason}
        </p>
        {current.note && <p className="mt-1 text-[12px] italic text-fog">&ldquo;{current.note}&rdquo;</p>}
        {current.admin_note && (
          <p className="mt-2 rounded-xl bg-blush-50 px-3 py-2 text-[11.5px] leading-relaxed text-cocoa">
            {current.admin_note}
          </p>
        )}
        {current.tracking_url && (
          <a
            href={current.tracking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[12px] text-rose-600 hover:underline"
          >
            Track the pickup →
          </a>
        )}
        {/* Every refund says where it goes and by when: the card or UPI an
            online order was paid with, or the payout account a COD order gave. */}
        {current.type === "refund" && (current.status === "requested" || current.status === "approved") && (
          <p className="mt-2 text-[11.5px] text-fog">
            Once the item is back with us and checked, your refund goes to {refundDestination(order, current)}{" "}
            and should reach it within {order.refund_days ?? 7} working days.
          </p>
        )}
        {current.status === "completed" && current.type === "refund" && current.refund_amount ? (
          <div className="mt-2">
            <p className="text-[12px] font-medium text-emerald-700">
              Refund of {money(current.refund_amount)} processed.
            </p>
            <p className="mt-0.5 text-[11.5px] text-fog">
              It should reach {refundDestination(order, current)} within {order.refund_days ?? 7} working days.
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  // ---- Not returnable and no return: draw nothing ----
  if (!order.returnable) return null;

  // ---- The request form ----
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full border border-blush-200 px-6 py-2.5 text-[13px] text-cocoa transition-colors hover:bg-blush-100"
      >
        Return / Replace
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[1.2rem] text-ink">Return or Replace</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-fog underline hover:text-rose-600">
          Cancel
        </button>
      </div>
      <p className="-mt-2 text-[11.5px] text-fog">
        Within {order.return_window_days ?? 7} days of delivery. Add photos if something arrived damaged.
      </p>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-cocoa">Which item(s)?</p>
        <div className="flex flex-col gap-2">
          {order.items.map((it) => (
            <label key={it.id} className="flex items-center gap-2.5 text-[12.5px]">
              <input
                type="checkbox"
                checked={chosen.has(it.id)}
                onChange={() => toggle(it.id)}
                className="h-4 w-4 accent-rose-600"
              />
              <span className="flex-1 text-ink">{it.name}</span>
              {chosen.has(it.id) && it.quantity > 1 && (
                <Select
                  value={String(qty[it.id] ?? it.quantity)}
                  onChange={(v) => setQty((p) => ({ ...p, [it.id]: Number(v) }))}
                  options={Array.from({ length: it.quantity }, (_, i) => ({
                    value: String(i + 1),
                    label: String(i + 1),
                  }))}
                  ariaLabel={`Quantity of ${it.name} to return`}
                  className="w-16"
                  buttonClassName="input-base flex cursor-pointer items-center justify-between gap-1 py-1 text-[12px]"
                />
              )}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-cocoa">What would you like?</p>
        <div className="flex gap-2">
          {(["refund", "replacement"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 rounded-xl border-2 px-4 py-2 text-[12.5px] transition-colors ${
                type === t ? "border-rose-500 bg-blush-50 text-ink" : "border-blush-150 text-cocoa hover:border-blush-300"
              }`}
            >
              {t === "refund" ? "Refund" : "Replacement"}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-cocoa">Reason</span>
        <Select
          value={reason}
          onChange={setReason}
          options={REASONS.map((r) => ({ value: r, label: r }))}
          ariaLabel="Reason for return"
          variant="field"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-cocoa">Details (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="input-base resize-none"
          placeholder="Tell us what went wrong…"
        />
      </label>

      {codRefund && (
        <div className="flex flex-col gap-3 rounded-xl bg-blush-50 p-3">
          <div>
            <span className="text-[11px] font-medium text-cocoa">
              How should we send your refund? <span className="text-rose-500">*</span>
            </span>
            <p className="mt-0.5 text-[10.5px] text-fog">
              This was Cash-on-Delivery — no card to refund, so tell us where to send the money.
            </p>
          </div>

          <div className="flex gap-2">
            {(["upi", "bank"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setRefundMethod(m)}
                className={`flex-1 rounded-xl border-2 px-4 py-2 text-[12.5px] transition-colors ${
                  refundMethod === m ? "border-rose-500 bg-white text-ink" : "border-blush-150 text-cocoa hover:border-blush-300"
                }`}
              >
                {m === "upi" ? "UPI" : "Bank transfer"}
              </button>
            ))}
          </div>

          {refundMethod === "upi" ? (
            <input
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              className="input-base"
              placeholder="yourname@upi"
              aria-label="UPI ID"
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={bank.account_name}
                onChange={(e) => setBank((b) => ({ ...b, account_name: e.target.value }))}
                className="input-base sm:col-span-2"
                placeholder="Account holder name"
              />
              <input
                value={bank.account_number}
                onChange={(e) => setBank((b) => ({ ...b, account_number: e.target.value }))}
                className="input-base"
                placeholder="Account number"
                inputMode="numeric"
              />
              <input
                value={bank.ifsc}
                onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))}
                className="input-base uppercase"
                placeholder="IFSC code"
              />
              <input
                value={bank.bank_name}
                onChange={(e) => setBank((b) => ({ ...b, bank_name: e.target.value }))}
                className="input-base sm:col-span-2"
                placeholder="Bank name"
              />
            </div>
          )}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-cocoa">Photos (recommended for damage)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 5))}
          className="text-[12px] text-cocoa file:mr-3 file:rounded-full file:border file:border-blush-200 file:bg-blush-50 file:px-3 file:py-1 file:text-[12px] file:text-cocoa"
        />
        {photos.length > 0 && <span className="text-[11px] text-fog">{photos.length} photo(s) selected</span>}
      </label>

      {error && <p className="text-[12px] text-red-500">{error}</p>}

      <button
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
      >
        {busy && <Spinner className="h-4 w-4" />} Submit request
      </button>
    </form>
  );
}
