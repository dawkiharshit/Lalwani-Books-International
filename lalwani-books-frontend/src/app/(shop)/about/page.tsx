import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import Link from "next/link";
import Image from "@/components/Image";
import { api } from "@/lib/api";
import type { Author, Category, Paginated, ProductCard } from "@/lib/types";
import { BookOpenIcon, ShieldIcon, TruckIcon, UsersIcon } from "@/components/icons";
import { PageBanner } from "@/components/PageBanner";
import { CoverStack, type Testimonial } from "@/components/home/bookory-client";
import { StatsCards, TestimonialBand } from "@/components/home/bookory";
import { adminStats } from "@/components/home/connected";
import { DottedPaper, Ring, Sparkle } from "@/components/home/doodles";
import { getSettings } from "@/lib/settings";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "About Us",
    description:
      "Lalwani Books International brings readers, students and institutions the books they need — genuine editions from publishers in India and abroad.",
    path: "/about",
  });
}

/**
 * Icons and tints stay in code; every line of copy comes from admin → About
 * Page. Each value card sits on a pale wash of its own colour with the icon
 * in a white tile, so the four read as a set rather than four grey boxes.
 */
const VALUE_STYLE = [
  { Icon: ShieldIcon, bg: "bg-[#e6eef9]", color: "text-[#042b52]" },
  { Icon: BookOpenIcon, bg: "bg-[#f8f2e3]", color: "text-[#a47a22]" },
  { Icon: TruckIcon, bg: "bg-[#eaf0f7]", color: "text-[#2b5d92]" },
  { Icon: UsersIcon, bg: "bg-[#eef2f6]", color: "text-[#4b6a88]" },
];

