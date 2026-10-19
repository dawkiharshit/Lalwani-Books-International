"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, ApiError } from "@/admin/lib/api";
import { money, formatDate } from "@/admin/lib/format";
import { Spinner } from "@/admin/components/ui";

/** When a message is about the missing return address, a way straight to it. */
function ReturnAddressLink({ text }: { text: string }) {
  if (!/return address/i.test(text)) return null;
  return (
    <>
      {" "}
      <Link href="/admin/shipping#return-address" className="font-semibold underline underline-offset-2">
        Add the return address →
      </Link>
    </>
  );
}

interface ReturnRow {
  id: number;
  order_number: string | null;
  type: "refund" | "replacement";
  reason: string;
  note: string | null;
  items: { name: string; quantity: number }[];
  photos: string[];
  status: "requested" | "approved" | "rejected" | "completed";
  /** Your note — the customer sees it on their order page. */
  admin_note: string | null;
  /** Why the courier pickup could not be booked — admin only; the customer never sees it. */
  pickup_problem: string | null;
  pickup_booked: boolean;
  tracking_url: string | null;
  refund_amount: number | null;
  refund_method: "upi" | "bank" | null;
  refund_upi: string | null;
  refund_bank: { account_name: string; account_number: string; ifsc: string; bank_name: string } | null;
  created_at: string;
  customer: { name: string | null; email: string | null; phone: string | null };
  order_total: number | null;
  payment_method: string | null;
  payment_status: string | null;
  /** Where the Approve box starts for a pending refund: the whole total, or the returned books' share. */
  suggested_refund: number | null;
}

