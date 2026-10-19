import { BackLink } from "@/components/BackLink";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "@/components/Image";
import { notFound } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { siteShare } from "@/lib/page-meta";
import { absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

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

/**
 * The post, or a 404 when there is no such post. Any other failure (the API
 * down) is thrown: a page cached earlier keeps being served instead of being
 * replaced by "not found".
 */
async function getPost(slug: string): Promise<Post> {
  try {
    return (await api<{ data: Post }>(`/blogs/${encodeURIComponent(slug)}`, { revalidate: 120 })).data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  const share = siteShare(await getSettings());

  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt || undefined;
  const ogTitle = post.og_title || title;
  const ogDescription = post.og_description || description;
  const image = post.og_image || post.thumbnail || undefined;
  const images = image ? [image] : share.images;
  // The post's own address, unless the admin pointed it at the original
  // (syndicated content) in the post's SEO settings.
  const canonical = post.canonical_url || `/blog/${post.slug}`;

  return {
    title,
    description,
    keywords: post.meta_keywords || undefined,
    alternates: { canonical },
    robots: { index: !post.noindex, follow: !post.nofollow },
    openGraph: {
      type: "article",
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      siteName: share.name,
      locale: "en_IN",
      images,
      publishedTime: post.published_at || undefined,
      authors: post.author_name ? [post.author_name] : undefined,
    },
    twitter: {
      card: !image ? share.card : post.twitter_card === "summary" ? "summary" : "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images,
    },
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  const share = siteShare(await getSettings());
  const url = absoluteUrl(`/blog/${post.slug}`);
  const shop = { "@type": "Organization", name: share.name, url: absoluteUrl("/") };
  const image = post.og_image || post.thumbnail;

  // Blog-post structured data — helps Google show a rich result for the post —
  // and the trail back to the blog.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || undefined,
      url,
      mainEntityOfPage: url,
      image: image ? absoluteUrl(image) : undefined,
      datePublished: post.published_at || undefined,
      author: post.author_name ? { "@type": "Person", name: post.author_name } : shop,
      publisher: { ...shop, logo: absoluteUrl("/images/brand/logo.png") },
      articleSection: post.category || undefined,
      keywords: post.meta_keywords || (post.tags.length ? post.tags.join(", ") : undefined),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <JsonLd data={jsonLd} />

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
