import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";
import { SHELVES } from "@/lib/shelves";
import type { Author, Category, Paginated, ProductCard, Publisher } from "@/lib/types";
import { INSTITUTION_AUDIENCES } from "@/components/home/institutions";

export const revalidate = 3600;

/**
 * Every public page a search engine should know about: the main pages, every
 * book (all pages of the catalogue, not just the first 48), each category, each
 * author and publisher with books in stock, the books-for-institutions lists,
 * the blog posts and the help/legal pages.
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
    page("/institutions", 0.7, "monthly"),
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

  // An author or publisher page with no live books would only show "no books".
  const listed = async <T extends { slug: string; products_count: number }>(path: string, key: string) =>
    api<{ data: T[] }>(path, { revalidate: 3600 })
      .then((r) => r.data.filter((x) => x.products_count > 0).map((x) => page(`/collection?${key}=${encodeURIComponent(x.slug)}`, 0.6)))
      .catch(() => []);
  const [authors, publishers] = await Promise.all([listed<Author>("/authors", "author"), listed<Publisher>("/publishers", "publisher")]);

  // Browse By Genre's lists: New Arrivals, Bestsellers, The Lalwani Edit, Gift Ideas, Non-Fiction.
  const shelves = SHELVES.map((s) => page(`/collection?shelf=${s.slug}`, 0.7));
  // Books for Schools, Universities, Libraries, Corporates.
  const audiences = INSTITUTION_AUDIENCES.map((a) => page(`/collection?for=${a.slug}`, 0.5, "monthly"));

  return [...main, ...shelves, ...categories, ...audiences, ...authors, ...publishers, ...books, ...posts];
}
