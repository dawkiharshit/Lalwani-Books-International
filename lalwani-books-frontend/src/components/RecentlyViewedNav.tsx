"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProductCard } from "@/lib/types";
import { money } from "@/lib/format";
import { clearRecentlyViewed, useRecentBooks } from "@/lib/recently-viewed";
import { ProductImage } from "./ProductImage";
import { ChevronIcon, ClockIcon } from "./icons";
import { drawerIcon, drawerLink } from "./ui";

/**
 * How many books are in the list, on a small navy badge that "blinks" — the
 * same pulsing ring as the floating buttons (.float-ping), resting on hover
 * and for visitors who ask for less motion. Shown once a book has been opened.
 */
function CountBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="float-ping relative isolate inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10.5px] font-bold leading-none text-white [--ping-delay:0.4s]"
    >
      {count}
    </span>
  );
}

/** The books, each a link to its page; or why there are none yet. */
function RecentList({ books, count }: { books: ProductCard[] | null; count: number }) {
  if (count === 0) {
    return <p className="px-2 py-5 text-center text-[12.5px] leading-relaxed text-fog">Books you open will show here, the newest first.</p>;
  }
  if (!books) {
    return <p className="px-2 py-5 text-center text-[12.5px] text-fog">Loading…</p>;
  }
  return (
    <ul className="scrollbar-hidden max-h-[min(26rem,60vh)] overflow-y-auto">
      {books.map((p) => (
        <li key={p.id}>
          <Link href={`/product/${p.slug}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-blush-50">
            <span className="relative w-10 shrink-0 overflow-hidden rounded-md bg-blush-150">
              <span className="block pb-[140%]" />
              <ProductImage product={p} sizes="40px" showLabel={false} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">{p.name}</span>
              {p.author && <span className="block truncate text-[11.5px] text-fog">{p.author}</span>}
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-rose-600">{money(p.price)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Recently Viewed" in the header's main menu (and its pinned copy): opens a
 * card with the books this shopper opened, newest first. Closes on a click
 * outside, on Escape, and when a page opens. `compact`: the slim pinned bar,
 * where below 1280px wide there is only room for a clock and the count.
 */
export function RecentlyViewedMenu({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  // Open only on the page it was opened on, so going to a book closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const { ids, books } = useRecentBooks(open);
  const id = useId();
  const box = useRef<HTMLLIElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <li ref={box} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={`${id}-card`}
        aria-label={ids.length ? `Recently viewed, ${ids.length} ${ids.length === 1 ? "book" : "books"}` : "Recently viewed"}
        className={`relative flex items-center gap-1.5 whitespace-nowrap py-1 font-semibold transition-colors hover:text-rose-600 after:absolute after:-bottom-0.5 after:left-0 after:h-[2px] after:rounded-full after:bg-rose-600 after:transition-all after:duration-300 ${
          open ? "text-rose-600 after:w-full" : "after:w-0 hover:after:w-full"
        }`}
      >
        {compact && <ClockIcon className="h-[18px] w-[18px] xl:hidden" strokeWidth={1.9} />}
        <span className={compact ? "hidden xl:inline" : undefined}>Recently Viewed</span>
        {ids.length > 0 && <CountBadge count={ids.length} />}
      </button>
      {open && (
        <div
          id={`${id}-card`}
          className="absolute right-0 top-full z-50 mt-3 w-[22rem] rounded-2xl border border-blush-200 bg-white p-3 text-left font-normal shadow-lift [animation:shopmenu_.16s_ease-out]"
        >
          <div className="flex items-center justify-between px-2 pb-1.5">
            <p className="text-[13px] font-semibold text-ink">Recently Viewed</p>
            {ids.length > 0 && (
              <button type="button" onClick={clearRecentlyViewed} className="text-[12px] font-semibold text-rose-600 hover:underline">
                Clear
              </button>
            )}
          </div>
          <RecentList books={books} count={ids.length} />
        </div>
      )}
    </li>
  );
}

/** The same list in the phone menu: a row that unfolds, like Categories. */
export function RecentlyViewedDrawer() {
  const [open, setOpen] = useState(false);
  const { ids, books } = useRecentBooks(open);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="drawer-recent"
        className={`${drawerLink} w-full text-left ${open ? "bg-blush-100 text-ink" : ""}`}
      >
        <ClockIcon className={drawerIcon} />
        <span className="flex-1">Recently Viewed</span>
        {ids.length > 0 && <CountBadge count={ids.length} />}
        <ChevronIcon className={`h-4 w-4 shrink-0 text-fog transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="drawer-recent" className="ml-4 border-l border-blush-200 pl-2 [animation:shopmenu_.16s_ease-out]">
          <RecentList books={books} count={ids.length} />
          {ids.length > 0 && (
            <button type="button" onClick={clearRecentlyViewed} className="px-2 py-2 text-[12.5px] font-semibold text-rose-600 hover:underline">
              Clear the list
            </button>
          )}
        </div>
      )}
    </div>
  );
}
