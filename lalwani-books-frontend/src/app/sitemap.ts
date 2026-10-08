import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import type { Paginated, ProductCard } from "@/lib/types";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

  const staticPages = ["", "/collection", "/authors", "/publications", "/about", "/contact", "/track-order", "/blog"].map(
    (path) => ({
      url: `${base}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })
  );

  let productPages: MetadataRoute.Sitemap = [];
  try {
    const res = await api<Paginated<ProductCard>>("/products?per_page=48", { revalidate: 3600 });
    productPages = res.data.map((p) => ({
      url: `${base}/product/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    /* API down at build time — ship the static entries only. */
  }

  return [...staticPages, ...productPages];
}