export default async function AboutPage() {
  const R = { revalidate: 300 } as const;
  const [s, books, totalBooks, authors, categories, testimonials] = await Promise.all([
    getSettings(),
    api<Paginated<ProductCard>>("/products?featured=1&per_page=3", R)
      .then((r) => r.data)
      .catch(() => [] as ProductCard[]),
    // Live counts for the stat cards: every book, author and category in the shop.
    api<Paginated<ProductCard>>("/products?per_page=1", R)
      .then((r) => r.meta.total)
      .catch(() => 0),
    api<{ data: Author[] }>("/authors", R)
      .then((r) => r.data.filter((a) => a.products_count > 0).length)
      .catch(() => 0),
    api<{ data: Category[] }>("/categories", R)
      .then((r) => r.data.filter((c) => c.products_count > 0).length)
      .catch(() => 0),
    api<{ data: Testimonial[] }>("/testimonials", R)
      .then((r) => r.data)
      .catch(() => [] as Testimonial[]),
  ]);
  const get = (key: string) => String(s[key] ?? "");

  /** Paints the admin-chosen word of a heading coral. First match only. */
  const highlight = (text: string, word: string) => {
    if (!text) return null;
    const at = word ? text.toLowerCase().indexOf(word.toLowerCase()) : -1;
    if (at < 0) return text;
    return (
      <>
        {text.slice(0, at)}
        <span className="text-rose-600">{text.slice(at, at + word.length)}</span>
        {text.slice(at + word.length)}
      </>
    );
  };

  const values = VALUE_STYLE.map((style, i) => ({
    ...style,
    title: get(`about_value_${i + 1}_title`),
    body: get(`about_value_${i + 1}_body`),
  })).filter((v) => v.title || v.body);
  const valuesHeading = get("about_values_eyebrow") || get("about_values_title");

  return (
    <>
      <PageBanner title="About Us" crumbs={[{ label: "About Us" }]} />

      <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          {get("about_hero_eyebrow") && (
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-rose-600">{get("about_hero_eyebrow")}</p>
          )}
          <h2 className="mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[2.6rem]">
            {highlight(get("about_hero_title"), get("about_hero_highlight"))}
          </h2>
          {get("about_hero_subtitle") && (
            <p className="mt-5 text-[15px] leading-relaxed text-cocoa">{get("about_hero_subtitle")}</p>
          )}
          {get("about_hero_note") && <p className="mt-3 text-[15px] leading-relaxed text-cocoa">{get("about_hero_note")}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/collection" className="rounded-full bg-rose-600 px-7 py-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700">
              Browse Books
            </Link>
            <Link href="/contact" className="rounded-full border border-ink px-7 py-3.5 text-[13px] font-semibold text-ink transition-colors hover:bg-ink hover:text-white">
              Contact Us
            </Link>
          </div>
        </div>

        {/* The photo (or the fanned covers) on the same warm, dotted ground as the home page hero. */}
        <div data-reveal className="relative overflow-hidden rounded-[var(--radius-hero)] bg-blush-100 p-6 sm:p-10">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_100%_0%,rgba(255,255,255,0.7),transparent_70%),radial-gradient(120%_100%_at_0%_100%,#dbe6f3_0%,#eaf0f7_55%,#f6f8fb_100%)]" />
            <DottedPaper dot="rgba(4,43,82,0.12)" />
            <Ring className="-bottom-20 -right-16 h-48 w-48" stroke="#042b52" opacity={0.2} />
            <Sparkle className="left-[6%] top-[8%] w-4" delay="-2s" fill="#042b52" opacity={0.5} />
            <Sparkle className="right-[8%] top-[14%] w-3" delay="-4s" fill="#e8b04b" opacity={0.65} />
          </div>
          <div className="relative">
            {get("about_hero_image") ? (
              <div className="relative aspect-[5/4] overflow-hidden rounded-xl">
                <Image src={get("about_hero_image")} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" unoptimized className="object-cover" />
              </div>
            ) : (
              <CoverStack books={books} priority />
            )}
          </div>
        </div>
      </section>

      {/* The shop in four figures — live counts, or the admin's own numbers from Stats Counter. */}
      {String(s.about_stats_enabled ?? "1") !== "0" && (
        <StatsCards
          books={totalBooks}
          authors={authors}
          categories={categories}
          custom={adminStats(s)}
          className="mt-16 lg:mt-20"
        />
      )}

      {values.length > 0 && (
        <section className="mt-16 lg:mt-20">
          {valuesHeading && (
            <div data-reveal className="mb-8 max-w-2xl">
              {get("about_values_eyebrow") && (
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-rose-600">{get("about_values_eyebrow")}</p>
              )}
              {get("about_values_title") && (
                <h2 className="mt-2 text-[1.7rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[2.1rem]">
                  {get("about_values_title")}
                </h2>
              )}
            </div>
          )}
          <div data-reveal-stagger className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {values.map((v, i) => (
              <div
                key={v.title || i}
                className={`group relative overflow-hidden rounded-[var(--radius-card)] p-7 transition-[translate,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-lift ${v.bg}`}
              >
                {/* A big, faint number in the corner gives each card its place in the set. */}
                <span aria-hidden className="pointer-events-none absolute -right-1 -top-4 select-none text-[5.5rem] font-semibold leading-none tracking-[-0.05em] text-white/80">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-soft transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 ${v.color}`}
                >
                  <v.Icon className="h-6 w-6" />
                </span>
                <h3 className="relative mt-6 text-[17px] font-semibold text-ink">{v.title}</h3>
                <p className="relative mt-2 text-[13.5px] leading-relaxed text-cocoa">{v.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Every testimonial, as cards — the home page shows them one at a time. */}
      {testimonials.length > 0 && String(s.about_testimonials_enabled ?? "1") !== "0" && (
        <TestimonialBand items={testimonials} title={String(s.home_testimonials_title ?? "").trim() || "What readers say"} className="mt-16 lg:mt-20" />
      )}
      {/* Founder — hidden entirely until admin fills it in */}
      {(get("about_founder_story") || get("about_founder_name")) && (
        <section data-reveal id="founder" className="card mt-16 grid gap-8 p-8 sm:p-10 md:grid-cols-[280px_1fr] lg:mt-20">
          <div className="relative mx-auto w-full max-w-[280px]">
            {/* A tilted blush mat behind the portrait. */}
            <span aria-hidden className="absolute -inset-3 -rotate-3 rounded-2xl bg-blush-100" />
            <div className="relative aspect-square overflow-hidden rounded-xl bg-blush-150">
              {get("about_founder_image") ? (
                <Image src={get("about_founder_image")} alt={get("about_founder_name") || "Founder"} fill sizes="280px" unoptimized className="object-cover" />
              ) : (
                <BookOpenIcon className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 text-rose-300" />
              )}
            </div>
          </div>
          <div className="flex flex-col justify-center">
            {get("about_founder_eyebrow") && (
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-rose-600">{get("about_founder_eyebrow")}</p>
            )}
            {get("about_founder_heading") && (
              <h2 className="mt-2 text-[1.8rem] font-semibold leading-tight text-ink">
                {highlight(get("about_founder_heading"), get("about_founder_highlight"))}
              </h2>
            )}
            {(get("about_founder_name") || get("about_founder_role")) && (
              <p className="mt-2 text-[13px] text-cocoa">
                <span className="font-semibold text-ink">{get("about_founder_name")}</span>
                {get("about_founder_name") && get("about_founder_role") && " — "}
                {get("about_founder_role")}
              </p>
            )}
            {get("about_founder_story") && (
              /* Authored in the admin panel, HTML allowed. Only an admin can set it. */
              <div className="about-story mt-5 text-[14px] leading-relaxed text-cocoa" dangerouslySetInnerHTML={{ __html: get("about_founder_story") }} />
            )}
          </div>
        </section>
      )}
    </>
  );
}

