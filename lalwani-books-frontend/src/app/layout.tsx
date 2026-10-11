import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ScrollButtons } from "@/components/ScrollButtons";
import { REVEAL_BOOT, RevealObserver } from "@/components/RevealObserver";
import { PageScrollbar } from "@/components/PageScrollbar";
import { FreshOnReturn } from "@/components/FreshOnReturn";
import { PhoneNavScroll } from "@/components/PhoneNavScroll";
import { BackForwardScroll } from "@/components/BackForwardScroll";
import { LoadingLayer } from "@/components/loading/LoadingLayer";
import { BookLoader } from "@/components/loading/BookLoader";
import { Brand } from "@/components/Brand";
import { getSettings } from "@/lib/settings";

/**
 * Sora for everything, as in the Bookory reference: a geometric sans that
 * holds up as a bold heading and still reads cleanly at 13-14px body size.
 */
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/**
 * Titles and the browser-tab icon follow admin → Branding. Icons live in
 * /public (not the app/icon convention) so an uploaded favicon always wins —
 * when one is set it is emitted alone, replacing the whole default set.
 *
 * The defaults are the LBi emblem rasterised at several sizes.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = settings.site_name || "Lalwani Books International";

  // Admin-managed home / site SEO (via admin → SEO or seo.php). A blank value
  // falls back to the built-in defaults, so nothing breaks if it's unset.
  const seo = (key: string) => {
    const v = settings[key];
    return typeof v === "string" ? v.trim() : "";
  };

  const title = seo("seo_home_title") || `${name} — Online Book Store`;
  const description =
    seo("seo_home_description") ||
    settings.site_tagline ||
    "Buy books online from Lalwani Books International — fiction, academic, children’s and competitive-exam books, delivered across India.";
  const keywords = seo("seo_home_keywords")
    ? seo("seo_home_keywords").split(",").map((k) => k.trim()).filter(Boolean)
    : ["books online", "book store", "buy books India", "academic books", "competitive exam books", "children’s books"];
  const ogTitle = seo("seo_og_title") || `${name} — Online Book Store`;
  // Falls back to the site description, not fixed copy: the old default was
  // left over from the zodiac template and showed on every shared link.
  const ogDescription = seo("seo_og_description") || description;
  // With no share image set in admin → SEO, links to the shop show the logo.
  const ogImage = seo("seo_og_image") || "/images/brand/logo.png";
  // The canonical address (admin → SEO) is the home page's alone — see
  // app/page.tsx. Set here it was inherited by every page without its own,
  // telling search engines each of them was a copy of the home page.

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: {
      default: title,
      template: `%s | ${name}`,
    },
    description,
    keywords,
    icons: settings.site_favicon
      ? { icon: settings.site_favicon }
      : {
          icon: [
            { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
            { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
            { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
          apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
        },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "website",
      siteName: name,
      locale: "en_IN",
      images: [ogImage],
    },
    twitter: {
      card: seo("seo_og_image") ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
  };
}

/**
 * The first-visit splash. Runs in <head> before anything paints: on a shop
 * page opened for the first time in this tab it adds `splash-on` to <html>,
 * then `splash-done` once the page has been parsed (at least ~0.45s, so it
 * never just flickers; at most 1.5s, whatever happens). The admin has its
 * own loading frame and never gets it; a reload or a later visit in the same
 * tab skips it. Storage that throws (private modes) simply means no splash.
 */
const SPLASH_BOOT = `(function(){try{var d=document.documentElement;if(location.pathname.indexOf("/admin")===0)return;var s=window.sessionStorage;if(s.getItem("lbi-splash"))return;s.setItem("lbi-splash","1");d.classList.add("splash-on");var t=Date.now(),off=false;var done=function(){if(off)return;off=true;d.classList.add("splash-done");setTimeout(function(){d.classList.remove("splash-on","splash-done")},450)};var ready=function(){setTimeout(done,Math.max(0,450-(Date.now()-t)))};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready);else ready();setTimeout(done,1500)}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  return (
    // suppressHydrationWarning: the boot scripts below add `reveal-ready` and
    // `splash-on` to <html> before React hydrates, which is expected, not a mismatch.
    <html
      lang="en"
      className={`${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: SPLASH_BOOT }} />
      </head>
      {/* suppressHydrationWarning: extensions such as Grammarly stamp
          attributes onto <body> before React loads. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Shown only while <html> has `splash-on` (see SPLASH_BOOT); hidden otherwise. */}
        <div className="boot-splash" aria-hidden>
          <Brand logo={settings.site_logo} name={settings.site_name} height={88} className="boot-splash__logo" />
          <BookLoader size="lg" />
        </div>
        <Providers>{children}</Providers>
        <LoadingLayer siteName={settings.site_name} />
        <FreshOnReturn />
        <PhoneNavScroll />
        <BackForwardScroll />
        <RevealObserver />
        <PageScrollbar />
        <ScrollButtons />
      </body>
    </html>
  );
}
