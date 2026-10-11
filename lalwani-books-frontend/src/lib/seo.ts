/**
 * Shared bits for search engines: the site's public address, absolute links
 * (structured data and sitemaps must use full URLs), and plain-text snippets
 * for meta descriptions.
 */

/** The shop's public address, without a trailing slash. Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** A full URL for a path on this site, or the URL itself when it already is one. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Text for a meta description: tags dropped, whitespace folded, cut at a word near `max`. */
export function plainSnippet(html: string | null | undefined, max = 160): string {
  const text = String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trim()}…`;
}
