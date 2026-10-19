"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId, useState } from "react";
import type { Category } from "@/lib/types";
import { startNavigation } from "@/lib/loading-bus";
import { money } from "@/lib/format";
import { CheckIcon, ChevronIcon, CloseIcon, SearchIcon } from "@/components/icons";

/** The orders the shop can be sorted in (ProductController@index). */
export const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "rating", label: "Top Rated" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A—Z" },
];

/** An author or publisher the shop can be narrowed to. */
export interface FilterOption {
  name: string;
  slug: string;
}

/**
 * One section of the card. The title in the site's heading type, a round
 * blush button with the shop's chevron, and — while folded — what is chosen
 * in it, in coral, so a closed section still says what it is doing.
 */
function Group({
  title,
  summary,
  children,
  defaultOpen = true,
}: {
  title: string;
  /** The current choice, shown under the title while the section is folded. */
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="border-t border-blush-100 px-5 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="group flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-ink">{title}</span>
          {!open && summary && <span className="mt-0.5 block truncate text-[12px] font-medium text-rose-600">{summary}</span>}
        </span>
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blush-100 text-ink transition-colors group-hover:bg-rose-600 group-hover:text-white"
        >
          <ChevronIcon className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`} strokeWidth={2.4} />
        </span>
      </button>

      {open && (
        <div id={id} className="mt-3">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * One choice in a list: a round marker that turns coral with a tick when it
 * is the one picked, the label, and an optional count in a small pill.
 */
function Choice({ label, on, onClick, count }: { label: string; on: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
        on ? "bg-rose-100 text-rose-800" : "text-cocoa hover:bg-blush-50 hover:text-ink"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors ${
          on ? "bg-rose-600 text-white shadow-[0_4px_10px_-4px_rgba(4,43,82,0.45)]" : "bg-white ring-1 ring-blush-300"
        }`}
      >
        {on && <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[13px] ${on ? "font-semibold" : ""}`}>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${on ? "bg-white text-rose-700" : "bg-blush-100 text-fog"}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * A long list of names — authors or publishers — that scrolls inside its
 * section (no bar; the bottom fades out), with a rounded find box once
 * there are more than a few.
 */
function NameList({
  options,
  value,
  noun,
  onPick,
}: {
  options: FilterOption[];
  value: string;
  noun: "author" | "publisher";
  onPick: (slug: string | undefined) => void;
}) {
  const [query, setQuery] = useState("");
  const id = useId();
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  const find = noun === "author" ? "Find an author" : "Find a publisher";

  return (
    <div>
      {options.length > 8 && (
        <div className="relative mb-2">
          <label htmlFor={id} className="sr-only">
            {find}
          </label>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fog" />
          <input
            id={id}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${find}…`}
            className="w-full rounded-full bg-blush-50 py-2.5 pl-9 pr-4 text-[12.5px] text-ink outline-none ring-1 ring-blush-200 transition-shadow placeholder:text-fog focus:ring-2 focus:ring-rose-300"
          />
        </div>
      )}
      <ul className="scrollbar-hidden max-h-60 space-y-0.5 overflow-y-auto pb-6 [mask-image:linear-gradient(to_bottom,#000_82%,transparent)]">
        {!q && (
          <li>
            <Choice label={noun === "author" ? "All authors" : "All publications"} on={!value} onClick={() => onPick(undefined)} />
          </li>
        )}
        {shown.map((o) => {
          const on = value === o.slug;
          return (
            <li key={o.slug}>
              <Choice label={o.name} on={on} onClick={() => onPick(on ? undefined : o.slug)} />
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-2.5 py-2 text-[12.5px] text-fog">No {noun} matches “{query.trim()}”.</li>}
      </ul>
    </div>
  );
}

/** Dual-handle price slider in the shop's coral, with editable ₹ min/max and an apply button. */
function PriceRange({
  floor,
  ceil,
  initialMin,
  initialMax,
  onApply,
}: {
  floor: number;
  ceil: number;
  initialMin: number;
  initialMax: number;
  onApply: (min: number, max: number) => void;
}) {
  const step = 10;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const [lo, setLo] = useState(clamp(initialMin, floor, ceil));
  const [hi, setHi] = useState(clamp(initialMax, floor, ceil));

  /*
   * Follow the URL/bounds when they change (Clear all, navigation, new
   * results). Adjusted during render rather than in an effect: React restarts
   * the render immediately without committing the stale slider first, so there
   * is no flash of the previous range and no cascading second render.
   */
  const [appliedBounds, setAppliedBounds] = useState({ initialMin, initialMax, floor, ceil });
  if (
    appliedBounds.initialMin !== initialMin ||
    appliedBounds.initialMax !== initialMax ||
    appliedBounds.floor !== floor ||
    appliedBounds.ceil !== ceil
  ) {
    setAppliedBounds({ initialMin, initialMax, floor, ceil });
    setLo(clamp(initialMin, floor, ceil));
    setHi(clamp(initialMax, floor, ceil));
  }

  const span = ceil - floor || 1;
  const pct = (v: number) => ((v - floor) / span) * 100;
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);

  // The thumb styling lives in globals.css (.price-rail) — Tailwind's arbitrary
  // ::-webkit-slider-thumb variants don't reliably compile. Positioning stays here.
  const rail = "price-rail absolute left-0 top-0 h-5 w-full cursor-pointer";
  const field = "flex flex-1 items-center gap-0.5 rounded-full bg-blush-50 px-3.5 py-2 ring-1 ring-blush-200 focus-within:ring-2 focus-within:ring-rose-300";
  const box =
    "w-full bg-transparent text-center text-[12.5px] font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div>
      <div className="relative mt-1 h-5">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blush-200" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#042b52,#a9bfd9)]"
          style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }}
        />
        <input
          type="range"
          min={floor}
          max={ceil}
          step={step}
          value={lo}
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi - step))}
          aria-label="Minimum price"
          className={`z-[2] ${rail}`}
        />
        <input
          type="range"
          min={floor}
          max={ceil}
          step={step}
          value={hi}
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo + step))}
          aria-label="Maximum price"
          className={`z-[3] ${rail}`}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className={field}>
          <span className="text-[12px] text-fog">₹</span>
          <input
            type="number"
            inputMode="numeric"
            value={lo}
            onChange={(e) => setLo(clamp(Number(e.target.value) || floor, floor, ceil))}
            aria-label="Minimum price"
            className={box}
          />
        </div>
        <span aria-hidden className="h-px w-3 shrink-0 bg-blush-300" />
        <div className={field}>
          <span className="text-[12px] text-fog">₹</span>
          <input
            type="number"
            inputMode="numeric"
            value={hi}
            onChange={(e) => setHi(clamp(Number(e.target.value) || ceil, floor, ceil))}
            aria-label="Maximum price"
            className={box}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onApply(a, b)}
        className="mt-3 w-full rounded-full bg-rose-600 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(4,43,82,0.5)] transition-colors hover:bg-rose-700"
      >
        Apply price
      </button>
    </div>
  );
}

