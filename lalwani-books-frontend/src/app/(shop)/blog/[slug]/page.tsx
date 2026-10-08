import { BackLink } from "@/components/BackLink";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "@/components/Image";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const revalidate = 120;

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  thumbnail: string | null;
  category: string | null;
  tags: string[];
  author_name: string | null;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  canonical_url: string | null;
  noindex: boolean;
  nofollow: boolean;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_card: string | null;
}

async function getPost(slug: string): Promise<Post | null> {
  try {
    const res = await api<{ data: Post }>(`/blogs/${slug}`, { revalidate: 120 });
    return res.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post" };

  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt || undefined;
  const ogTitle = post.og_title || title;
  const ogDescription = post.og_description || description;
  const image = post.og_image || post.thumbnail || undefined;
  const images = image ? [image] : undefined;

  return {
    title,
    description,
    keywords: post.meta_keywords || undefined,
    // Only override the canonical when the admin set one (syndicated content).
    alternates: post.canonical_url ? { canonical: post.canonical_url } : undefined,
    robots: { index: !post.noindex, follow: !post.nofollow },
    openGraph: {
      type: "article",
      title: ogTitle,
      description: ogDescription,
      images,
      publishedTime: post.published_at || undefined,
      authors: post.author_name ? [post.author_name] : undefined,
    },
    twitter: {
      card: post.twitter_card === "summary" ? "summary" : "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images,
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // Article structured data — helps Google show a rich result for the post.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.meta_title || post.title,
    description: post.meta_description || post.excerpt || undefined,
    image: post.og_image || post.thumbnail || undefined,
    datePublished: post.published_at || undefined,
    author: post.author_name ? { "@type": "Person", name: post.author_name } : undefined,
    articleSection: post.category || undefined,
    keywords: post.meta_keywords || (post.tags.length ? post.tags.join(", ") : undefined),
  };

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* `<` is escaped because JSON.stringify does not touch it: a post whose
          title or excerpt contained "</script>" would otherwise close this tag
          early and everything after it would run as markup. < is valid
          JSON, so search engines still read the block unchanged. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <BackLink href="/blog" label="Back to blog" />

      <header className="card px-8 py-9 text-center">
        {post.category && (
          <p className="text-[11px] font-accent uppercase tracking-[0.3em] text-rose-500">{post.category}</p>
        )}
        <h1 className="mt-2 font-serif text-[2rem] leading-tight text-ink sm:text-[2.4rem]">{post.title}</h1>
        <p className="mt-3 text-[11.5px] text-fog">
          {post.author_name}
          {post.author_name && post.published_at && " · "}
          {post.published_at && formatDate(post.published_at)}
        </p>
      </header>

      {post.thumbnail && (
        <div className="relative w-full overflow-hidden rounded-[1.25rem] bg-blush-100 pb-[52%]">
          <Image src={post.thumbnail} alt={post.title} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" priority />
        </div>
      )}

      <div className="card px-8 py-8">
        {post.excerpt && <p className="mb-5 text-[14px] italic leading-relaxed text-cocoa">{post.excerpt}</p>}
        {/* Content is admin-authored HTML (Blog editor), rendered with the
            .richtext styles so headings, lists and links format correctly. */}
        <div className="richtext" dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.tags.length > 0 && (
          <div className="mt-7 flex flex-wrap gap-2 border-t border-blush-100 pt-5">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full bg-blush-50 px-3 py-1 text-[11px] text-cocoa">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <Link href="/blog" className="text-center text-[12.5px] text-rose-600 hover:underline">
        ← Back to all posts
      </Link>
    </article>
  );
}
