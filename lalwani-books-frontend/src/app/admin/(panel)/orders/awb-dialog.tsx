"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { ApiError, PendingApproval, clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";

/** The couriers Shiprocket books most often, offered while the courier is typed. */
const COURIERS = [
  "Delhivery",
  "Xpressbees",
  "Ekart",
  "DTDC",
  "Blue Dart",
  "Shadowfax",
  "Ecom Express",
  "Amazon Shipping",
  "India Post",
  "Shree Maruti",
];

/** The same rule the server applies, so a typo is caught before the round trip. */
const AWB = /^[A-Za-z0-9][A-Za-z0-9-]{3,39}$/;

export interface AwbOrder {
  id: number;
  order_number: string;
  status: string;
  /** Where the email goes: the address the customer ordered with. */
  email: string | null;
  awb_code: string | null;
  courier_name: string | null;
}

/**
 * Typing in an AWB booked outside this panel — usually on Shiprocket's own
 * site. Each save puts it on the order with its tracking link and emails the
 * customer "your order has been processed" with the number. A pending order
 * becomes processing.
 */
export function AwbDialog({
  order,
  onClose,
  onSaved,
}: {
  order: AwbOrder;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [awb, setAwb] = useState(order.awb_code ?? "");
  const [courier, setCourier] = useState(order.courier_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const close = useEffectEvent(() => onClose());

  // Focus the number on open, Escape closes, and focus goes back to the
  // button that opened it.
  useEffect(() => {
    const opener = document.activeElement;
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  const editing = Boolean(order.awb_code);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const number = awb.replace(/\s+/g, "");
    if (!AWB.test(number)) {
      setError(number ? "An AWB number is 4 to 40 letters or digits (dashes allowed)." : "Enter the AWB number.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await clientApi<{ message: string }>(`/admin/orders/${order.id}/awb`, {
        method: "PUT",
        body: { awb_code: number, courier_name: courier.trim() },
      });
      onSaved(res.message);
    } catch (err) {
      // A staff member's save waits for the owner; the layout says so.
      if (err instanceof PendingApproval) {
        onClose();
        return;
      }
      const field = err instanceof ApiError ? (err.errors?.awb_code?.[0] ?? err.errors?.courier_name?.[0]) : undefined;
      setError(field ?? describeError(err, "save the AWB number"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-maroon-900/50 p-4 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={save} noValidate>
          <h2 id={`${id}-title`} className="font-serif text-[1.25rem] text-ink">
            {editing ? "Change the AWB number" : "Add the AWB number"}
          </h2>
          <p className="mt-1 text-[12.5px] text-fog">
            Order <span className="font-medium text-cocoa">{order.order_number}</span> — the tracking number the courier gave
            this parcel, e.g. from Shiprocket&rsquo;s &ldquo;Ship Now&rdquo;.
          </p>

          <label htmlFor={`${id}-awb`} className="mt-5 block text-[11px] font-medium text-cocoa">
            AWB number
          </label>
          <input
            ref={inputRef}
            id={`${id}-awb`}
            value={awb}
            onChange={(e) => setAwb(e.target.value)}
            maxLength={48}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className="input-base mt-1 font-mono tracking-wide"
            placeholder="e.g. 14318420012345"
          />

          <label htmlFor={`${id}-courier`} className="mt-4 block text-[11px] font-medium text-cocoa">
            Courier <span className="font-normal text-fog">(optional)</span>
          </label>
          <input
            id={`${id}-courier`}
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            maxLength={80}
            list={`${id}-couriers`}
            autoComplete="off"
            className="input-base mt-1"
            placeholder="e.g. Delhivery"
          />
          <datalist id={`${id}-couriers`}>
            {COURIERS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <p className="mt-4 rounded-xl bg-blush-50 px-4 py-3 text-[12px] leading-relaxed text-cocoa">
            {order.email ? (
              <>
                When you save, an email goes to <b className="break-all font-semibold text-ink">{order.email}</b>: &ldquo;Your
                order has been processed&rdquo;, with this number and a link to track the parcel.
              </>
            ) : (
              "This order has no email address, so the number is saved without an email."
            )}
            {order.status === "pending" && " The order moves to Processing."}
          </p>

          {error && (
            <p id={`${id}-error`} role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-full border border-blush-200 px-5 py-2 text-[12.5px] text-cocoa hover:bg-blush-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex cursor-pointer items-center gap-2 rounded-full bg-maroon-800 px-5 py-2 text-[12.5px] text-white hover:bg-maroon-900 disabled:opacity-60"
            >
              {busy && <Spinner className="h-3.5 w-3.5" />}
              {order.email ? "Save & email customer" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
