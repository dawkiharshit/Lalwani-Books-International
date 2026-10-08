"use client";

import { SettingsForm, type SettingField } from "../settings-form";

const faq = (n: number): SettingField[] => [
  { key: `contact_faq_${n}_question`, label: `Question ${n}`, span: true },
  { key: `contact_faq_${n}_answer`, label: `Answer ${n}`, type: "textarea", rows: 2 },
];

/**
 * Everything on the Contact page, which also feeds the footer of every page:
 * the contact details, the social links and the questions beside the form.
 */
export default function AdminContactPage() {
  return (
    <SettingsForm
      heading="Contact Page"
      blurb="Everything on the Contact page — and the contact details and social icons in the footer of every page."
      sections={[
        {
          title: "Contact details",
          note: "Shown on the Contact page and in the footer. Leave a line blank to hide it.",
          fields: [
            {
              key: "contact_studio",
              label: "Contact card heading",
              placeholder: "Reach us directly",
              hint: "The heading of the dark card on the Contact page.",
              span: true,
            },
            { key: "support_email", label: "Email", hint: "Contact page and footer." },
            { key: "support_phone", label: "Phone", hint: "Contact page and the footer’s “Need help?”." },
            { key: "contact_hours", label: "Opening hours", placeholder: "Mon–Sat, 10am–7pm IST", span: true },
            { key: "contact_address", label: "Address", type: "textarea", rows: 3, hint: "One line per row." },
            {
              key: "contact_map_url",
              label: "Google Maps link",
              placeholder: "https://maps.app.goo.gl/…",
              hint: "Adds an “Open in Maps” link under the address on the Contact page.",
              span: true,
            },
          ],
        },
        {
          title: "Social links",
          note: "Icons in the footer and on the Contact page. Leave one blank to hide its icon.",
          fields: [
            { key: "social_instagram", label: "Instagram URL" },
            { key: "social_facebook", label: "Facebook URL" },
            { key: "social_youtube", label: "YouTube URL" },
            { key: "social_x", label: "X (Twitter) URL" },
            { key: "social_telegram", label: "Telegram URL" },
          ],
        },
        {
          title: "Frequently asked (beside the form)",
          note: "Up to four questions. Write {free_shipping} or {flat_shipping} to show the current delivery amounts from Shipping & Tax. Clear a question to leave it out.",
          fields: [...faq(1), ...faq(2), ...faq(3), ...faq(4)],
        },
      ]}
    />
  );
}
