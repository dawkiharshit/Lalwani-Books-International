import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";
import type { Category, Paginated, ProductCard } from "@/lib/types";

export const revalidate = 3600;

/**
 * Every public page a search engine should know about: the main pages, every
 * book (all pages of the catalogue, not just the first 48), each category, the
 * blog posts and the help/legal pages.
 *
 * No made-up "last modified" dates: stamping everything with the time of the
 * build told crawlers the whole shop changed every hour, which they learn to
 * ignore. Blog posts carry their real publish date.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const page = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  });

  const main = [
    page("", 1, "daily"),
    page("/collection", 0.9, "daily"),
    page("/authors", 0.7),
    page("/publications", 0.7),
    page("/blog", 0.6),
    page("/about", 0.5, "monthly"),
    page("/contact", 0.5, "monthly"),
    page("/track-order", 0.3, "monthly"),
    page("/pages/faq", 0.4, "monthly"),
    page("/pages/privacy", 0.2, "monthly"),
    page("/pages/terms", 0.2, "monthly"),
  ];

  const books: MetadataRoute.Sitemap = [];
  try {
    for (let n = 1, last = 1; n <= last && n <= 50; n++) {
      const res = await api<Paginated<ProductCard>>(`/products?per_page=100&page=${n}`, { revalidate: 3600 });
      last = res.meta?.last_page ?? 1;
      for (const p of res.data) books.push(page(`/product/${p.slug}`, 0.8));
    }
  } catch {
    /* API down: ship what was collected */
  }

  const categories = await api<{ data: Category[] }>("/categories", { revalidate: 3600 })
    .then((r) => r.data.map((c) => page(`/collection?category=${encodeURIComponent(c.slug)}`, 0.7)))
    .catch(() => []);

  const posts = await api<{ data: { slug: string; published_at: string | null }[] }>("/blogs", { revalidate: 3600 })
    .then((r) =>
      r.data.map((b) => ({
        ...page(`/blog/${b.slug}`, 0.5, "monthly"),
        ...(b.published_at ? { lastModified: new Date(b.published_at) } : {}),
      }))
    )
    .catch(() => []);

  return [...main, ...categories, ...books, ...posts];
}
