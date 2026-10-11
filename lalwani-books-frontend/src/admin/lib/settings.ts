import { cache } from "react";
import { api } from "@/admin/lib/api";

export interface StoreSettings {
  free_shipping_threshold: number;
  flat_shipping: number;
  tax_rate: number;
  support_email: string;
  support_phone: string;
  announcement: string;
  social_instagram: string;
  social_facebook: string;
  social_youtube: string;
  social_x: string;
  social_telegram: string;
  site_name: string;
  site_logo: string;
  site_favicon: string;
  site_tagline: string;
  stats_enabled: string;
  cta_banner_enabled: string;
  cta_banner_eyebrow: string;
  cta_banner_heading: string;
  cta_banner_description: string;
  cta_banner_button_text: string;
  cta_banner_button_url: string;
  popup_enabled: string;
  popup_delay_seconds: string;
  popup_show_once: string;
  popup_title: string;
  popup_subtitle: string;
  popup_discount: string;
  popup_button: string;
  popup_disclaimer: string;
  /** Picture shown in the popup, uploaded in admin → Popup Banner ('' for none). */
  popup_image: string;
  about_hero_eyebrow: string;
  about_hero_title: string;
  about_hero_subtitle: string;
  about_quote_text: string;
  about_quote_author: string;
  page_faq: string;
  page_privacy: string;
  page_terms: string;
  [key: string]: string | number;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  free_shipping_threshold: 4999,
  flat_shipping: 149,
  tax_rate: 0,
  support_email: "hello@lalwanibooks.com",
  support_phone: "+91 98765 43210",
  announcement: "",
  social_instagram: "",
  social_facebook: "",
  social_youtube: "",
  social_x: "",
  social_telegram: "",
  site_name: "Lalwani Books International",
  site_logo: "/images/brand/logo.svg",
  site_favicon: "",
  site_tagline: "Books for every reader — publishing and distribution since day one.",
  stats_enabled: "0",
  cta_banner_enabled: "0",
  cta_banner_eyebrow: "",
  cta_banner_heading: "",
  cta_banner_description: "",
  cta_banner_button_text: "",
  cta_banner_button_url: "",
  popup_enabled: "0",
  popup_delay_seconds: "6",
  popup_show_once: "1",
  popup_title: "",
  popup_subtitle: "",
  popup_discount: "",
  popup_button: "Subscribe",
  popup_disclaimer: "",
  popup_image: "",
  about_hero_eyebrow: "",
  about_hero_title: "",
  about_hero_subtitle: "",
  about_quote_text: "",
  about_quote_author: "",
  page_faq: "",
  page_privacy: "",
  page_terms: "",
};

/**
 * Zero is a real value for these — '||' would treat it as missing and quietly
 * restore the default, so a shop that sets free shipping could never turn the
 * charge off.
 */
function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
}

function normalize(raw: Record<string, string>): StoreSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    free_shipping_threshold: num(raw.free_shipping_threshold, DEFAULT_SETTINGS.free_shipping_threshold),
    flat_shipping: num(raw.flat_shipping, DEFAULT_SETTINGS.flat_shipping),
    tax_rate: num(raw.tax_rate, DEFAULT_SETTINGS.tax_rate),
    // `??`, not `||`: an email or phone cleared in admin must stay cleared,
    // not come back as the template's placeholder.
    support_email: raw.support_email ?? DEFAULT_SETTINGS.support_email,
    support_phone: raw.support_phone ?? DEFAULT_SETTINGS.support_phone,
    announcement: raw.announcement ?? "",
    social_instagram: raw.social_instagram ?? DEFAULT_SETTINGS.social_instagram,
    social_facebook: raw.social_facebook ?? DEFAULT_SETTINGS.social_facebook,
    social_youtube: raw.social_youtube ?? DEFAULT_SETTINGS.social_youtube,
    social_x: raw.social_x ?? DEFAULT_SETTINGS.social_x,
    social_telegram: raw.social_telegram ?? DEFAULT_SETTINGS.social_telegram,
  };
}

/**
 * Server-side fetch (ISR-cached). Falls back to defaults if the API is down.
 *
 * Wrapped in React's cache() because seventeen components call this, and the
 * home page renders a dozen of them in one pass. Without it each call re-ran
 * normalize() over ~138 keys and relied on the fetch cache to avoid a real
 * request; now the work happens once per render and the rest read the result.
 */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const res = await api<{ data: Record<string, string> }>("/settings", { revalidate: 120 });
    return normalize(res.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** Client-side fetch for "use client" pages. */
export async function fetchSettingsClient(): Promise<StoreSettings> {
  try {
    const res = await api<{ data: Record<string, string> }>("/settings", { cache: "no-store" });
    return normalize(res.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
