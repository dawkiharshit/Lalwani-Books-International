import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import Image from "@/components/Image";
import type { Category } from "@/lib/types";
import { BOOK_GENRES, DISCOVER_SHELVES, categoryForGenre, shelfBySlug, type Shelf } from "@/lib/shelves";
import { BookOpenIcon, BookStackIcon, ChevronIcon, GiftIcon, PaletteIcon, QuillIcon, SparkleIcon, StarIcon } from "../icons";
import { DottedPaper } from "./doodles";
import { GENRE_TINTS, SectionHead } from "./bookory";
import { TiltCard } from "./TiltCard";

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;
export type Cover = { image: string; name: string };
/** How many books a list holds, and a few of its covers. */
export type ShelfSummary = { count: number; covers: Cover[] };

/** Each shelf's icon and colours: the logo's navy, blues and deep gold. */
export const SHELF_LOOKS: Record<string, { Icon: IconType; tint: [string, string]; icon: string }> = {
  "new-arrivals": { Icon: SparkleIcon, tint: ["#3f6fa8", "#2c5a91"], icon: "text-mustard" },
  bestsellers: { Icon: StarIcon, tint: ["#0d4377", "#042b52"], icon: "text-mustard" },
  "lalwani-edit": { Icon: QuillIcon, tint: ["#8f6a1f", "#6e5218"], icon: "text-white" },
  "gift-ideas": { Icon: GiftIcon, tint: ["#5c7896", "#46607c"], icon: "text-mustard" },
  "non-fiction": { Icon: BookStackIcon, tint: ["#2b5d92", "#1b4675"], icon: "text-mustard" },
};

const books = (n: number) => `${n} ${n === 1 ? "book" : "books"}`;

const LIFT =
  "transition-[translate,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_46px_-16px_rgba(0,0,0,0.5)]";
const CARD = "rounded-[var(--radius-card)] text-white shadow-[0_12px_28px_-14px_rgba(0,0,0,0.45)] ring-1 ring-black/5";

interface GenreTileData {
  label: string;
  /** None while the shop has no books for it: the tile then says "Coming soon". */
  href?: string;
  count: number;
  image?: string | null;
}

/**
 * The eight genres, each from its category (name, books, picture). Non-Fiction
 * gathers the real-world subjects until the shop has a category of that name.
 */
function genreTiles(categories: (Category & { image?: string | null })[]): GenreTileData[] {
  const found = BOOK_GENRES.map((g) => {
    const c = categoryForGenre(g, categories);
    return { g, c: c && c.products_count > 0 ? c : undefined };
  });
  const shown = new Set(found.map((f) => f.c?.id));

  return found.map(({ g, c }) => {
    if (c) return { label: g.label, href: `/collection?category=${encodeURIComponent(c.slug)}`, count: c.products_count, image: c.image };
    const shelf = shelfBySlug(g.shelf);
    const slugs = shelf?.params.category?.split(",") ?? [];
    const within = categories.filter((x) => slugs.includes(x.slug) && x.products_count > 0);
    const count = within.reduce((n, x) => n + x.products_count, 0);
    if (!shelf || count === 0) return { label: g.label, count: 0 };
    // A picture no other tile is showing, when there is one.
    const pic = within.find((x) => x.image && !shown.has(x.id)) ?? within.find((x) => x.image);
    return { label: g.label, href: `/collection?shelf=${shelf.slug}`, count, image: pic?.image };
  });
}

function GroupLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h3 data-reveal className={`mb-4 flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.2em] text-rose-600 ${className}`}>
      <span aria-hidden className="h-[2px] w-7 rounded-full bg-mustard" />
      {children}
    </h3>
  );
}

function CountPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/30 backdrop-blur-sm sm:text-[11.5px]">
      {children}
    </span>
  );
}

const Arrow = () => (
  <ChevronIcon className="h-2.5 w-2.5 -rotate-90 transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
);

