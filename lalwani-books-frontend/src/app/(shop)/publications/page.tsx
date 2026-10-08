import type { Metadata } from "next";
import Link from "next/link";
import Image from "@/components/Image";
import { PageBanner } from "@/components/PageBanner";
import { ProductImage } from "@/components/ProductImage";
import { ChevronIcon } from "@/components/icons";
import { Doodle, DottedPaper, OpenBook, Ring, Sparkle } from "@/components/home/doodles";
import { api } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import type { Publisher, PublisherBook } from "@/lib/types";

export const metadata: Metadata = {
  title: "Publications",
  description: "Every publisher on our shelves, each with all of their books we stock.",
};

export const revalidate = 300;

/**
 * Each publisher's colour, taken round in admin order: the footer's book-spine
 * palette. `spine`/`deep` paint the spine, `soft` the wash behind the books,
 * `ink` the seal and label, `text` the name printed on a spine in the pile.
 */
const IMPRINTS = [
  { spine: "#f65d4e", deep: "#d9473a", soft: "#feebe8", ink: "#b8382a", text: "#ffffff" },
  { spine: "#2f7f7a", deep: "#236460", soft: "#e2f1ef", ink: "#1f5a56", text: "#ffffff" },
  { spine: "#e8b04b", deep: "#cf9532", soft: "#fbf1dc", ink: "#7f5510", text: "#3d2a05" },
  { spine: "#8a5a78", deep: "#704660", soft: "#f2e8ef", ink: "#5f3a52", text: "#ffffff" },
  { spine: "#4b6a88", deep: "#3a5671", soft: "#e6edf4", ink: "#2f4a63", text: "#ffffff" },
  { spine: "#c4552f", deep: "#a64323", soft: "#f8e7e0", ink: "#8f3a1e", text: "#ffffff" },
  { spine: "#5aae95", deep: "#43927a", soft: "#e2f3ed", ink: "#22705a", text: "#0f2e25" },
  { spine: "#f08a6a", deep: "#d86f4f", soft: "#fdeee8", ink: "#a9482a", text: "#3f160a" },
];
type Tone = (typeof IMPRINTS)[number];
const toneOf = (index: number): Tone => IMPRINTS[index % IMPRINTS.length];

/**
 * /publications — every publisher from admin → Publishers, in the order set
 * there, each card leading to that publisher's shelf in the shop.
 *
 * Drawn as books, so it doesn't look like the Authors page (round portraits
 * on centred cards): the opening band stacks a pile of books with publishers'
 * names on their spines, and each card is a hardcover-style plate with a
 * coloured spine, the publisher's seal and name, and a little shelf of their
 * real covers. A publisher with no live book still appears, with an empty
 * shelf. No book counts on the cards — the owner asked for counts to be hidden.
 */
