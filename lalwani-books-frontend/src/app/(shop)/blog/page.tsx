import { PageBanner } from "@/components/PageBanner";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import Link from "next/link";
import Image from "@/components/Image";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "The Blog",
    description: "Reading lists, new arrivals and news from Lalwani Books International.",
    path: "/blog",
  });
}

export const revalidate = 120;

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  thumbnail: string | null;
  category: string | null;
  author_name: string | null;
  published_at: string | null;
}

export default async function BlogIndex() {
  const posts = await api<{ data: Post[] }>("/blogs", { revalidate: 120 })
    .then((r) => r.data)
    .catch(() => [] as Post[]);

  return (
    <div className="flex flex-col gap-6">
      <PageBanner title="Blog" crumbs={[{ label: "Blog" }]} />

      {posts.length === 0 ? (
        <div className="card px-8 py-16 text-center">
          <p className="font-serif text-[1.4rem] text-ink">No posts yet</p>
          <p className="mt-2 text-[13px] text-cocoa">New writing is on its way.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="card group overflow-hidden">
              <span className="relative block w-full bg-blush-100 pb-[58%]">
                {p.thumbnail && (
                  <Image
                    src={p.thumbnail}
                    alt={p.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </span>
              <span className="block p-5">
                {p.category && (
                  <span className="text-[10px] font-accent uppercase tracking-[0.2em] text-rose-500">{p.category}</span>
                )}
                <span className="mt-1 block font-serif text-[1.15rem] leading-snug text-ink group-hover:text-rose-700">
                  {p.title}
                </span>
                {p.excerpt && <span className="mt-2 block text-[12.5px] leading-relaxed text-cocoa">{p.excerpt}</span>}
                <span className="mt-3 block text-[11px] text-fog">
                  {p.author_name}
                  {p.author_name && p.published_at && " · "}
                  {p.published_at && formatDate(p.published_at)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