const STATUS: Record<ReturnRow["status"], { label: string; cls: string }> = {
  requested: { label: "Pending", cls: "bg-gold/15 text-gold" },
  approved: { label: "Approved", cls: "bg-blush-150 text-maroon-700" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-600" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
};

export default function AdminReturns() {
  const [rows, setRows] = useState<ReturnRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  // The server says whether the customer was emailed; shown after approving
  // or completing a return.
  const [notice, setNotice] = useState("");
  // Completing a refund and rejecting a return open a real in-page dialog —
  // this is money and customer-facing, it deserves a proper form, not a raw
  // browser prompt().
  const [dialog, setDialog] = useState<
    | { kind: "approve"; row: ReturnRow; amount: string; err: string }
    | { kind: "complete"; row: ReturnRow; amount: string; err: string }
    | { kind: "reject"; row: ReturnRow; note: string }
    | null
  >(null);

  const load = useCallback(() => {
    clientApi<{ data: ReturnRow[] }>("/admin/returns")
      .then((r) => {
        setRows(r.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list. Swallowing
         * this hid a server error behind "No return requests yet." — the table
         * had rows the whole time and the screen looked perfectly normal.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load returns: ${err.message}`
            : "Could not load returns. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(
    id: number,
    action: "approve" | "reject" | "complete" | "book-pickup",
    body?: object,
    /** Show a failure here (e.g. inside the open dialog) instead of the page banner, which the dialog covers. */
    onFail?: (message: string) => void
  ): Promise<boolean> {
    setBusy(id);
    setError("");
    setNotice("");
    try {
      // Update just this row from the response — refetching the whole list
      // made the card flash on every action.
      const res = await clientApi<{ data: Partial<ReturnRow>; message?: string }>(
        `/admin/returns/${id}/${action}`,
        { method: "POST", body }
      );
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...res.data } : r)) ?? prev);
      if ((action === "approve" || action === "complete") && res.message) setNotice(res.message);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed.";
      if (onFail) onFail(message);
      else setError(message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** Confirm the complete dialog: for a refund, validate the amount first. */
  async function submitComplete() {
    if (dialog?.kind !== "complete") return;
    const { row, amount } = dialog;
    let body: { refund_amount: number } | undefined;
    if (row.type === "refund") {
      const max = row.order_total ?? 0;
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt < 1 || amt > max) {
        setDialog({ ...dialog, err: `Enter an amount between ₹1 and ₹${max.toLocaleString("en-IN")}.` });
        return;
      }
      body = { refund_amount: amt };
    }
    // A refused refund (e.g. not enough in the Razorpay balance) is shown in the
    // dialog, where the admin is looking, and the dialog stays open to retry.
    const showInDialog = (message: string) =>
      setDialog((d) => (d?.kind === "complete" && d.row.id === row.id ? { ...d, err: message } : d));
    if (await act(row.id, "complete", body, showInDialog)) setDialog(null);
  }

  /** Confirm the approve dialog: the refund amount goes in the customer's email. */
  async function submitApprove() {
    if (dialog?.kind !== "approve") return;
    const { row, amount } = dialog;
    const max = row.order_total ?? 0;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 1 || amt > max) {
      setDialog({ ...dialog, err: `Enter an amount between ₹1 and ₹${max.toLocaleString("en-IN")}.` });
      return;
    }
    const showInDialog = (message: string) =>
      setDialog((d) => (d?.kind === "approve" && d.row.id === row.id ? { ...d, err: message } : d));
    if (await act(row.id, "approve", { refund_amount: amt }, showInDialog)) setDialog(null);
  }

  /** Confirm the reject dialog. */
  async function submitReject() {
    if (dialog?.kind !== "reject") return;
    const note = dialog.note.trim() || "Not eligible for return.";
    if (await act(dialog.row.id, "reject", { admin_note: note })) setDialog(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <h1 className="font-serif text-[1.5rem] text-ink">Returns / Refunds</h1>
        <p className="mt-0.5 text-[12px] text-fog">
          Customers request within {7} days of delivery. Approve to book the reverse pickup; complete
          to refund (online pays back automatically; COD is settled by hand).
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          {error}
          <ReturnAddressLink text={error} />
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-700">
          {notice}
        </p>
      )}

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="card px-6 py-14 text-center text-[13px] text-fog">No return requests yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((r) => {
            const s = STATUS[r.status];
            return (
              <article key={r.id} className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[13px] font-semibold text-ink">{r.order_number}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                    <span className="rounded-full bg-blush-100 px-2.5 py-0.5 text-[10px] font-semibold capitalize text-cocoa">
                      {r.type}
                    </span>
                  </div>
                  <span className="text-[11px] text-fog">{formatDate(r.created_at)}</span>
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr]">
                  <div>
                    <p className="text-[12.5px] font-medium text-ink">{r.reason}</p>
                    {r.note && <p className="mt-1 text-[12px] italic text-fog">&ldquo;{r.note}&rdquo;</p>}
                    <ul className="mt-2 text-[12px] text-cocoa">
                      {r.items.map((it, i) => (
                        <li key={i}>
                          {it.name} <span className="text-fog">× {it.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-[12px] text-cocoa">
                    <p className="font-medium text-ink">{r.customer.name || "—"}</p>
                    {r.customer.email && (
                      <a href={`mailto:${r.customer.email}`} className="block text-rose-600 hover:underline">
                        {r.customer.email}
                      </a>
                    )}
                    {r.customer.phone && <p>{r.customer.phone}</p>}
                    <p className="mt-1 text-fog">
                      {money(r.order_total ?? 0)} · {r.payment_method?.toUpperCase()} ·{" "}
                      <span className={r.payment_status === "refunded" ? "text-emerald-600" : ""}>
                        {r.payment_status}
                      </span>
                    </p>
                    {/* COD refund: no online payment to reverse — pay here. */}
                    {r.type === "refund" &&
                      r.payment_method === "cod" &&
                      (r.refund_upi || r.refund_bank) && (
                        <div className="mt-1.5 rounded-lg bg-gold/10 px-2 py-1.5 text-[11.5px] leading-relaxed text-ink">
                          💰 Refund via {r.refund_method === "bank" ? "Bank transfer" : "UPI"}:
                          {r.refund_method === "upi" ? (
                            <span className="ml-1 font-semibold">{r.refund_upi}</span>
                          ) : r.refund_bank ? (
                            <span className="ml-1 font-semibold">
                              {r.refund_bank.account_name} · A/C {r.refund_bank.account_number} ·{" "}
                              {r.refund_bank.ifsc} · {r.refund_bank.bank_name}
                            </span>
                          ) : null}
                        </div>
                      )}
                  </div>
                </div>

                {r.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.photos.map((p, i) => (
                      <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="block">
                        {/* Return photos come from the storage proxy, not next/image. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p}
                          alt={`Return photo ${i + 1}`}
                          className="h-20 w-20 rounded-lg border border-blush-150 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {r.admin_note && (
                  <p className="mt-3 rounded-xl bg-blush-50 px-3 py-2 text-[11.5px] leading-relaxed text-cocoa">
                    {r.admin_note}
                  </p>
                )}

                {/* Shiprocket's reason, for you alone — kept out of the note the customer reads. */}
                {r.pickup_problem && r.status === "approved" && !r.pickup_booked && (
                  <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-900">
                    <p>
                      <span className="font-semibold">Courier pickup not booked yet:</span> {r.pickup_problem}
                      <ReturnAddressLink text={r.pickup_problem} />
                    </p>
                    <p className="mt-1 text-[10.5px] text-amber-800/80">Only you see this — the customer doesn&rsquo;t.</p>
                  </div>
                )}

                {r.status === "completed" && r.type === "refund" && r.refund_amount ? (
                  <p className="mt-3 text-[12px] font-medium text-emerald-700">
                    Refund {money(r.refund_amount)}
                    {r.payment_method === "cod" ? " — pay out manually (COD)" : " — sent via Razorpay"}.
                  </p>
                ) : null}

                {/* Reverse-pickup status — a line, not a button. */}
                {r.status === "approved" && r.pickup_booked && (
                  <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
                    <span className="text-[15px] leading-none">✓</span> Reverse pickup booked with Shiprocket
                  </p>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.status === "requested" && (
                    <>
                      <button
                        onClick={() =>
                          // A refund asks for the amount first — the customer is told it.
                          r.type === "refund"
                            ? setDialog({
                                kind: "approve",
                                row: r,
                                amount: String(r.suggested_refund ?? r.order_total ?? ""),
                                err: "",
                              })
                            : act(r.id, "approve")
                        }
                        disabled={busy === r.id}
                        className="flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2 text-[12.5px] text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        {busy === r.id && <Spinner className="h-3.5 w-3.5" />} Approve &amp; book pickup
                      </button>
                      <button
                        onClick={() => setDialog({ kind: "reject", row: r, note: "" })}
                        disabled={busy === r.id}
                        className="rounded-full border border-blush-200 px-5 py-2 text-[12.5px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <>
                      {!r.pickup_booked && (
                        <button
                          onClick={() => act(r.id, "book-pickup")}
                          disabled={busy === r.id}
                          className="flex items-center gap-2 rounded-full border border-rose-300 px-5 py-2 text-[12.5px] text-rose-700 hover:bg-blush-50 disabled:opacity-60"
                        >
                          {busy === r.id && <Spinner className="h-3.5 w-3.5" />} Book Shiprocket pickup
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setDialog({
                            kind: "complete",
                            row: r,
                            // The amount the customer was told when it was approved.
                            amount: String(r.refund_amount ?? r.order_total ?? ""),
                            err: "",
                          })
                        }
                        disabled={busy === r.id}
                        className="flex items-center gap-2 rounded-full bg-maroon-800 px-5 py-2 text-[12.5px] text-white hover:bg-maroon-900 disabled:opacity-60"
                      >
                        {busy === r.id && <Spinner className="h-3.5 w-3.5" />}
                        {r.type === "refund" ? "Complete & refund" : "Mark replacement done"}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* A real dialog for the money actions — never a browser prompt(). */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-900/50 p-6 backdrop-blur-sm"
          onClick={() => setDialog(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            {dialog.kind === "approve" && (
              <>
                <h2 className="font-serif text-[1.25rem] text-ink">Approve return</h2>
                <p className="mt-1 text-[12px] text-fog">
                  Order <span className="font-mono text-cocoa">{dialog.row.order_number}</span>
                </p>
                <p className="mt-3 rounded-xl bg-blush-50 px-3 py-2.5 text-[12px] leading-relaxed text-cocoa">
                  The customer gets an email that the return is approved, with this refund amount. You can
                  still change it when you complete the refund.
                </p>

                <label
                  htmlFor="approve-amount"
                  className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-fog"
                >
                  Refund amount (₹)
                </label>
                <input
                  id="approve-amount"
                  type="number"
                  autoFocus
                  value={dialog.amount}
                  min={1}
                  max={dialog.row.order_total ?? undefined}
                  onChange={(e) => setDialog({ ...dialog, amount: e.target.value, err: "" })}
                  className="input-base mt-1 w-full"
                />
                <p className="mt-1 text-[11px] text-fog">
                  {dialog.row.suggested_refund !== null && dialog.row.suggested_refund < (dialog.row.order_total ?? 0)
                    ? `Filled in for the returned books (${money(dialog.row.suggested_refund)}) — the order total is ${money(dialog.row.order_total ?? 0)}.`
                    : `The whole order total, ${money(dialog.row.order_total ?? 0)} — enter less for a partial refund.`}
                </p>
              </>
            )}

            {dialog.kind === "complete" && dialog.row.type === "refund" && (
              <>
                <h2 className="font-serif text-[1.25rem] text-ink">Complete refund</h2>
                <p className="mt-1 text-[12px] text-fog">
                  Order <span className="font-mono text-cocoa">{dialog.row.order_number}</span>
                </p>

                {/* Where the money goes — a reminder before paying out. */}
                <div className="mt-3 rounded-xl bg-blush-50 px-3 py-2.5 text-[12px] leading-relaxed text-cocoa">
                  {dialog.row.payment_method === "cod" ? (
                    dialog.row.refund_method === "bank" && dialog.row.refund_bank ? (
                      <>
                        <span className="font-semibold text-ink">Pay out manually (COD) · Bank</span>
                        <br />
                        {dialog.row.refund_bank.account_name} · A/C {dialog.row.refund_bank.account_number}
                        <br />
                        {dialog.row.refund_bank.ifsc} · {dialog.row.refund_bank.bank_name}
                      </>
                    ) : dialog.row.refund_upi ? (
                      <>
                        <span className="font-semibold text-ink">Pay out manually (COD) · UPI</span>
                        <br />
                        {dialog.row.refund_upi}
                      </>
                    ) : (
                      <span className="font-semibold text-ink">Pay out manually (COD).</span>
                    )
                  ) : (
                    <span className="font-semibold text-ink">
                      Refunds automatically to the original payment via Razorpay.
                    </span>
                  )}
                </div>

                <label
                  htmlFor="refund-amount"
                  className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-fog"
                >
                  Refund amount (₹)
                </label>
                <input
                  id="refund-amount"
                  type="number"
                  autoFocus
                  value={dialog.amount}
                  min={1}
                  max={dialog.row.order_total ?? undefined}
                  onChange={(e) => setDialog({ ...dialog, amount: e.target.value, err: "" })}
                  className="input-base mt-1 w-full"
                />
                <p className="mt-1 text-[11px] text-fog">
                  Max {money(dialog.row.order_total ?? 0)} — enter less for a partial refund (e.g. one item
                  of several).
                </p>
              </>
            )}

            {dialog.kind === "complete" && dialog.row.type !== "refund" && (
              <>
                <h2 className="font-serif text-[1.25rem] text-ink">Mark replacement done</h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-cocoa">
                  Confirm the replacement for{" "}
                  <span className="font-mono text-ink">{dialog.row.order_number}</span> has been shipped.
                  This closes the request.
                </p>
              </>
            )}

            {dialog.kind === "reject" && (
              <>
                <h2 className="font-serif text-[1.25rem] text-ink">Reject return</h2>
                <p className="mt-1 text-[12px] text-fog">
                  Order <span className="font-mono text-cocoa">{dialog.row.order_number}</span>
                </p>
                <label
                  htmlFor="reject-note"
                  className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-fog"
                >
                  Reason (saved on the request)
                </label>
                <textarea
                  id="reject-note"
                  autoFocus
                  rows={3}
                  value={dialog.note}
                  onChange={(e) => setDialog({ ...dialog, note: e.target.value })}
                  placeholder="e.g. Outside the 7-day window / item shows use"
                  className="input-base mt-1 w-full resize-none"
                />
              </>
            )}

            {/* A wrong amount, or the reason the refund was refused. */}
            {(dialog.kind === "complete" || dialog.kind === "approve") && dialog.err && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-[12px] leading-relaxed text-red-600">
                {dialog.err}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setDialog(null)}
                className="rounded-full border border-blush-200 px-5 py-2 text-[12.5px] text-cocoa hover:bg-blush-100"
              >
                Cancel
              </button>
              <button
                onClick={
                  dialog.kind === "reject" ? submitReject : dialog.kind === "approve" ? submitApprove : submitComplete
                }
                disabled={busy === dialog.row.id}
                className={`flex items-center gap-2 rounded-full px-5 py-2 text-[12.5px] text-white disabled:opacity-60 ${
                  dialog.kind === "reject"
                    ? "bg-red-600 hover:bg-red-700"
                    : dialog.kind === "approve"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-maroon-800 hover:bg-maroon-900"
                }`}
              >
                {busy === dialog.row.id && <Spinner className="h-3.5 w-3.5" />}
                {dialog.kind === "reject"
                  ? "Reject return"
                  : dialog.kind === "approve"
                    ? "Approve & email customer"
                    : dialog.row.type === "refund"
                      ? "Refund now"
                      : "Mark done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