export default async function PublicationsPage() {
  const publishers = await api<{ data: Publisher[] }>("/publishers", { revalidate: 300 })
    .then((r) => r.data)
    .catch(() => [] as Publisher[]);
  const books = publishers.reduce((n, p) => n + p.products_count, 0);

  return (
    <div className="flex flex-col gap-8">
      <PageBanner title="Publications" crumbs={[{ label: "Publications" }]} />

      <PublicationsHero publishers={publishers} books={books} />

      {publishers.length === 0 ? (
        <div className="card px-8 py-16 text-center">
          <p className="font-serif text-[1.4rem] text-ink">No publishers yet</p>
          <p className="mt-2 text-[13px] text-cocoa">Publishers appear here as books are added to the shop.</p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {publishers.map((p, i) => (
            <PublisherCard key={p.id} publisher={p} tone={toneOf(i)} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The opening band: the words and two figures on the left, and on the right a
 * pile of books with the biggest publishers' names on their spines (a shorter
 * pile under the words on phones), over the home page's warm, doodled backdrop.
 */
function PublicationsHero({ publishers, books }: { publishers: Publisher[]; books: number }) {
  // The publishers with the most books, admin order otherwise; each keeps its card's colour.
  const pile = publishers
    .map((p, i) => ({ p, tone: toneOf(i), i }))
    .sort((a, b) => b.p.products_count - a.p.products_count || a.i - b.i)
    .slice(0, 6);

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-blush-100">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* The translucent glow is listed first so it paints on top of the opaque wash. */}
        <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(255,255,255,0.7),transparent_70%),radial-gradient(120%_100%_at_0%_100%,#fde3da_0%,#fcf1ed_55%,#fbf6f2_100%)]" />
        <DottedPaper dot="rgba(199,58,42,0.16)" />
        <span className="blob-drift absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#9fd8c4]/30 blur-3xl" />
        <span className="blob-drift absolute -bottom-24 right-[30%] h-56 w-56 rounded-full bg-[#ffd44d]/20 blur-3xl [animation-delay:-6s]" />
        <Ring className="-bottom-20 -right-16 h-56 w-56" stroke="#2f7f7a" opacity={0.22} />
        <Sparkle className="right-[8%] top-[10%] w-4" delay="-2.5s" fill="#f65d4e" opacity={0.5} />
        <Sparkle className="left-[2%] bottom-[12%] w-3" delay="-5s" fill="#e8b04b" opacity={0.65} />
        <Sparkle className="right-[44%] bottom-[10%] w-3 max-md:hidden" delay="-3.5s" fill="#2f7f7a" opacity={0.45} />
      </div>

      <div className="relative grid items-center gap-8 px-6 py-9 sm:px-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-12">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rose-600">Publications</p>
          <h2 className="mt-2 text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.6rem]">
            The <span className="text-rose-600">publishers</span> on our shelves
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-cocoa">
            Trusted Indian and international publishing houses &mdash; pick one to see every title of theirs we stock.
          </p>
          {publishers.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Figure value={publishers.length} label={publishers.length === 1 ? "publisher" : "publishers"} />
              <Figure value={books} label={books === 1 ? "book" : "books"} />
            </div>
          )}
          {/* Phones: a shorter pile under the words. */}
          {pile.length > 0 && <BookPile items={pile.slice(0, 4)} compact className="mt-7 max-w-sm md:hidden" />}
        </div>

        {pile.length > 0 && (
          <div className="relative hidden md:block">
            <span aria-hidden className="absolute left-1/2 top-1/2 h-60 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60 blur-2xl" />
            <Doodle className="-top-12 right-[14%] w-24 lg:w-28" delay="-1.5s" viewBox="0 0 160 100">
              <OpenBook stroke="#c73a2a" opacity={0.35} />
            </Doodle>
            <BookPile items={pile} className="float-y relative" />
          </div>
        )}
      </div>
    </section>
  );
}

/** Widths, nudges and tilts for a hand-stacked pile, top book first; the widest lies at the bottom. */
const PILE = [
  { width: "66%", shift: "17%", tilt: "1.6deg" },
  { width: "78%", shift: "8%", tilt: "-1.2deg" },
  { width: "72%", shift: "14%", tilt: "0.7deg" },
  { width: "86%", shift: "4%", tilt: "-0.9deg" },
  { width: "80%", shift: "10%", tilt: "1deg" },
  { width: "94%", shift: "1%", tilt: "-0.4deg" },
];

/**
 * Books lying one on another, spine out, each printed with a publisher's name
 * in that publisher's colour — the biggest list at the bottom. Decorative: the
 * same publishers are listed, as links, in the cards below.
 */
function BookPile({ items, compact = false, className = "" }: { items: { p: Publisher; tone: Tone }[]; compact?: boolean; className?: string }) {
  const shapes = PILE.slice(PILE.length - items.length);
  return (
    <div aria-hidden className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"} ${className}`}>
      {[...items].reverse().map(({ p, tone }, n) => {
        const { width, shift, tilt } = shapes[n];
        // A book grows past its place in the pile when the name needs it (about
        // 0.8em a letter in capitals, plus the bands), but never past the band.
        const fit = `calc(${(p.name.length * 0.8).toFixed(1)}em + ${compact ? "2.9rem" : "3.6rem"})`;
        return (
          <span
            key={p.id}
            className={`relative flex items-center rounded-[7px] shadow-[0_8px_16px_-10px_rgba(0,0,0,0.55)] ${
              compact ? "h-9 text-[10px]" : "h-11 text-[11.5px] lg:text-[12px]"
            }`}
            style={{
              width: `min(calc(100% - ${shift}), max(${width}, ${fit}))`,
              marginLeft: shift,
              transform: `rotate(${tilt})`,
              background: `linear-gradient(180deg, ${tone.spine}, ${tone.deep})`,
            }}
          >
            {/* Head and tail bands, and a light along the top edge. */}
            <span className="absolute inset-y-[24%] left-2.5 w-[3px] rounded-full bg-white/45" />
            <span className="absolute inset-y-[24%] left-[1.1rem] w-px bg-white/35" />
            <span className="absolute inset-y-[24%] right-2.5 w-[3px] rounded-full bg-white/45" />
            <span className="absolute inset-x-3 top-0 h-px bg-white/40" />
            <span
              className={`min-w-0 truncate font-semibold uppercase ${compact ? "pl-7 pr-4 tracking-[0.08em]" : "pl-8 pr-6 tracking-[0.14em]"}`}
              style={{ color: tone.text }}
            >
              {p.name}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** One figure in a white pill: the number, then what it counts. */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-white px-4 py-2 shadow-soft">
      <span className="text-[1.15rem] font-semibold text-ink">{value}</span>
      <span className="text-[12.5px] text-fog">{label}</span>
    </span>
  );
}

/**
 * A publisher as a hardcover plate: their colour down the spine, their seal
 * and name, what they publish, and a little shelf of their covers that fans
 * out on hover. The whole card leads to their shelf in the shop.
 */
function PublisherCard({ publisher: p, tone }: { publisher: Publisher; tone: Tone }) {
  const books = (p.books ?? []).slice(0, 3);
  return (
    <li>
      <Link
        href={`/collection?publisher=${p.slug}`}
        className="group relative flex h-full min-h-[11.5rem] overflow-hidden rounded-[var(--radius-card)] bg-white shadow-soft ring-1 ring-blush-200/70 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift"
      >
        <Spine tone={tone} />

        <span className="relative z-[1] flex min-w-0 flex-1 flex-col py-5 pl-7 pr-1">
          <span className="flex items-center gap-2.5">
            <Seal publisher={p} tone={tone} />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: tone.ink }}>
              Publisher
            </span>
          </span>
          <span className="mt-3 line-clamp-2 text-[16px] font-semibold leading-snug text-ink transition-colors group-hover:text-rose-600 sm:text-[17px]">
            {p.name}
          </span>
          {p.description ? (
            <span className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-cocoa">{p.description}</span>
          ) : (
            books.length > 0 && <span className="mt-1.5 line-clamp-1 text-[12.5px] text-fog">{books.map((b) => b.name).join(" · ")}</span>
          )}
          <span className="mt-auto pt-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-blush-100 px-3.5 py-1.5 text-[12px] font-semibold text-rose-700 transition-colors group-hover:bg-rose-600 group-hover:text-white">
              View books
              <ChevronIcon className="h-3 w-3 -rotate-90 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
            </span>
          </span>
        </span>

        <Shelf books={books} tone={tone} />
      </Link>
    </li>
  );
}

/** The card's spine down its left edge, banded near the head and tail like a hardcover. */
function Spine({ tone }: { tone: Tone }) {
  return (
    <span aria-hidden className="absolute inset-y-0 left-0 w-2.5" style={{ background: `linear-gradient(90deg, ${tone.deep}, ${tone.spine})` }}>
      <span className="absolute inset-x-0 top-6 h-[3px] bg-white/50" />
      <span className="absolute inset-x-0 top-[2.05rem] h-px bg-white/40" />
      <span className="absolute inset-x-0 bottom-[2.05rem] h-px bg-white/40" />
      <span className="absolute inset-x-0 bottom-6 h-[3px] bg-white/50" />
    </span>
  );
}

/** The publisher's seal: their logo in a white roundel, or their initials stamped in their colour. */
function Seal({ publisher: p, tone }: { publisher: Publisher; tone: Tone }) {
  if (p.logo) {
    return (
      <span aria-hidden className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-blush-200">
        <Image src={p.logo} alt="" fill sizes="44px" className="object-contain p-1.5" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold tracking-[0.04em]"
      style={{ background: tone.soft, color: tone.ink, boxShadow: `inset 0 0 0 2px #fff, inset 0 0 0 3.5px ${tone.spine}66` }}
    >
      {initialsOf(p.name)}
    </span>
  );
}

/** Where each cover stands on the shelf (and how it fans out on hover), by how many there are. */
const FANS: Record<number, string[]> = {
  1: ["left-[38%] rotate-[4deg] group-hover:rotate-[8deg] group-hover:-translate-y-1"],
  2: [
    "left-[22%] -rotate-[6deg] group-hover:-rotate-[11deg] group-hover:-translate-x-1",
    "left-[47%] rotate-[5deg] group-hover:rotate-[10deg] group-hover:translate-x-1",
  ],
  3: [
    "left-[2%] -rotate-[9deg] group-hover:-rotate-[14deg] group-hover:-translate-x-1",
    "left-[22%] -rotate-[1deg] group-hover:-translate-y-1",
    "left-[42%] rotate-[7deg] group-hover:rotate-[11deg] group-hover:translate-x-0.5",
  ],
};

/**
 * A short shelf at the card's right: up to three of the publisher's covers,
 * with plain spines filling the gap when there are fewer. Decorative — the
 * titles are written out beside it.
 */
function Shelf({ books, tone }: { books: PublisherBook[]; tone: Tone }) {
  const fan = FANS[books.length] ?? [];
  // Plain spines standing at the left end of the shelf, tallest first.
  const spines = books.length === 0 ? 3 : books.length === 1 ? 2 : books.length === 2 ? 1 : 0;
  return (
    <span aria-hidden className="relative w-28 shrink-0 sm:w-[8.5rem]">
      <span className="absolute inset-0" style={{ background: `radial-gradient(90% 75% at 62% 62%, ${tone.soft} 0%, transparent 72%)` }} />
      {Array.from({ length: spines }, (_, n) => (
        <span
          key={n}
          className={`absolute bottom-[1.9rem] rounded-[3px] ${
            ["left-[6%] h-[4.4rem] w-3", "left-[19%] h-[3.9rem] w-2.5 origin-bottom-left rotate-[-7deg]", "left-[31%] h-[4.1rem] w-3"][n]
          }`}
          style={{ background: n === 1 ? tone.soft : `linear-gradient(90deg, ${tone.deep}, ${tone.spine})`, boxShadow: n === 1 ? `inset 0 0 0 1px ${tone.spine}55` : undefined }}
        />
      ))}
      {books.map((b, i) => (
        <span
          key={b.id}
          className={`absolute bottom-[1.9rem] h-[5.25rem] w-14 origin-bottom overflow-hidden rounded-[4px] bg-white shadow-[0_10px_18px_-8px_rgba(0,0,0,0.55)] ring-1 ring-black/5 transition-transform duration-500 ease-out sm:h-[5.6rem] sm:w-[3.75rem] ${fan[i]}`}
          style={{ zIndex: i + 1 }}
        >
          <ProductImage product={b} sizes="64px" showLabel={false} />
        </span>
      ))}
      {/* The shelf board. */}
      <span
        className="absolute bottom-[1.6rem] left-[2%] right-[6%] h-[5px] rounded-full shadow-[0_6px_10px_-6px_rgba(0,0,0,0.35)]"
        style={{ background: tone.spine, opacity: 0.32 }}
      />
    </span>
  );
}
