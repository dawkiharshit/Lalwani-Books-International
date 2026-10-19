import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { pageMetadata } from "@/lib/page-meta";
import { plainSnippet } from "@/lib/seo";

export const revalidate = 120;

/** Static pages whose body is written in admin → Pages. */
const PAGES = {
  faq: {
    key: "page_faq",
    title: "Frequently Asked Questions",
    eyebrow: "Help",
    about: "Answers to common questions about ordering, delivery, payment and returns at Lalwani Books International.",
  },
  privacy: {
    key: "page_privacy",
    title: "Privacy Policy",
    eyebrow: "Legal",
    about: "How Lalwani Books International collects, uses and protects your personal information.",
  },
  terms: {
    key: "page_terms",
    title: "Terms & Conditions",
    eyebrow: "Legal",
    about: "The terms and conditions for buying books from Lalwani Books International.",
  },
} as const;

type Slug = keyof typeof PAGES;

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

// Only these three: any other address answers a real 404 before rendering.
export const dynamicParams = false;

/** Each page's own description — its opening words — so the three are not alike in search results. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug as Slug];
  if (!page) notFound();

  const body = String((await getSettings())[page.key] ?? "");
  return pageMetadata({ title: page.title, description: plainSnippet(body) || page.about, path: `/pages/${slug}` });
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug as Slug];
  if (!page) notFound();

  const settings = await getSettings();
  const body = String(settings[page.key] ?? "").trim();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="hero-card px-8 py-10 text-center sm:py-12">
        <p className="text-[11px] font-accent uppercase tracking-[0.35em] text-rose-500">{page.eyebrow}</p>
        <h1 className="mt-2 font-serif text-[2.1rem] leading-tight text-ink sm:text-[2.5rem]">
          {page.title}
        </h1>
      </section>

      <article className="card px-8 py-8">
        {body ? (
          <div className="whitespace-pre-line text-[13.5px] leading-[1.85] text-cocoa">{body}</div>
        ) : (
          <p className="text-center text-[13px] text-fog">
            This page hasn&apos;t been written yet.{" "}
            <Link href="/contact" className="text-rose-600 hover:underline">
              Contact us
            </Link>{" "}
            and we&apos;ll help directly.
          </p>
        )}
      </article>
    </div>
  );
}
