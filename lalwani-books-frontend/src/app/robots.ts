import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Answered on every request instead of being written once during the build, so
 * the setting below can be changed on the server (Hostinger → the app's
 * Environment Variables) and takes effect when the app restarts — no new
 * upload, no rebuild.
 */
export const dynamic = "force-dynamic";

/**
 * Crawlers may read the whole shop except private and personal pages: the
 * admin panel, accounts, checkout, cart and wishlist (which also carry a
 * noindex tag), and the maintenance screen.
 *
 * ALLOW_SEARCH_ENGINES=false hides the shop from search completely. It is set
 * while this shop runs on its own address (app.lalwanibooks.com) next to the
 * old store on lalwanibooks.com: both sell the same books, and Google counting
 * the new address as a second copy of the old one would cost the old store its
 * places in search. Delete the setting (or set it to true) on the day this
 * shop takes over the main address.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_SEARCH_ENGINES === "false") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/checkout", "/cart", "/wishlist", "/maintenance"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
