import Link from "next/link";
import Image from "@/components/Image";
import type { Category, Deal, ProductCard as ProductCardType } from "@/lib/types";
import { dealTheme } from "@/lib/deal-themes";
import { safeHref } from "@/lib/safe-href";
import { money } from "@/lib/format";
import { ProductCard } from "../ProductCard";
import { ProductImage } from "../ProductImage";
import { BookOpenIcon, BookStackIcon, ChevronIcon, DeliveryVanIcon, QuillIcon, QuoteIcon, ShelfIcon } from "../icons";
import { Stars } from "../ui";
import { Doodle, DottedPaper, OpenBook, Ring, Sparkle } from "./doodles";
import { BookRail, Countdown, DealsSlider, type Testimonial } from "./bookory-client";
import { Marquee } from "../Marquee";

/** Section title on the left, a hairline, and a coral "View All" pill. */
export function SectionHead({ title, href, label = "View All" }: { title: string; href?: string; label?: string }) {
  return (
    <div data-reveal className="mb-8 flex items-center gap-6">
      <h2 className="shrink-0 text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.85rem]">{title}</h2>
      <span aria-hidden className="hidden h-px flex-1 bg-blush-200 sm:block" />
      {href && (
        <Link
          href={href}
          className="group/va ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-5 py-2.5 text-[12.5px] font-semibold text-white transition-all hover:bg-rose-700 hover:shadow-[0_10px_24px_-10px_rgba(4,43,82,0.45)] sm:ml-0"
        >
          {label}
          <ChevronIcon className="h-3 w-3 -rotate-90 transition-transform group-hover/va:translate-x-0.5" strokeWidth={2.4} />
        </Link>
      )}
    </div>
  );
}

export function RailSection({ title, href, products }: { title: string; href: string; products: ProductCardType[] }) {
  if (products.length === 0) return null;
  return (
    <section className="container-shop pt-16 lg:pt-20">
      <SectionHead title={title} href={href} />
      <BookRail products={products} />
    </section>
  );
}

/** Small horizontal book row: cover, title, stars, author, price. */
function BookRow({ p, tall = false }: { p: ProductCardType; tall?: boolean }) {
  return (
    <Link href={`/product/${p.slug}`} className="group flex items-center gap-5">
      <span className={`relative shrink-0 overflow-hidden rounded-lg bg-blush-150 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-soft ${tall ? "w-[110px]" : "w-[88px]"}`}>
        <span className="block pb-[140%]" />
        <ProductImage product={p} sizes="110px" showLabel />
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink transition-colors group-hover:text-rose-600">{p.name}</span>
        <span className="mt-1.5 flex items-center gap-1.5">
          <Stars rating={p.rating_avg} className="h-3 w-3" />
          <span className="text-[11.5px] text-ink">{p.rating_count}</span>
        </span>
        {p.author && <span className="mt-1 block truncate text-[12px] text-fog">{p.author}</span>}
        <span className="mt-2 flex items-baseline gap-2">
          <span className="text-[17px] font-semibold text-rose-600">{money(p.price)}</span>
          {p.compare_at_price && <span className="text-[12px] text-fog line-through">{money(p.compare_at_price)}</span>}
        </span>
      </span>
    </Link>
  );
}

/** Shown when admin → Deals has no live offer with reduced books on its shelf. */
const DEFAULT_DEAL: Deal = {
  id: 0,
  eyebrow: "This week only",
  heading: "Save up to {discount}% on books",
  highlight: null,
  description: "Hand-picked titles at reduced prices. Hurry — the deals run out soon.",
  ends_label: "Ends Sunday midnight",
  ends_at: null,
  button_text: null,
  button_url: null,
  category: null,
  theme: "coral",
  is_active: true,
  sort_order: 0,
};

/** The best saving among some books, in whole percent. */
function bestSaving(books: ProductCardType[]) {
  return Math.max(0, ...books.map((p) => (p.compare_at_price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0)));
}

/**
 * Splits a deal heading for its underline. "{discount}" becomes the best
 * saving and the underline runs from it to the end; without one, the deal's
 * highlight words are underlined wherever they appear in the heading.
 */
