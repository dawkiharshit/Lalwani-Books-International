"use client";

import { SettingsForm } from "../settings-form";

const stat = (n: number) => [
  { key: `stats_${n}_value`, label: `Stat ${n} — value`, placeholder: "12" },
  { key: `stats_${n}_suffix`, label: `Stat ${n} — suffix`, placeholder: "+" },
  { key: `stats_${n}_label`, label: `Stat ${n} — label`, placeholder: "Titles in Stock", span: true },
];

export default function AdminStats() {
  return (
    <SettingsForm
      heading="Stats Counter"
      blurb="The four stat cards on the About page normally show live counts — total books, authors, categories and delivery. Switch this on to show your own numbers instead. Hide the cards altogether in About Page."
      sections={[
        { fields: [{ key: "stats_enabled", label: "Use these numbers instead of the live counts", type: "toggle", span: true }] },
        { title: "Numbers", fields: [...stat(1), ...stat(2), ...stat(3), ...stat(4)] },
      ]}
    />
  );
}
