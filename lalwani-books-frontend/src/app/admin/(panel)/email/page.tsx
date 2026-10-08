"use client";

import { IntegrationPanel, type IntegrationField } from "../integrations/panel";

const FIELDS: IntegrationField[] = [
  {
    key: "mail_host",
    label: "SMTP host",
    placeholder: "smtp.hostinger.com",
    hint: "From your email provider. Gmail is smtp.gmail.com, Hostinger is smtp.hostinger.com.",
  },
  { key: "mail_port", label: "Port", placeholder: "587" },
  {
    key: "mail_encryption",
    label: "Encryption",
    options: [
      { value: "tls", label: "TLS — port 587 (usual)" },
      { value: "ssl", label: "SSL — port 465" },
      { value: "", label: "None" },
    ],
  },
  { key: "mail_username", label: "Username", placeholder: "orders@yourdomain.com", wide: true },
  {
    key: "mail_password",
    label: "Password",
    hint: "With Gmail this must be an App Password, not your account password.",
  },
  {
    key: "mail_from_address",
    label: "Send from",
    placeholder: "orders@yourdomain.com",
    hint: "Customers see this as the sender. Use an address on your own domain so mail is not marked as spam.",
  },
  { key: "mail_from_name", label: "Sender name", placeholder: "Lalwani Books International", wide: true },
];

export default function AdminEmail() {
  return (
    <IntegrationPanel
      group="mail"
      title="Email (SMTP)"
      blurb="Where the shop sends order confirmations and password-reset links from. Until this is set, no email leaves the server."
      sectionTitle="SMTP — outgoing email"
      onLabel="Sending"
      offLabel="Not sending"
      fields={FIELDS}
      testLabel="Send test email"
      testTo={{
        label: "Send the test to",
        placeholder: "you@gmail.com",
      }}
      note={
        <p className="rounded-xl bg-blush-50 px-4 py-2.5 text-[11.5px] leading-relaxed text-cocoa">
          These messages depend on it: order confirmation to the customer, a copy to the shop
          inbox, and the password-reset link. Send yourself a test after saving — a reset link
          that never arrives locks customers out of their accounts.
        </p>
      }
    />
  );
}
