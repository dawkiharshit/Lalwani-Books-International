import { getSettings } from "@/lib/settings";
import { PopupBanner } from "./PopupBanner";

/** Server wrapper — reads admin config, renders the popup only when enabled. */
export async function PopupGate() {
  const s = await getSettings();
  if (s.popup_enabled !== "1") return null;

  return (
    <PopupBanner
      config={{
        enabled: true,
        delay: Number(s.popup_delay_seconds) || 6,
        showOnce: s.popup_show_once !== "0",
        title: s.popup_title || "Join our reading list",
        subtitle: s.popup_subtitle || "",
        discount: s.popup_discount || "",
        button: s.popup_button || "Subscribe",
        disclaimer: s.popup_disclaimer || "",
      }}
    />
  );
}
