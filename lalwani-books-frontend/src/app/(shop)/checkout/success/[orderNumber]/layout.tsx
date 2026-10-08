import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

/**
 * The browser-tab title for the order confirmation, a client component. The
 * Checkout layout above sets a plain title, which stops the site-wide
 * "… | Store" pattern reaching this page, so the full title is spelled out.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = settings.site_name || "Lalwani Books International";
  return { title: { absolute: `Order Placed | ${name}` }, robots: { index: false } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