/**
 * The Filters card: how the books are sorted, and the category, author,
 * publication and price to narrow them to. Every choice lives in the address
 * (?sort=, ?category=, ?author=, ?publisher=, ?min_price=, ?max_price=), so a
 * filtered shelf can be bookmarked or shared.
 *
 * Dressed like the rest of the shop: a blush header with a coral eyebrow,
 * whatever is applied shown as removable coral chips, coral pills for the
 * sort order, ticked rows for the lists and the coral price slider.
 */
export function FilterSidebar({
  categories,
  authors = [],
  publishers = [],
  priceFloor,
  priceCeil,
  defaultSort = "featured",
  onApply,
  onClose,
}: {
  categories: Category[];
  /** Authors with books in the shop (Categories & Authors). */
  authors?: FilterOption[];
  /** Publishers with books in the shop (Categories & Authors → Publications). */
  publishers?: FilterOption[];
  priceFloor: number;
  priceCeil: number;
  /** The order the page uses with no ?sort= — New Arrivals is newest first. */
  defaultSort?: string;
  /** On a phone this closes the filter sheet so the results show at once. */
  onApply?: () => void;
  /**
   * Phone sheet only: shows a × in the header that closes the sheet, keeps
   * the header in place and scrolls the sections beneath it.
   */
  onClose?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      next.delete("page");
      const href = `${pathname}?${next.toString()}`;
      startNavigation(href);
      router.push(href, { scroll: false });
      onApply?.();
    },
    [params, pathname, router, onApply]
  );

  const category = params.get("category") ?? "";
  const author = params.get("author") ?? "";
  const publisher = params.get("publisher") ?? "";
  const search = params.get("search") ?? "";
  const minParam = params.get("min_price") ?? "";
  const maxParam = params.get("max_price") ?? "";
  const sort = params.get("sort") ?? defaultSort;

  const categoryName = categories.find((c) => c.slug === category)?.name;
  const authorName = authors.find((a) => a.slug === author)?.name;
  const publisherName = publishers.find((p) => p.slug === publisher)?.name;
  const sortLabel = SORTS.find((o) => o.value === sort)?.label ?? "Featured";

  /** What is applied right now, each with the change that removes it. */
  const chips: { label: string; clear: Record<string, undefined> }[] = [
    ...(search ? [{ label: `“${search}”`, clear: { search: undefined } }] : []),
    ...(category ? [{ label: categoryName ?? category, clear: { category: undefined } }] : []),
    ...(author ? [{ label: authorName ?? author, clear: { author: undefined } }] : []),
    ...(publisher ? [{ label: publisherName ?? publisher, clear: { publisher: undefined } }] : []),
    ...(minParam || maxParam
      ? [
          {
            label: `${money(Number(minParam || priceFloor))} – ${money(Number(maxParam || priceCeil))}`,
            clear: { min_price: undefined, max_price: undefined },
          },
        ]
      : []),
  ];
  const anything = chips.length > 0 || sort !== defaultSort;

  return (
    <aside
      className={
        onClose
          ? "flex h-full flex-col bg-white"
          : "overflow-hidden rounded-[var(--radius-hero)] bg-white shadow-soft ring-1 ring-blush-200/70"
      }
    >
      <div className="shrink-0 bg-[linear-gradient(135deg,#dbe6f3_0%,#eaf0f7_60%,#f5f8fc_100%)] px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600">Refine</p>
            <h2 className="mt-0.5 text-[1.25rem] font-semibold tracking-[-0.01em] text-ink">Filters</h2>
          </div>
          <div className={`flex shrink-0 items-center gap-2 ${onClose ? "mt-1.5" : "mt-1"}`}>
            {anything && (
              <button
                type="button"
                onClick={() => {
                  startNavigation(pathname);
                  router.push(pathname);
                  onApply?.();
                }}
                className="rounded-full bg-white px-3.5 py-1.5 text-[11.5px] font-semibold text-rose-600 shadow-soft transition-colors hover:bg-rose-600 hover:text-white"
              >
                Clear all
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close filters"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-soft transition-colors hover:bg-rose-600 hover:text-white"
              >
                <CloseIcon className="h-4 w-4" strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>

        {chips.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Applied filters">
            {chips.map((c) => (
              <li key={c.label}>
                <button
                  type="button"
                  onClick={() => setParams(c.clear)}
                  aria-label={`Remove filter: ${c.label}`}
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-full bg-white py-1 pl-3 pr-1.5 text-[11.5px] font-medium text-rose-800 ring-1 ring-rose-300/70 transition-colors hover:bg-rose-600 hover:text-white hover:ring-rose-600"
                >
                  <span className="truncate">{c.label}</span>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 transition-colors group-hover:bg-white/25 group-hover:text-white">
                    <CloseIcon className="h-2.5 w-2.5" strokeWidth={2.6} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* In the phone sheet the header stays put and only the sections scroll (no bar). */}
      <div className={onClose ? "scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4" : undefined}>
        <Group title="Sort by" summary={sortLabel}>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((o) => {
              const on = sort === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setParams({ sort: o.value === defaultSort ? undefined : o.value })}
                  className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                    on
                      ? "bg-rose-600 text-white shadow-[0_8px_18px_-10px_rgba(4,43,82,0.5)]"
                      : "bg-blush-50 text-cocoa ring-1 ring-blush-200 hover:text-ink hover:ring-rose-300"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Category" summary={categoryName ?? "All categories"}>
          <ul className="space-y-0.5">
            <li>
              <Choice label="All categories" on={!category} onClick={() => setParams({ category: undefined })} />
            </li>
            {categories.map((c) => {
              const on = category === c.slug;
              return (
                <li key={c.slug}>
                  <Choice
                    label={c.name}
                    on={on}
                    count={c.products_count}
                    onClick={() => setParams({ category: on ? undefined : c.slug })}
                  />
                </li>
              );
            })}
          </ul>
        </Group>

        {authors.length > 0 && (
          <Group title="Author" summary={authorName ?? "All authors"} defaultOpen={Boolean(author)}>
            <NameList options={authors} value={author} noun="author" onPick={(slug) => setParams({ author: slug })} />
          </Group>
        )}

        {publishers.length > 0 && (
          <Group title="Publication" summary={publisherName ?? "All publications"} defaultOpen={Boolean(publisher)}>
            <NameList options={publishers} value={publisher} noun="publisher" onPick={(slug) => setParams({ publisher: slug })} />
          </Group>
        )}

        <Group
          title="Price Range"
          summary={minParam || maxParam ? `${money(Number(minParam || priceFloor))} – ${money(Number(maxParam || priceCeil))}` : "Any price"}
        >
          <PriceRange
            floor={priceFloor}
            ceil={priceCeil}
            initialMin={minParam ? Number(minParam) : priceFloor}
            initialMax={maxParam ? Number(maxParam) : priceCeil}
            onApply={(min, max) =>
              setParams({
                min_price: min > priceFloor ? String(min) : undefined,
                max_price: max < priceCeil ? String(max) : undefined,
              })
            }
          />
        </Group>
      </div>
    </aside>
  );
}
