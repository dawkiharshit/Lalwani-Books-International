"use client";

import { SettingsForm } from "../settings-form";
import { MaintenanceToggle } from "./maintenance-toggle";

export default function AdminSettings() {
  return (
    <div className="flex flex-col gap-5">
      <MaintenanceToggle />
      <SettingsForm
      heading="Settings"
      blurb="The details printed on every invoice. Contact details and social links are edited in Content → Contact Page."
      sections={[
        {
          title: "Invoice / GST",
          fields: [
            {
              key: "invoice_seller_name",
              label: "Legal / billing name",
              hint: "Printed at the top of every invoice. Blank = the store name.",
            },
            { key: "invoice_gstin", label: "GSTIN", placeholder: "07AABCU9603R1ZM" },
            {
              key: "invoice_state",
              label: "Seller state",
              placeholder: "Delhi",
              hint: "Decides the tax split: same state as the buyer means CGST + SGST, otherwise IGST.",
            },
            { key: "invoice_prefix", label: "Invoice number prefix", placeholder: "INV" },
            { key: "invoice_phone", label: "Invoice phone" },
            { key: "invoice_email", label: "Invoice email" },
            {
              key: "invoice_address",
              label: "Billing address",
              type: "textarea",
              rows: 3,
              hint: "One line per row.",
            },
            {
              key: "invoice_terms",
              label: "Footer note / terms",
              type: "textarea",
              rows: 2,
              span: true,
            },
          ],
        },
      ]}
      />
    </div>
  );
}