function dealHeading(heading: string, highlight: string | null, discount: number) {
  const fill = (text: string) => text.split("{discount}").join(String(discount));
  const at = heading.indexOf("{discount}");
  if (at >= 0) return { lead: fill(heading.slice(0, at)), marked: fill(heading.slice(at)), tail: "" };
  const words = (highlight ?? "").trim();
  const i = words ? heading.toLowerCase().indexOf(words.toLowerCase()) : -1;
  if (i < 0) return { lead: heading, marked: "", tail: "" };
  return { lead: heading.slice(0, i), marked: heading.slice(i, i + words.length), tail: heading.slice(i + words.length) };
}

/**
 * One offer: its colourway, words, optional button and countdown. On desktop
 * the panel stretches to the height of the book list beside it, so its
 * content is centred top to bottom. It is also a size container: the
 * countdown moves beside the words only once the panel is wide enough
 * (@2xl), and the heading scales with the panel (cqi).
 */
function DealPanel({ deal, discount }: { deal: Deal; discount: number }) {
  const t = dealTheme(deal.theme);
  const { lead, marked, tail } = dealHeading(deal.heading, deal.highlight, discount);
  const text = deal.description?.split("{discount}").join(String(discount));
  const href = deal.button_text ? safeHref(deal.button_url) : null;
  const buttonClass = `mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-semibold shadow-soft transition-colors ${t.button}`;
  const buttonLabel = (
    <>
      {deal.button_text}
      <ChevronIcon className="h-3.5 w-3.5 -rotate-90" strokeWidth={2.2} />
    </>
  );

  return (
    <div
      className={`@container relative flex h-full flex-col justify-center overflow-hidden rounded-[var(--radius-hero)] px-7 pb-14 pt-10 text-white sm:px-12 sm:py-14 lg:min-h-[26rem] ${t.panel}`}
    >
      {/* Tucked into the corners, clear of the "Ends …" line above the countdown. */}
      <span aria-hidden className={`blob-drift absolute -right-16 -top-28 h-64 w-64 rounded-full ${t.blobA}`} />
      <span aria-hidden className={`blob-drift absolute -bottom-24 left-1/3 h-56 w-[28rem] rounded-[50%] [animation-delay:-5s] ${t.blobB}`} />
      <div className="relative grid items-end gap-8 @2xl:grid-cols-[1fr_auto]">
        <div className="deal-copy">
          {deal.eyebrow && <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/90">{deal.eyebrow}</p>}
          <h3 className="mt-3 text-[clamp(2rem,6.4cqi,3.1rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-white">
            {lead}
            {marked && (
              <span className="relative inline-block">
                {marked}
                <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className={`absolute -bottom-1 left-0 h-3 w-full ${t.underline}`}>
                  <path d="M3 8c40-6 110-8 194-3" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            )}
            {tail}
          </h3>
          {text && <p className="mt-4 max-w-md text-[13.5px] font-medium text-white/90 @2xl:text-[14.5px]">{text}</p>}
          {href &&
            (/^https?:/i.test(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass}>
                {buttonLabel}
              </a>
            ) : (
              <Link href={href} className={buttonClass}>
                {buttonLabel}
              </Link>
            ))}
        </div>
        <div className="@2xl:text-right">
          {deal.ends_label && <p className="mb-3 text-[12.5px] font-semibold text-white">{deal.ends_label}</p>}
          <Countdown endsAt={deal.ends_at} className={t.timer} />
        </div>
      </div>
    </div>
  );
}

