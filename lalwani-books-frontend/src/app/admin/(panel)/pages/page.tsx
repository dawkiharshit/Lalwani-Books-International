"use client";

import { SettingsForm } from "../settings-form";

/** The three long-form pages linked from the footer. */
export default function AdminPages() {
  return (
    <SettingsForm
      heading="FAQ & Policies"
      blurb="The FAQ, Privacy Policy and Terms & Conditions pages, linked from the footer of every page. Plain text or simple HTML. Leave one blank to use the built-in text."
      sections={[
        {
          fields: [
            { key: "page_faq", label: "FAQ (/pages/faq)", type: "textarea", rows: 8 },
            { key: "page_privacy", label: "Privacy Policy (/pages/privacy)", type: "textarea", rows: 8 },
            {
              key: "page_terms",
              label: "Terms & Conditions (/pages/terms)",
              type: "textarea",
              rows: 8,
              hint: "Also the returns policy linked from the Contact page.",
            },
          ],
        },
      ]}
    />
  );
}
