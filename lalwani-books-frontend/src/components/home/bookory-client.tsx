"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "@/components/Image";
import type { ProductCard as ProductCardType } from "@/lib/types";
import { ProductCard } from "../ProductCard";
import { DrawnCover } from "../ProductImage";
import { ChevronIcon, ClockIcon } from "../icons";
import { Doodle, DottedPaper, FoldedPage, OpenBook, Ribbon, Ring, Sparkle } from "./doodles";

/** One slide of the home hero — admin → Banners. */
export interface HeroBanner {
  id: number;
  image: string | null;
  title: string | null;
  subtitle: string | null;
  /** Offer flash, e.g. "UP TO 20% OFF". Empty when no sale is running. */
  badge_text?: string | null;
  description: string | null;
  button_text: string | null;
  button_url: string | null;
  /** Off = draw no copy over the photo at all. */
  show_text?: boolean;
  /** The three cover slots of the fanned stack — front, left, right — null where empty. */
  covers?: (string | null)[];
}

/** How long each hero slide stays before the next fades in. */
const SLIDE_MS = 5000;

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}

/** Prev / next round buttons used by the rails and the hero. */
function ArrowButton({ dir, onClick, label, className = "" }: { dir: "prev" | "next"; onClick: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-blush-200 bg-white text-ink shadow-soft transition-colors hover:border-rose-600 hover:bg-rose-600 hover:text-white ${className}`}
    >
      <ChevronIcon className={`h-4 w-4 ${dir === "prev" ? "rotate-90" : "-rotate-90"}`} strokeWidth={2} />
    </button>
  );
}

/**
 * The headline with the banner's `subtitle` phrase underlined in coral, the
 * way Bookory marks "50% Off" — the admin picks the phrase in Banners.
 */
function MarkedTitle({ title, mark }: { title: string; mark: string | null }) {
  const i = mark ? title.indexOf(mark) : -1;
  if (!mark || i < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, i)}
      <span className="relative inline-block whitespace-nowrap">
        {mark}
        <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className="draw-line absolute -bottom-1 left-0 h-3 w-full text-rose-600">
          <path d="M3 8c40-6 110-8 194-3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </span>
      {title.slice(i + mark.length)}
    </>
  );
}

/**
 * Fanned stack of three covers — the hero art. A banner's uploaded covers
 * (admin → Hero Banners: front, left, right) take their slots; any slot left
 * empty is filled with a featured book's cover, drawn when the book has no
 * photo of its own. With no banner covers at all it is three featured books.
 */
export function CoverStack({
  books,
  covers = [],
  priority = false,
}: {
  books: ProductCardType[];
  covers?: (string | null)[];
  /** True for the stack a visitor sees first: its covers are the largest thing above the fold, so they load ahead of everything else. */
  priority?: boolean;
}) {
  // Positions in the frame: left (back), centre (front), right (back). The
  // banner's "front" cover is the centre one.
  const pose = [
    "left-[6%] top-[14%] -rotate-[10deg] z-10",
    "left-[33%] top-[4%] rotate-[2deg] z-20",
    "left-[58%] top-[16%] rotate-[12deg] z-10",
  ];
  const slots: ({ key: string; photo: string } | { key: string; book: ProductCardType } | null)[] = [
    covers[1] ? { key: "cover-left", photo: covers[1] } : null,
    covers[0] ? { key: "cover-front", photo: covers[0] } : null,
    covers[2] ? { key: "cover-right", photo: covers[2] } : null,
  ];
  // Fill what is empty with featured books, centre first so a lone book is
  // still the one in front.
  const spare = [...books];
  for (const i of [1, 0, 2]) {
    if (slots[i]) continue;
    const b = spare.shift();
    if (b) slots[i] = { key: `book-${b.id}`, book: b };
  }
  if (slots.every((s) => s === null)) return null;

  return (
    <div aria-hidden className="relative mx-auto aspect-[5/4] w-full max-w-[520px]">
      {slots.map((s, i) =>
        s ? (
          <div key={s.key} className={`cover-in absolute w-[38%] ${pose[i]}`} style={{ animationDelay: `${0.15 + i * 0.15}s` }}>
            <div className="float-y overflow-hidden rounded-xl shadow-[0_24px_50px_-20px_rgba(0,0,0,0.45)]" style={{ animationDelay: `${i * -2}s` }}>
              <div className="relative pb-[140%]">
                {"photo" in s ? (
                  <Image src={s.photo} alt="" fill sizes="220px" priority={priority} className="object-cover" />
                ) : s.book.image ? (
                  <Image src={s.book.image} alt="" fill sizes="220px" priority={priority} className="object-cover" />
                ) : (
                  <DrawnCover product={s.book} />
                )}
              </div>
            </div>
          </div>
        ) : null
      )}
      <span className="absolute bottom-[6%] left-[12%] right-[12%] h-[10%] rounded-[50%] bg-black/10 blur-xl" />
    </div>
  );
}

/**
 * What sits behind the hero: a warm wash of peach into cream with a cool mint
 * corner, a faint dotted-paper texture that clears towards the middle so the
 * copy stays on plain ground, soft colour blobs, and thin line drawings — open
 * books, a folded page, a ring, a ribbon and a few sparkles — drifting slowly
 * around the edges. Each drawing is anchored to its own corner or edge so it
 * keeps out of the way whatever shape the hero takes (wide on desktop, tall on
 * phones, where the drawings that would sit behind the headline are dropped).
 * Purely decorative, behind everything, hidden from assistive technology; the
 * covers, copy and button are untouched.
 */
function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Warm wash with a cool corner — the translucent mint layer is listed first so it paints on top of the wash. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_100%_100%,rgba(141,177,220,0.35),transparent_62%),radial-gradient(120%_90%_at_15%_10%,#dbe6f3_0%,#eaf0f7_48%,#f6f8fb_72%)]" />
      <DottedPaper dot="rgba(4,43,82,0.13)" />
      {/* Colour blobs. */}
      <span className="blob-drift absolute -left-24 top-10 h-72 w-72 rounded-full bg-rose-300/35 blur-3xl" />
      <span className="blob-drift absolute -bottom-20 right-1/3 h-64 w-64 rounded-full bg-white/70 blur-3xl [animation-delay:-7s]" />
      <span className="blob-drift absolute right-[6%] top-[8%] h-56 w-56 rounded-full bg-[#e8b04b]/25 blur-3xl [animation-delay:-4s]" />
      <span className="blob-drift absolute bottom-[8%] left-[36%] h-48 w-48 rounded-full bg-[#8db1dc]/30 blur-3xl [animation-delay:-10s]" />

      {/* Line drawings. */}
      <Doodle className="left-[2%] top-[5%] w-14 md:left-[3%] md:top-[8%] md:w-20" delay="-5s" viewBox="0 0 80 100">
        <g className="origin-center -rotate-12">
          <FoldedPage stroke="#0d4377" opacity={0.3} />
        </g>
      </Doodle>
      <Doodle className="left-[50%] top-[6%] w-32 max-md:hidden lg:w-40" delay="-1s" viewBox="0 0 160 100">
        <OpenBook stroke="#2b5d92" opacity={0.36} />
      </Doodle>
      <Doodle className="bottom-[8%] left-[3%] w-24 max-md:hidden lg:w-28" delay="-3.5s" viewBox="0 0 160 100">
        <OpenBook stroke="#042b52" opacity={0.3} />
      </Doodle>
      <Ring className="-bottom-24 -right-20 h-64 w-64 md:-bottom-32 md:-right-24 md:h-80 md:w-80" stroke="#042b52" opacity={0.22} />
      <Ribbon className="bottom-[3%] left-[8%] w-[84%] md:bottom-[7%] md:left-[46%] md:w-[26%]" stroke="#e8b04b" opacity={0.5} />
      <Sparkle className="right-[7%] top-[5%] w-4 md:right-[9%] md:top-[9%] md:w-5" delay="-2.5s" fill="#042b52" opacity={0.5} />
      <Sparkle className="left-[34%] top-[8%] w-3 max-md:hidden" delay="-4.5s" fill="#2b5d92" opacity={0.45} />
      <Sparkle className="right-[2%] top-[48%] w-3 max-md:hidden" delay="-6s" fill="#e8b04b" opacity={0.65} />
      <Sparkle className="bottom-[4%] left-[46%] w-3 md:left-[44%]" delay="-3s" fill="#042b52" opacity={0.55} />
    </div>
  );
}

export function HeroCarousel({ banners, books }: { banners: HeroBanner[]; books: ProductCardType[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = usePrefersReducedMotion();
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused || reduce) return;
    // Picking a dot restarts the clock, so the chosen slide gets its full stay.
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, count, paused, reduce]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured"
      className="relative overflow-hidden bg-blush-100"
      /* Paused only while a control inside has keyboard focus, so a keyboard
         user can read a slide. A mouse resting on the hero — most of the first
         screen — used to stop it, and so did the focus left behind by clicking
         a dot, which read as the slider not working at all. */
      onFocusCapture={(e) => setPaused(e.target.matches(":focus-visible"))}
      onBlurCapture={() => setPaused(false)}
    >
      <HeroBackdrop />

      {banners.map((b, i) => {
        const active = i === index;
        const showText = b.show_text !== false;
        return (
          <div
            key={b.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={!active}
            className={`${active ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0"} transition-opacity duration-700`}
          >
            <div className="container-shop grid min-h-[440px] items-center gap-8 py-12 md:grid-cols-2 lg:min-h-[560px]">
              <div className="order-2 md:order-1">
                {/* The banner's own covers in the fanned stack; empty slots are
                    filled with featured books (a different three per slide
                    while there are enough). */}
                <CoverStack
                  covers={b.covers ?? (b.image ? [b.image, null, null] : [])}
                  books={books.slice(i * 3, i * 3 + 3).length === 3 ? books.slice(i * 3, i * 3 + 3) : books}
                  priority={i === 0}
                />
              </div>

              {showText && (
                <div className={`order-1 text-center md:order-2 md:text-right ${active ? "hero-copy-in" : ""}`}>
                  {b.badge_text && (
                    <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-fog">{b.badge_text}</p>
                  )}
                  {b.title && (
                    <h2 className="mt-4 text-[clamp(1.7rem,8.2vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-[clamp(2rem,4.1vw,3.6rem)]">
                      <MarkedTitle title={b.title} mark={b.subtitle} />
                    </h2>
                  )}
                  {b.description && (
                    <p className="mt-5 text-[14px] font-medium leading-relaxed text-rose-600 sm:text-[15px] md:ml-auto md:max-w-md">
                      {b.description}
                    </p>
                  )}
                  {b.button_text && b.button_url && (
                    <Link
                      href={b.button_url}
                      tabIndex={active ? 0 : -1}
                      className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[13px] font-semibold text-ink shadow-soft transition-colors hover:bg-rose-600 hover:text-white"
                    >
                      {b.button_text}
                      <ChevronIcon className="h-3.5 w-3.5 -rotate-90" strokeWidth={2.2} />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${i === index ? "w-7 bg-rose-600" : "w-2 bg-ink/20 hover:bg-ink/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Horizontal shelf of book cards with prev/next buttons. Native scrolling with
 * snap, so touch, trackpad and keyboard all work without a library.
 */
export function BookRail({ products }: { products: ProductCardType[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync]);

  const scroll = (dir: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={track}
        onScroll={sync}
        data-reveal-stagger
        className="scrollbar-hidden -mx-1 flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pt-2 pb-2"
      >
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23%] xl:w-[calc((100%-6rem)/5)]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
      {!edge.start && (
        <ArrowButton dir="prev" onClick={() => scroll(-1)} label="Scroll left" className="absolute -left-4 top-[34%] hidden md:flex" />
      )}
      {!edge.end && (
        <ArrowButton dir="next" onClick={() => scroll(1)} label="Scroll right" className="absolute -right-4 top-[34%] hidden md:flex" />
      )}
    </div>
  );
}

/** Time left until Sunday 23:59:59 IST — the weekly deal window. */
function untilWeekEnd(now: Date) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const day = ist.getUTCDay(); // 0 = Sunday
  const end = new Date(ist);
  end.setUTCDate(ist.getUTCDate() + ((7 - day) % 7));
  end.setUTCHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - ist.getTime());
}

/** Time left until `endsAt` — or, with no end date, until Sunday 23:59:59 IST. */
function timeLeft(now: Date, endsAt: string | null) {
  const end = endsAt ? Date.parse(endsAt) : NaN;
  return Number.isNaN(end) ? untilWeekEnd(now) : Math.max(0, end - now.getTime());
}

export function Countdown({
  endsAt = null,
  className = "bg-[#e8b04b] text-ink",
}: {
  /** ISO time the deal ends; null counts down to Sunday midnight. */
  endsAt?: string | null;
  /** The pill's colours, to suit the panel it sits on. */
  className?: string;
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(timeLeft(new Date(), endsAt));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  const parts = left === null ? null : [
    Math.floor(left / 86400000),
    Math.floor(left / 3600000) % 24,
    Math.floor(left / 60000) % 60,
    Math.floor(left / 1000) % 60,
  ];
  const label = ["days", "hours", "minutes", "seconds"];

  return (
    <div className={`inline-flex items-center gap-3 rounded-full px-5 py-3 ${className}`} role="timer" aria-live="off">
      <ClockIcon className="h-5 w-5" strokeWidth={2} />
      <span className="flex items-center gap-1 text-[1.35rem] font-semibold tabular-nums">
        {(parts ?? [0, 0, 0, 0]).map((n, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>:</span>}
            <span aria-label={`${n} ${label[i]}`}>{String(n).padStart(2, "0")}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

/** How long each deal stays before the next one fades in. */
const DEAL_MS = 5000;

export interface DealSlide {
  id: number | string;
  /** What the slide offers, read out with its dot: "Show deal 2: Novels up to 25% off". */
  label: string;
  panel: ReactNode;
  list: ReactNode;
}

/**
 * Deals Of The Week as a slider. The offer panel and that offer's books
 * change together every five seconds, cross-fading. Every slide sits stacked
 * in the same grid cell, so the section is always as tall as its tallest
 * slide and nothing below it jumps. The dots switch by hand, the active one
 * filling up as its five seconds run. Like the hero, it pauses only while a
 * keyboard user is inside it, and holds still for anyone who has asked for
 * reduced motion.
 */
export function DealsSlider({ slides }: { slides: DealSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = usePrefersReducedMotion();
  const count = slides.length;
  const auto = count > 1 && !paused && !reduce;

  useEffect(() => {
    if (!auto) return;
    // Choosing a dot restarts the clock, so the chosen deal gets its full stay.
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), DEAL_MS);
    return () => clearTimeout(t);
  }, [index, count, auto]);

  const layer = (i: number) =>
    `[grid-area:1/1] transition-opacity duration-700 ease-out ${i === index ? "deal-slide--active opacity-100" : "pointer-events-none opacity-0"}`;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Deals of the week"
      className="grid gap-8 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]"
      onFocusCapture={(e) => setPaused(e.target.matches(":focus-visible"))}
      onBlurCapture={() => setPaused(false)}
    >
      <div data-reveal className="relative grid">
        {slides.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            inert={i !== index}
            className={layer(i)}
          >
            {s.panel}
          </div>
        ))}
        {count > 1 && (
          <div className="absolute bottom-5 left-7 z-10 flex items-center gap-2 sm:left-12">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show deal ${i + 1}: ${s.label}`}
                aria-current={i === index}
                className={`relative h-2 overflow-hidden rounded-full transition-all duration-300 ${
                  i === index ? "w-8 bg-white/35" : "w-2 bg-white/55 hover:bg-white/85"
                }`}
              >
                {i === index && (
                  <span
                    key={`${index}-${auto}`}
                    aria-hidden
                    className={`absolute inset-0 rounded-full bg-white ${auto ? "deal-progress" : ""}`}
                    style={auto ? { animationDuration: `${DEAL_MS}ms` } : undefined}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div data-reveal className="grid">
        {slides.map((s, i) => (
          <div key={s.id} aria-hidden={i !== index} inert={i !== index} className={layer(i)}>
            {s.list}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface Testimonial {
  id: number;
  name: string;
  designation: string | null;
  location: string | null;
  content: string;
  rating: number;
}
