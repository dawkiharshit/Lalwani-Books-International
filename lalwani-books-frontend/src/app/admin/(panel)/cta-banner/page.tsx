"use client";

import { SettingsForm } from "../settings-form";

export default function AdminCtaBanner() {
  return (
    <SettingsForm
      heading="Promo Band"
      blurb="The dark promotional band on the home page, between Deals Of The Week and What's In Trend. Switch it on and add a heading to show it."
      sections={[
        {
          fields: [
            { key: "cta_banner_enabled", label: "Show the promo band", type: "toggle" },
            { key: "cta_banner_eyebrow", label: "Small line above the heading", placeholder: "Limited release" },
            { key: "cta_banner_heading", label: "Heading", placeholder: "The Autumn Edit", span: true },
            { key: "cta_banner_description", label: "Description", type: "textarea", rows: 3 },
            { key: "cta_banner_button_text", label: "Button text", placeholder: "Shop the edit" },
            { key: "cta_banner_button_url", label: "Button link", placeholder: "/collection" },
          ],
        },
      ]}
    />
  );
}
