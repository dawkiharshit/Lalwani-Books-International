"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi, describeError } from "@/admin/lib/api";
import { IntegrationPanel, type IntegrationField } from "../integrations/panel";
import { Select } from "@/admin/components/Select";

const FIELDS: IntegrationField[] = [
  {
    key: "razorpay_key_id",
    label: "Key ID",
    placeholder: "rzp_live_xxxxxxxxxxxx",
    hint: "Razorpay Dashboard → Account & Settings → API Keys.",
  },
  { key: "razorpay_key_secret", label: "Key Secret", hint: "Shown once when you generate the key." },
  {
    key: "razorpay_webhook_secret",
    label: "Webhook Secret",
    hint: "Optional but recommended — confirms payments even if the customer closes the tab.",
  },
];

/** Cash on delivery on/off — a store setting, saved next to the gateway. */
function CashOnDelivery() {
  const [enabled, setEnabled] = useState<"1" | "0" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  // Never assume "Enabled" when the real value could not be read: saving that
  // guess would silently switch cash on delivery back on.
  const load = useCallback(() => {
    clientApi<{ data: Record<string, string> }>("/admin/settings")
      .then((r) => {
        setLoadError("");
        setEnabled(r.data.cod_enabled === "0" ? "0" : "1");
      })
      .catch((err) => setLoadError(describeError(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (enabled === null) return;
    setBusy(true);
    setMsg("");
    try {
      await clientApi("/admin/settings", { method: "PUT", body: { cod_enabled: enabled } });
      setMsg("Saved.");
    } catch (err) {
      setMsg(describeError(err, "save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-6 p-7">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.2em] text-fog">
          Cash on Delivery
        </p>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            enabled === null ? "bg-blush-150 text-fog" : enabled === "0" ? "bg-blush-100 text-fog" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {enabled === null ? "Unknown" : enabled === "0" ? "Off" : "On at checkout"}
        </span>
      </div>

      {loadError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-red-50 px-4 py-3 text-[12.5px] text-red-600">
          <span className="flex-1">{loadError}</span>
          <button
            type="button"
            onClick={load}
            className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-1 block text-[11px] font-medium text-cocoa">Offer cash on delivery</span>
        <Select
          value={enabled ?? "1"}
          onChange={(v) => setEnabled(v as "1" | "0")}
          disabled={enabled === null}
          options={[
            { value: "1", label: "Enabled" },
            { value: "0", label: "Disabled" },
          ]}
          ariaLabel="Offer cash on delivery"
          variant="field"
        />
      </label>

      <p className="mt-2 text-[11px] leading-relaxed text-fog">
        When off, checkout offers online payment only. Keep online payment set up first, or
        customers will have no way to pay.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={busy || enabled === null}
          className="rounded-full bg-maroon-800 px-6 py-2 text-[12px] font-medium text-white transition-colors hover:bg-maroon-900 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-[11.5px] text-cocoa">{msg}</span>}
      </div>
    </div>
  );
}

export default function AdminPayments() {
  return (
    <div>
      <IntegrationPanel
        group="payment"
        disconnect={{ name: "Razorpay", note: "Customers can’t pay online until you connect again — checkout offers only cash on delivery, if it is switched on." }}
        title="Payments"
        blurb="Razorpay keys are stored encrypted and never shown again once saved. Leave a secret blank to keep the current one."
        sectionTitle="Razorpay — online payments"
        onLabel="Live at checkout"
        offLabel="Off — COD only"
        fields={FIELDS}
        testLabel="Test Razorpay keys"
      />
      <CashOnDelivery />
    </div>
  );
}
