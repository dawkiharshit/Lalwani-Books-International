import type { Metadata } from "next";
import { getSettings, type StoreSettings } from "@/lib/settings";
import { plainSnippet } from "@/lib/seo";

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Search results show about 60–70 characters of a title. */
const TITLE_ROOM = 70;

/**
 * The home page's description (and every page's without its own): admin →
 * SEO's, else the tagline followed by what the shop sells. The tagline alone
 * ("Books for every reader…") said nothing a search could match.
 */
export function homeDescription(settings: StoreSettings): string {
  const own = text(settings.seo_home_description);
  if (own) return own;
  const tagline = text(settings.site_tagline);
  if (!tagline) {
    return "Buy books online from Lalwani Books International — fiction, academic, children’s and competitive-exam books, delivered across India.";
  }
  return plainSnippet(
    `${/[.!?…]$/.test(tagline) ? tagline : `${tagline}.`} Buy fiction, academic, children’s and competitive-exam books online, delivered across India.`
  );
}

/**
 * The share preview every page starts from (admin → SEO): the home page's
 * title and description, and the share image — or the logo when none is set.
 */
export function siteShare(settings: StoreSettings) {
  const name = text(settings.site_name) || "Lalwani Books International";
  const description = text(settings.seo_og_description) || homeDescription(settings);
  const image = text(settings.seo_og_image);
  return {
    name,
    title: text(settings.seo_og_title) || `${name} — Online Book Store`,
    description,
    images: [image || "/images/brand/logo.png"],
    card: (image ? "summary_large_image" : "summary") as "summary_large_image" | "summary",
  };
}

/**
 * A page's title, description, canonical address and its own share preview,
 * in one go. Without it a page inherited the home page's preview, so a shared
 * About or Contact link showed the home page's title and description; and
 * pages without a canonical could be indexed under any query string.
 */
export async function pageMetadata({
  title,
  description,
  path,
  images,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  /** The page's own picture (a book cover, a post image); else the shop's share image. */
  images?: string[];
  type?: "website" | "article";
}): Promise<Metadata> {
  const share = siteShare(await getSettings());
  const pictures = images?.length ? images : share.images;
  // The shop's name goes after the title only while both fit in a result.
  const fits = `${title} | ${share.name}`.length <= TITLE_ROOM;
  const full = fits ? `${title} | ${share.name}` : title;
  return {
    title: fits ? title : { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { title: full, description, url: path, type, siteName: share.name, locale: "en_IN", images: pictures },
    twitter: { card: images?.length ? "summary_large_image" : share.card, title: full, description, images: pictures },
  };
}
