"use client";

import { useEffect, useState } from "react";
import { clientApi, ApiError } from "@/admin/lib/api";
import { money } from "@/admin/lib/format";
import { SettingsForm } from "../settings-form";

/** Shows the rule in plain money, so the numbers above are easy to sanity-check. */
function Preview() {
  const [s, setS] = useState<{ free: number; flat: number; tax: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: Record<string, string> }>("/admin/settings")
      .then((res) =>
        setS({
          free: Number(res.data.free_shipping_threshold) || 0,
          flat: Number(res.data.flat_shipping) || 0,
          tax: Number(res.data.tax_rate) || 0,
        })
      )
      .catch((err) => {
        /*
         * Rendering nothing on a failure reads as "there is no preview", so say
         * the settings could not be read instead.
         */
        setError(
          err instanceof ApiError
            ? `Could not load the saved settings: ${err.message}`
            : "Could not load the saved settings. Check that the API is running."
        );
      });
  }, []);

  if (error) {
    return <p className="card p-7 text-[12px] text-red-600">{error}</p>;
  }

  if (!s) return null;

  const examples = [Math.max(s.free - 1000, 500), s.free];

  return (
    <section className="card p-7">
      <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
        What a customer pays
      </p>
      <p className="mt-2 text-[12px] text-fog">
        Saved values, not the boxes above — save first to see a change here.
      </p>

      <div className="mt-4 space-y-3">
        {examples.map((base) => {
          const ship = base >= s.free ? 0 : s.flat;
          const tax = Math.round(base * s.tax);
          return (
            <div key={base} className="rounded-xl bg-blush-50 px-4 py-3 text-[12.5px]">
              <p className="font-semibold text-ink">Cart of {money(base)}</p>
              <p className="mt-1 text-cocoa">
                Shipping {ship === 0 ? "free" : money(ship)} · Tax {money(tax)} ·{" "}
                <span className="text-ink">Total {money(base + ship + tax)}</span>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminShipping() {
  return (
    <div className="flex flex-col gap-5">
      <SettingsForm
        heading="Shipping & Tax"
        blurb="What every order is charged on top of the products. Used by the cart, checkout and every invoice."
        sections={[
          {
            title: "Shipping",
            fields: [
              {
                key: "free_shipping_threshold",
                label: "Free shipping over (₹)",
                type: "number",
                hint: "Carts at or above this amount ship free. Set 0 to make everything free.",
              },
              {
                key: "flat_shipping",
                label: "Shipping charge (₹)",
                type: "number",
                hint: "Charged when the cart is below the amount above and live rates aren't available. Set 0 to never charge shipping.",
              },
              {
                key: "shipping_buffer_flat",
                label: "Live-rate buffer (₹)",
                type: "number",
                hint: "Added flat to the live courier rate so the customer covers Shiprocket's 'Secure Shipment' insurance — a flat ~₹54 per shipment their rate API doesn't include, so without this the seller loses ~₹54 per order. ₹60 keeps a small margin. Set 0 if you turn Secure Shipment off in Shiprocket.",
                span: true,
              },
            ],
          },
          {
            title: "Tax",
            fields: [
              {
                key: "tax_rate",
                label: "GST rate",
                type: "number",
                hint: "Written as a decimal: 0.18 = 18%, 0.12 = 12%, 0 = no tax. Split into CGST + SGST or IGST on the invoice.",
                span: true,
              },
            ],
          },
          {
            id: "return-address",
            title: "Return address (reverse pickups)",
            note: "Where returned parcels come back to. Shiprocket books the reverse pickup against this — fill it in so an approved return auto-books a courier. Leave blank and it falls back to your invoice address + Shiprocket pickup PIN.",
            fields: [
              { key: "return_name", label: "Name / business", placeholder: "Lalwani Books International" },
              { key: "return_phone", label: "Phone", placeholder: "9876543210" },
              { key: "return_address", label: "Address", type: "textarea", rows: 2, span: true },
              { key: "return_city", label: "City", placeholder: "New Delhi" },
              { key: "return_state", label: "State", placeholder: "Delhi" },
              { key: "return_pincode", label: "PIN code", placeholder: "110044" },
            ],
          },
        ]}
      />

      <Preview />
    </div>
  );
}
