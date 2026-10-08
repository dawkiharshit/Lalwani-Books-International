/**
 * The shop this panel manages, when it has a public site: set
 * NEXT_PUBLIC_STOREFRONT_URL (no trailing slash). Links that open the site, a
 * product or a blog post only appear when it is set.
 */
export const STOREFRONT_URL = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
).replace(/\/+$/, "");