export type Spine = { name: string };

/** Spine colours that stand out on the navy tile: gold, cream, light and mid blues. */
const SPINE_LOOKS = [
  { bg: "#e8b04b", fg: "#042b52" },
  { bg: "#f3ede2", fg: "#0d4377" },
  { bg: "#3f6fa8", fg: "#ffffff" },
  { bg: "#c9d8ea", fg: "#042b52" },
  { bg: "#8f6a1f", fg: "#ffffff" },
  { bg: "#5c7896", fg: "#ffffff" },
  { bg: "#ffffff", fg: "#0d4377" },
];

/** A loose, hand-made pile: width, nudge and tilt per row, the widest at the bottom. */
const PILE = [
  { w: 76, x: 12, r: -1.4, slide: 8 },
  { w: 84, x: 3, r: 1, slide: -6 },
  { w: 79, x: 14, r: -0.6, slide: 14 },
  { w: 90, x: 5, r: 1.2, slide: -7 },
  { w: 86, x: 0, r: -0.9, slide: 9 },
  { w: 95, x: 4, r: 0.6, slide: -5 },
  { w: 100, x: 0, r: 0, slide: 4 },
];

/**
 * Real books from the shop as a pile of spines, like a stack on a bookshop
 * counter, each with its title. On hover
 * the spines slide out a little either way, one of them further, as if a
 * book is being pulled from the pile. Phones show the bottom four.
 */
function BookPile({ spines, className }: { spines: Spine[]; className: string }) {
  const rows = spines.slice(0, PILE.length);
  const offset = PILE.length - rows.length;
  return (
    <span aria-hidden className={`pointer-events-none absolute flex flex-col gap-1 ${className}`}>
      {rows.map((b, i) => {
        const p = PILE[offset + i];
        const look = SPINE_LOOKS[i % SPINE_LOOKS.length];
        const style = {
          width: `${p.w}%`,
          marginLeft: `${p.x}%`,
          rotate: `${p.r}deg`,
          background: look.bg,
          color: look.fg,
          transitionDelay: `${i * 45}ms`,
          "--slide": `${p.slide}px`,
        } as CSSProperties;
        return (
          <span
            key={`${b.name}-${i}`}
            style={style}
            className={`relative h-[26px] items-center rounded-[4px] pl-4 pr-2 shadow-[0_6px_10px_-6px_rgba(0,0,0,0.65)] transition-[translate] duration-500 ease-out group-hover:translate-x-[var(--slide)] ${
              i < rows.length - 4 ? "hidden xl:flex" : "flex"
            }`}
          >
            {/* The printed band near the spine's top. */}
            <span className="absolute inset-y-[5px] left-1.5 w-[2px] rounded-full opacity-45" style={{ background: look.fg }} />
            <span className="truncate text-[9.5px] font-bold uppercase tracking-[0.07em]">{b.name}</span>
          </span>
        );
      })}
    </span>
  );
}

/** The first tile: the whole shop, navy and gold, with a pile of its books. */
function AllBooksTile({ count, spines }: { count: number; spines: Spine[] }) {
  return (
    <Link
      href="/collection"
      className={`group relative col-span-2 flex min-h-[10rem] flex-col overflow-hidden bg-[linear-gradient(155deg,#0d4377_0%,#042b52_72%)] p-5 sm:p-6 md:col-span-1 md:min-h-0 xl:row-span-2 ${CARD} ${LIFT}`}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <DottedPaper dot="rgba(255,255,255,0.09)" />
        <span className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-mustard/25 blur-3xl" />
      </span>
      <span className="relative z-30 flex max-w-[55%] flex-col md:max-w-none">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-mustard">
          <BookStackIcon className="h-4 w-4" strokeWidth={1.8} />
          The full shop
        </span>
        <span className="mt-2 text-[22px] font-bold leading-tight sm:text-[24px] xl:text-[28px]">All Books</span>
        <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-mustard px-3 py-1 text-[11.5px] font-bold text-rose-800">
          {books(count)}
          <Arrow />
        </span>
      </span>
      <BookPile spines={spines} className="bottom-4 right-4 w-[52%] md:hidden xl:inset-x-5 xl:bottom-6 xl:flex xl:w-auto" />
    </Link>
  );
}