/** The offer's books — its three biggest savings. */
function DealList({ books }: { books: ProductCardType[] }) {
  return (
    <ul className="deal-books flex flex-col divide-y divide-blush-200">
      {books.slice(0, 3).map((p) => (
        <li key={p.id} className="py-4 first:pt-0 last:pb-0">
          <BookRow p={p} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Deals Of The Week: the offers from admin → Deals, one after another every
 * five seconds, each beside its own books — the whole shop's reduced books or
 * one shelf's, biggest saving first. An offer whose shelf has nothing reduced
 * is skipped, so "{discount}" is always a real saving.
 */
export function DealsOfTheWeek({ deals, offers, title }: { deals: ProductCardType[]; offers: Deal[]; title: string }) {
  if (deals.length === 0) return null;
  const shelf = (o: Deal) => (o.category ? deals.filter((p) => p.category?.slug === o.category?.slug) : deals);
  let slides = offers.map((o) => ({ o, books: shelf(o) })).filter((x) => x.books.length > 0);
  if (slides.length === 0) slides = [{ o: DEFAULT_DEAL, books: deals }];

  return (
    <section className="container-shop pt-16 lg:pt-20">
      <SectionHead title={title} href="/collection?sort=price_asc" />
      <DealsSlider
        slides={slides.map(({ o, books }) => {
          const discount = bestSaving(books);
          const { lead, marked, tail } = dealHeading(o.heading, o.highlight, discount);
          return {
            id: o.id,
            label: `${lead}${marked}${tail}`.trim(),
            panel: <DealPanel deal={o} discount={discount} />,
            list: <DealList books={books} />,
          };
        })}
      />
    </section>
  );
}

const TREND_TINTS = ["bg-[#eaf0f7]", "bg-[#f8f2e3]", "bg-[#e6eef9]", "bg-[#eef2f6]"];

/** Tinted cards, one book each — Bookory's "What's In Trend". One per view on phones, two on tablets, three on desktop; the rest scroll. */
export function TrendSection({ products, title = "What's In Trend" }: { products: ProductCardType[]; title?: string }) {
  if (products.length === 0) return null;
  return (
    <section className="container-shop pt-16 lg:pt-20">
      <SectionHead title={title} href="/collection?sort=rating" />
      <div data-reveal-stagger className="scrollbar-hidden -mx-1 flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pt-2 pb-3">
        {products.map((p, i) => (
          <Link
            key={p.id}
            href={`/product/${p.slug}`}
            className={`group flex w-[88%] shrink-0 snap-start items-center gap-6 rounded-[var(--radius-hero)] p-5 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-soft sm:w-[calc(50%-0.75rem)] sm:p-6 lg:w-[calc((100%-3rem)/3)] lg:gap-5 lg:p-5 ${TREND_TINTS[i % TREND_TINTS.length]}`}
          >
            <span className="relative w-[38%] max-w-[150px] shrink-0 overflow-hidden rounded-lg shadow-soft transition-transform duration-500 group-hover:-rotate-2 group-hover:scale-[1.03] lg:w-[36%]">
              <span className="block pb-[140%]" />
              <ProductImage product={p} sizes="150px" />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 text-[16px] font-semibold leading-snug text-ink transition-colors group-hover:text-rose-600 sm:text-[17px]">
                {p.name}
              </span>
              <span className="mt-2 flex items-center gap-1.5">
                <Stars rating={p.rating_avg} className="h-3 w-3" />
                <span className="text-[11.5px] text-ink">{p.rating_count}</span>
              </span>
              {p.author && <span className="mt-1.5 block text-[12px] text-fog">{p.author}</span>}
              {p.tagline && <span className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-cocoa">{p.tagline}</span>}
              <span className="mt-4 block text-[18px] font-semibold text-rose-600">{money(p.price)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * What readers say — on the home page and the About page alike: every
 * testimonial from admin → Testimonials as a white card, the row gliding
 * left to right on a peach, doodled ground (a row that fits simply sits
 * centred; it pauses under the pointer and holds still for reduced motion).
 * Hidden without testimonials. `className` places it: the home page wraps it
 * in the page container, the About page is already inside one.
 */
export function TestimonialBand({
  items,
  title = "What readers say",
  className = "container-shop mt-16 lg:mt-20",
}: {
  items: Testimonial[];
  title?: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={className}>
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[#cfdeef] px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(45%_70%_at_85%_10%,rgba(255,255,255,0.5),transparent_70%),radial-gradient(90%_120%_at_0%_0%,#dde8f5_0%,#cfdeef_55%,#c0d3ea_100%)]" />
          <DottedPaper dot="rgba(4,43,82,0.12)" />
          <span className="blob-drift absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/50 blur-3xl" />
          <span className="blob-drift absolute -bottom-28 left-[18%] h-64 w-64 rounded-full bg-rose-300/40 blur-3xl [animation-delay:-6s]" />
          <QuoteIcon className="absolute left-[1%] top-[3%] h-16 w-16 text-white/70 md:h-24 md:w-24" />
          <QuoteIcon className="absolute bottom-[3%] right-[1%] h-16 w-16 rotate-180 text-white/70 md:h-24 md:w-24" />
          <Ring className="-right-24 -top-28 h-56 w-56 md:h-72 md:w-72" stroke="#ffffff" opacity={0.7} />
          <Sparkle className="right-[8%] top-[18%] w-3" delay="-5s" fill="#5b7bd5" opacity={0.6} />
          <Sparkle className="left-[40%] top-[6%] w-3 max-md:hidden" delay="-3s" fill="#ffffff" opacity={0.8} />
        </div>
        <div className="relative">
          <div data-reveal className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-rose-800">Readers</p>
            <h2 className="mt-2 text-[1.7rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[2.1rem]">{title}</h2>
          </div>
          <Marquee count={items.length} className="mt-8">
            {items.map((t) => (
              <li key={t.id} className="flex w-[300px] shrink-0 flex-col rounded-2xl bg-white p-6 shadow-soft sm:w-[360px] sm:p-7">
                <QuoteIcon className="h-7 w-7 text-rose-300" />
                <blockquote className="mt-3 text-[15px] font-semibold leading-relaxed text-ink">&ldquo;{t.content}&rdquo;</blockquote>
                {t.rating > 0 && <Stars rating={t.rating} className="mt-4 h-3.5 w-3.5" />}
                <p className="mt-auto pt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">
                  {t.name}
                  {(t.designation || t.location) && (
                    <span className="font-normal text-fog"> / {[t.designation, t.location].filter(Boolean).join(", ")}</span>
                  )}
                </p>
              </li>
            ))}
          </Marquee>
        </div>
      </section>
    </div>
  );
}

export function GridSection({ title, href, products: all }: { title: string; href: string; products: ProductCardType[] }) {
  // Whole rows of the 6-column desktop grid, so no orphans dangle on the last line.
  const products = all.length >= 12 ? all.slice(0, 12) : all.length >= 6 ? all.slice(0, 6) : all;
  if (products.length === 0) return null;
  return (
    <section className="container-shop pt-16 lg:pt-20">
      <SectionHead title={title} href={href} />
      <div data-reveal-stagger className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

/**
 * Navy, blues and a deep gold — the logo's colours — for tiles and monograms.
 * They carry white text, so every pair reads at 4.5:1 or better.
 */
export const GENRE_TINTS = [
  ["#2b5d92", "#1b4675"],
  ["#8f6a1f", "#6e5218"],
  ["#5c7896", "#46607c"],
  ["#0d4377", "#042b52"],
  ["#3f6fa8", "#2c5a91"],
  ["#1b4675", "#0a2d52"],
  ["#4b6a88", "#3a5671"],
  ["#33507a", "#243d60"],
];

/**
 * Colourful category tiles — Bookory's "Genres Books". Each tile sits on a
 * soft shadow that deepens on hover; over a photo, a dark wash rises from the
 * bottom so the white name and count read clearly on any picture.
 */
export function GenreTiles({
  categories,
  title = "Browse By Genre",
}: {
  categories: (Category & { image?: string | null })[];
  title?: string;
}) {
  const cats = categories.filter((c) => c.products_count > 0);
  if (cats.length === 0) return null;
  return (
    <section className="container-shop pt-16 lg:pt-20">
      <SectionHead title={title} href="/collection" />
      <div data-reveal-stagger className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        {cats.slice(0, 8).map((c, i) => {
          const [from, to] = GENRE_TINTS[i % GENRE_TINTS.length];
          return (
            <Link
              key={c.id}
              href={`/collection?category=${c.slug}`}
              className="group relative flex aspect-[16/9] flex-col justify-end overflow-hidden rounded-[var(--radius-card)] p-4 text-white shadow-[0_12px_28px_-14px_rgba(0,0,0,0.45)] ring-1 ring-black/5 transition-[translate,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_46px_-16px_rgba(0,0,0,0.5)] sm:p-5"
              style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
            >
              {c.image ? (
                <Image src={c.image} alt="" fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <BookOpenIcon className="absolute -right-4 -top-4 h-32 w-32 text-white/15 transition-transform duration-500 group-hover:scale-110" strokeWidth={1.2} />
              )}
              {/* A dark wash rising from the bottom, so the words read on any photo. */}
              <span
                aria-hidden
                className={`absolute inset-0 ${
                  c.image
                    ? "bg-[linear-gradient(to_top,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.5)_35%,rgba(0,0,0,0.1)_65%,transparent_82%)]"
                    : "bg-[linear-gradient(to_top,rgba(0,0,0,0.22)_0%,transparent_60%)]"
                }`}
              />
              <span className="relative transition-transform duration-300 group-hover:-translate-y-1">
                <span className="block text-[15px] font-bold leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] sm:text-[19px]">{c.name}</span>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/30 backdrop-blur-sm sm:text-[11.5px]">
                  {c.products_count} {c.products_count === 1 ? "book" : "books"}
                  <ChevronIcon className="h-2.5 w-2.5 -rotate-90 transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/** Initials avatar for an author — no portrait photos are invented. */
function AuthorAvatar({ name, index }: { name: string; index: number }) {
  const initials = name
    .replace(/[^A-Za-z\s.&]/g, "")
    .split(/[\s.&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const [from, to] = GENRE_TINTS[index % GENRE_TINTS.length];
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[14px] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      {initials || "A"}
    </span>
  );
}

/**
 * "Popular Authors" panel beside a "Keep Reading" list. Every author with
 * books is listed; the list scrolls inside the panel (fading out at the
 * bottom) so the panel stays level with Keep Reading, and a button leads on
 * to the full Authors page.
 */
export function AuthorsAndReading({
  authors,
  reading,
  authorsTitle = "Popular Authors",
  readingTitle = "Keep Reading",
}: {
  /** From admin → Categories & Authors: a photo when one is set, else initials. */
  authors: { name: string; count: number; photo?: string | null; slug?: string }[];
  reading: ProductCardType[];
  authorsTitle?: string;
  readingTitle?: string;
}) {
  if (authors.length === 0 && reading.length === 0) return null;
  const [lead, ...rest] = reading;
  return (
    <section className="container-shop pt-16 lg:pt-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
        {authors.length > 0 && (
          <div data-reveal className="flex flex-col rounded-[var(--radius-hero)] bg-blush-50 p-7">
            <h2 className="border-b border-blush-200 pb-4 text-[1.2rem] font-semibold text-ink">{authorsTitle}</h2>
            <ul className="soft-scroll -mr-3 mt-2 max-h-[26rem] overflow-y-auto pb-10 pr-3 [mask-image:linear-gradient(to_bottom,#000_86%,transparent)] lg:max-h-[30rem]">
              {authors.map((a, i) => (
                <li key={a.name}>
                  <Link
                    href={a.slug ? `/collection?author=${encodeURIComponent(a.slug)}` : `/collection?search=${encodeURIComponent(a.name)}`}
                    className="group flex items-center gap-4 py-3"
                  >
                    {a.photo ? (
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-blush-150 shadow-soft">
                        <Image src={a.photo} alt="" fill sizes="48px" className="object-cover" />
                      </span>
                    ) : (
                      <AuthorAvatar name={a.name} index={i} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink transition-colors group-hover:text-rose-600">{a.name}</span>
                      <span className="text-[12px] text-fog">{a.count} {a.count === 1 ? "book" : "books"}</span>
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-ink transition-all group-hover:translate-x-1 group-hover:bg-rose-600 group-hover:text-white">
                      <ChevronIcon className="h-3 w-3 -rotate-90" strokeWidth={2.4} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/authors"
              className="group/all mt-5 inline-flex items-center gap-2 self-start rounded-full bg-rose-600 px-5 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-rose-700"
            >
              View all authors
              <ChevronIcon className="h-3 w-3 -rotate-90 transition-transform group-hover/all:translate-x-0.5" strokeWidth={2.4} />
            </Link>
          </div>
        )}

        {lead && (
          <div>
            <SectionHead title={readingTitle} href="/collection" />
            <Link data-reveal href={`/product/${lead.slug}`} className="group flex flex-col gap-6 border-b border-blush-200 pb-8 sm:flex-row sm:items-center">
              <span className="relative w-[150px] shrink-0 overflow-hidden rounded-lg shadow-soft transition-transform duration-500 group-hover:-rotate-2 group-hover:scale-[1.03]">
                <span className="block pb-[140%]" />
                <ProductImage product={lead} sizes="150px" />
              </span>
              <span className="min-w-0">
                <span className="text-[1.3rem] font-semibold text-ink transition-colors group-hover:text-rose-600">{lead.name}</span>
                <span className="mt-2 flex items-center gap-1.5">
                  <Stars rating={lead.rating_avg} className="h-3 w-3" />
                  <span className="text-[11.5px] text-ink">{lead.rating_count}</span>
                </span>
                {lead.author && <span className="mt-1.5 block text-[12.5px] text-fog">{lead.author}</span>}
                {lead.tagline && <span className="mt-3 block text-[13.5px] leading-relaxed text-cocoa">{lead.tagline}</span>}
                <span className="mt-4 block text-[1.3rem] font-semibold text-rose-600">{money(lead.price)}</span>
              </span>
            </Link>
            <ul data-reveal-stagger className="mt-8 grid gap-6 sm:grid-cols-2">
              {rest.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <BookRow p={p} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The shop in four figures on a deep-green band: parchment type, mustard line
 * icons, a drawn book in the corner. Real counts only, or the admin's own
 * numbers from Stats Counter.
 */
export function StatsCards({
  books,
  authors,
  categories,
  custom,
  className = "container-shop pt-16 lg:pt-20",
}: {
  books: number;
  authors: number;
  categories: number;
  /** Admin → Stats Counter values; replace the live counts when set. */
  custom?: { value: string; label: string }[] | null;
  /** Wrapper classes — the About page is already inside the shop container. */
  className?: string;
}) {
  const live = [
    { value: books.toLocaleString("en-IN"), label: "Total Books", Icon: BookStackIcon },
    { value: authors.toLocaleString("en-IN"), label: "Authors", Icon: QuillIcon },
    { value: categories.toLocaleString("en-IN"), label: "Categories", Icon: ShelfIcon },
    { value: "Pan-India", label: "Delivery", Icon: DeliveryVanIcon },
  ];
  const stats = custom
    ? custom.slice(0, 4).map((c, i) => ({ ...live[i % live.length], value: c.value, label: c.label }))
    : live;
  return (
    <section className={className}>
      <div data-reveal className="relative overflow-hidden rounded-[var(--radius-hero)] bg-pine-900 px-6 py-9 sm:px-10 lg:px-14 lg:py-12">
        {/* A gold glow top right, a light-blue one bottom left, pale dots and a drawn book. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_100%_0%,rgba(232,176,75,0.18),transparent_65%),radial-gradient(60%_80%_at_0%_100%,rgba(141,177,220,0.16),transparent_65%)]" />
          <DottedPaper dot="rgba(232,238,246,0.14)" />
          <Doodle className="-bottom-6 right-[4%] w-36 max-md:hidden lg:w-44" delay="-2s" viewBox="0 0 160 100">
            <OpenBook stroke="#e8b04b" opacity={0.3} />
          </Doodle>
          <Ring className="-left-20 -top-24 h-56 w-56" stroke="#e8eef6" opacity={0.18} />
          <Sparkle className="left-[45%] top-[14%] w-3 max-md:hidden" delay="-4s" fill="#e8b04b" opacity={0.7} />
          <Sparkle className="bottom-[16%] right-[30%] w-3 max-lg:hidden" delay="-1s" fill="#e8eef6" opacity={0.6} />
        </div>
        <ul className="relative grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-parchment/15">
          {stats.map(({ value, label, Icon }) => (
            <li key={label} className="group flex flex-col gap-4 lg:px-8 lg:first:pl-0 lg:last:pr-0">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-mustard/50 bg-mustard/10 text-mustard transition-colors duration-300 group-hover:bg-mustard/20">
                <Icon className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <span className="text-[2rem] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[2.6rem]">{value}</span>
              <span className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-parchment/70">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

interface BlogCard {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  thumbnail: string | null;
  category: string | null;
  published_at: string | null;
}

/** Latest posts from admin → Blog, three to a row. Hidden until posts exist. */
export function LatestPosts({ posts, title = "From The Blog" }: { posts: BlogCard[]; title?: string }) {
  if (posts.length === 0) return null;
  return (
    <section className="container-shop pt-16 lg:pt-20">
      <SectionHead title={title} href="/blog" />
      <div data-reveal-stagger className="grid gap-8 md:grid-cols-3">
        {posts.slice(0, 3).map((p) => (
          <Link key={p.id} href={`/blog/${p.slug}`} className="group">
            <span className="relative block aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] bg-blush-100">
              {p.thumbnail ? (
                <Image src={p.thumbnail} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <BookOpenIcon className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-rose-300" />
              )}
            </span>
            <span className="mt-4 flex items-center gap-3 text-[12px] text-fog">
              {p.category && <span className="font-semibold uppercase tracking-[0.08em] text-rose-600">{p.category}</span>}
              {p.published_at && (
                <time dateTime={p.published_at}>
                  {new Date(p.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </time>
              )}
            </span>
            <span className="mt-2 block text-[17px] font-semibold leading-snug text-ink transition-colors group-hover:text-rose-600">{p.title}</span>
            {p.excerpt && <span className="mt-2 line-clamp-2 block text-[13.5px] leading-relaxed text-cocoa">{p.excerpt}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
