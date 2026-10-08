"use client";

import { SettingsForm } from "../settings-form";

export default function AdminPopup() {
  return (
    <SettingsForm
      heading="Popup Banner"
      blurb="Email-capture popup shown to first-time visitors. Shown on the home page; sign-ups appear in Messages & Subscribers."
      sections={[
        {
          title: "Behaviour",
          fields: [
            { key: "popup_enabled", label: "Show popup", type: "toggle" },
            { key: "popup_delay_seconds", label: "Delay (seconds)", type: "number", hint: "How long before it appears." },
            {
              key: "popup_show_once",
              label: "Frequency",
              type: "select",
              options: [
                { value: "1", label: "Once per visitor" },
                { value: "0", label: "Every visit" },
              ],
            },
          ],
        },
        {
          title: "Content",
          fields: [
            { key: "popup_title", label: "Title", placeholder: "Join our reading list" },
            { key: "popup_discount", label: "Offer badge", placeholder: "10% OFF" },
            { key: "popup_subtitle", label: "Subtitle", type: "textarea", rows: 2 },
            { key: "popup_button", label: "Button text", placeholder: "Subscribe" },
            { key: "popup_disclaimer", label: "Small print", placeholder: "No spam. Unsubscribe anytime." },
          ],
        },
      ]}
    />
  );
}