/** A genre: its category's picture under a dark wash, its name and how many books. */
function GenreTile({ tile, tint: [from, to] }: { tile: GenreTileData; tint: string[] }) {
  const Icon = tile.label === "Art & Design" ? PaletteIcon : BookOpenIcon;
  const style: CSSProperties = { background: `linear-gradient(135deg, ${from}, ${to})` };
  const body = (
    <>
      {tile.image ? (
        <Image
          src={tile.image}
          alt=""
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 20vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <Icon className="absolute -right-4 -top-4 h-28 w-28 text-white/15 transition-transform duration-500 group-hover:scale-110" strokeWidth={1.2} />
      )}
      {/* A dark wash rising from the bottom, so the words read on any photo. */}
      <span
        aria-hidden
        className={`absolute inset-0 ${
          tile.image
            ? "bg-[linear-gradient(to_top,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.5)_35%,rgba(0,0,0,0.1)_65%,transparent_82%)]"
            : "bg-[linear-gradient(to_top,rgba(0,0,0,0.22)_0%,transparent_60%)]"
        }`}
      />
      <span className="relative transition-transform duration-300 group-hover:-translate-y-1">
        <span className="block text-[15px] font-bold leading-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] sm:text-[17px] xl:text-[18px]">
          {tile.label}
        </span>
        <span className="mt-2 block">
          <CountPill>
            {tile.href ? (
              <>
                {books(tile.count)}
                <Arrow />
              </>
            ) : (
              "Coming soon"
            )}
          </CountPill>
        </span>
      </span>
    </>
  );
  const cls = `group relative flex aspect-[4/3] flex-col justify-end overflow-hidden p-4 sm:aspect-[16/10] sm:p-5 xl:aspect-[5/4] ${CARD}`;
  return tile.href ? (
    <Link href={tile.href} className={`${cls} ${LIFT}`} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

/** The first cover stands in front; the next two lean out behind it and open wider on hover. */
const DISCOVER_FAN = [
  "left-1/2 z-20 -translate-x-1/2 group-hover:-translate-y-3",
  "left-[3%] top-[8%] z-10 -rotate-[12deg] group-hover:-translate-x-3 group-hover:-rotate-[17deg]",
  "right-[3%] top-[8%] z-10 rotate-[12deg] group-hover:translate-x-3 group-hover:rotate-[17deg]",
];

/**
 * A Discover list as a tall card: its covers fanned on a shelf in the middle,
 * then its name, line and a way in. On a computer the card leans toward the
 * mouse with a soft light following it (TiltCard), the covers open out and
 * the icon and arrow light up.
 */
function DiscoverCard({ shelf, summary }: { shelf: Shelf; summary?: ShelfSummary }) {
  const look = SHELF_LOOKS[shelf.slug];
  const [from, to] = look.tint;
  const covers = (summary?.covers ?? []).slice(0, 3);
  return (
    <TiltCard
      href={`/collection?shelf=${shelf.slug}`}
      className="group relative flex h-full min-h-[22rem] flex-col overflow-hidden rounded-[var(--radius-card)] p-5 text-white shadow-[0_14px_30px_-16px_rgba(4,43,82,0.55)] ring-1 ring-black/5 outline-none transition-[transform,translate,box-shadow] duration-300 ease-out [transform:perspective(900px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] hover:-translate-y-1 hover:shadow-[0_28px_50px_-18px_rgba(4,43,82,0.6)] focus-visible:ring-2 focus-visible:ring-mustard"
      style={{ background: `linear-gradient(160deg, ${from} 0%, ${to} 100%)` }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <DottedPaper dot="rgba(255,255,255,0.08)" />
        {/* The light that follows the mouse. */}
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_var(--mx,50%)_var(--my,25%),rgba(255,255,255,0.22),transparent_55%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </span>

      <span className="relative z-30 flex items-center justify-between gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 transition-colors duration-300 group-hover:bg-white group-hover:text-rose-700 group-hover:ring-white ${look.icon}`}
        >
          <look.Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        {summary && summary.count > 0 && <CountPill>{books(summary.count)}</CountPill>}
      </span>

      {/* The list's covers on a shelf. */}
      {/* Its height follows its width, so wider cards (tablets) keep the covers clear of the title. */}
      <span aria-hidden className="relative mx-auto mt-5 block aspect-[7/5] w-[86%]">
        {covers.length > 0 ? (
          covers.map((c, i) => (
            <span
              key={c.image}
              className={`absolute top-0 aspect-[2/3] w-[42%] overflow-hidden rounded-md bg-white shadow-[0_18px_30px_-14px_rgba(0,0,0,0.7)] ring-2 ring-white/90 transition-[translate,rotate] duration-500 ease-out ${DISCOVER_FAN[i]}`}
            >
              <Image src={c.image} alt="" fill fixed sizes="120px" className="object-cover" />
            </span>
          ))
        ) : (
          <look.Icon className="mx-auto h-24 w-24 text-white/25" strokeWidth={1.2} />
        )}
        <span className="absolute -bottom-1 left-1/2 h-3 w-[90%] -translate-x-1/2 rounded-full bg-black/30 blur-md" />
      </span>

      <span className="relative z-30 mt-auto pt-6">
        <span className="block text-[19px] font-bold leading-tight">{shelf.label}</span>
        <span className="mt-1 block text-[13px] leading-snug text-white/90">{shelf.note}</span>
        <span className="mt-4 inline-flex items-center gap-2.5 text-[12.5px] font-semibold">
          Explore the list
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mustard text-rose-800 transition-transform duration-300 group-hover:translate-x-1">
            <ChevronIcon className="h-3 w-3 -rotate-90" strokeWidth={2.6} />
          </span>
        </span>
      </span>
    </TiltCard>
  );
}

/**
 * "Browse By Genre": Books — All Books and the eight genres — then Discover —
 * New Arrivals, Bestsellers, The Lalwani Edit and Gift Ideas. A genre the shop
 * has no books for yet says "Coming soon" until its category is filled.
 */
export function BrowseShelves({
  title,
  categories,
  allBooks,
  discover,
}: {
  title: string;
  categories: (Category & { image?: string | null })[];
  /** Every book: the count, and a few of them for the pile of spines. */
  allBooks: { count: number; spines: Spine[] };
  /** By shelf: how many books it holds, and a few of their covers. */
  discover: Record<string, ShelfSummary>;
}) {
  return (
    <section className="container-shop pt-16 lg:pt-20">
      <SectionHead title={title} />
      <GroupLabel>Books</GroupLabel>
      <div data-reveal-stagger className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-5">
        <AllBooksTile {...allBooks} />
        {genreTiles(categories).map((tile, i) => (
          <GenreTile key={tile.label} tile={tile} tint={GENRE_TINTS[i % GENRE_TINTS.length]} />
        ))}
      </div>
      <GroupLabel className="mt-10 lg:mt-12">Discover</GroupLabel>
      {/* A row to swipe through on phones; a grid from tablets up. Each card
          sits in a wrapper so the reveal's transform and the tilt don't clash. */}
      <div
        data-reveal-stagger
        className="scrollbar-hidden -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4"
      >
        {DISCOVER_SHELVES.map((shelf) => (
          <div key={shelf.slug} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <DiscoverCard shelf={shelf} summary={discover[shelf.slug]} />
          </div>
        ))}
      </div>
    </section>
  );
}
