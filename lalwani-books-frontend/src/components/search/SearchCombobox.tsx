"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "@/components/Image";
import { BookOpenIcon, GridIcon, SearchIcon, UserIcon } from "@/components/icons";
import { money, initialsOf } from "@/lib/format";
import { startNavigation } from "@/lib/loading-bus";
import { MIN_QUERY, hasSuggestions, type SuggestResult } from "@/lib/search";
import { noteSearch } from "@/lib/search-log";

export interface PopularLink {
  label: string;
  href: string;
}

/** `book`: the slug of the book an option opens. */
type Option = { key: string; href: string; group: "books" | "authors" | "categories" | "isbn"; index: number; book?: string };

const GROUPS: { key: Option["group"]; label: string }[] = [
  { key: "books", label: "Books" },
  { key: "authors", label: "Authors" },
  { key: "categories", label: "Categories" },
  { key: "isbn", label: "ISBN" },
];

/** The matching part of a suggestion in bold, so the eye finds it at once. */
function Marked({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <b className="font-bold text-ink">{text.slice(at, at + q.length)}</b>
      {text.slice(at + q.length)}
    </>
  );
}

/**
 * A search box with grouped live suggestions — Books, Authors, Categories and
 * ISBN — keyboard friendly (arrows, Enter, Escape) and announced to screen
 * readers as a combobox. Shows popular searches while the box is empty.
 *
 * The caller owns the text and the results, so several boxes (the header's
 * desktop, phone and pinned copies) can share one request.
 */
export function SearchCombobox({
  value,
  onChange,
  onSubmit,
  onPick,
  results,
  searching,
  popular = [],
  variant = "pill",
  inline = false,
  autoFocus = false,
  placeholder = "Search by title, author, ISBN or subject…",
  className = "",
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  /** Called when a suggestion is chosen (to clear the box, close a menu…). */
  onPick?: () => void;
  results: SuggestResult | null;
  searching: boolean;
  /** Shown while the box is focused and empty. */
  popular?: PopularLink[];
  /** "pill": the header's grey field. "hero": the big home page box. */
  variant?: "pill" | "hero";
  /** Results open inside the surrounding card instead of floating below it. */
  inline?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const router = useRouter();

  const q = value.trim();
  const showResults = focused && q.length >= MIN_QUERY;
  const showPopular = focused && q.length < MIN_QUERY && popular.length > 0;
  const any = hasSuggestions(results);

  // One flat list in display order, so the arrow keys walk across the groups.
  const options = useMemo<Option[]>(() => {
    if (!results) return [];
    const out: Option[] = [];
    results.books.forEach((b, i) => out.push({ key: `b${b.id}`, href: `/product/${b.slug}`, group: "books", index: i, book: b.slug }));
    results.authors.forEach((a, i) => out.push({ key: `a${a.slug}`, href: `/collection?author=${a.slug}`, group: "authors", index: i }));
    results.categories.forEach((c, i) => out.push({ key: `c${c.slug}`, href: `/collection?category=${c.slug}`, group: "categories", index: i }));
    results.isbn.forEach((s, i) => out.push({ key: `i${s.slug}`, href: `/product/${s.slug}`, group: "isbn", index: i, book: s.slug }));
    return out;
  }, [results]);

  /** The words whose search admin → Search insights has already been told of. */
  const told = useRef("");

  function go(href: string, picked?: Option) {
    if (picked && q.length >= MIN_QUERY) {
      told.current = q.toLowerCase();
      noteSearch(q, "pick", picked.book);
    }
    onPick?.();
    setFocused(false);
    setActive(-1);
    startNavigation(href);
    router.push(href);
  }

  function keyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setFocused(false);
      setActive(-1);
      leftTyped();
      return;
    }
    if (!showResults || !options.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      go(options[active].href, options[active]);
    }
  }

  /** Typed and left without searching or choosing: the suggestions said enough, or nothing matched. */
  function leftTyped() {
    if (q.length >= MIN_QUERY && results && told.current !== q.toLowerCase()) {
      told.current = q.toLowerCase();
      noteSearch(q, "typed");
    }
  }

  const hero = variant === "hero";
  const optionClass = (on: boolean) => `flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${on ? "bg-blush-100" : "hover:bg-blush-50"}`;
  const optionProps = (o: Option) => ({
    id: `${listId}-${o.key}`,
    role: "option" as const,
    "aria-selected": options[active]?.key === o.key,
    href: o.href,
    onMouseEnter: () => setActive(options.indexOf(o)),
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      go(o.href, o);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        setFocused(false);
        // Told here as well as on the results page: a whole ISBN skips that
        // page and opens its book. The page does not count it twice.
        if (q.length >= MIN_QUERY) {
          told.current = q.toLowerCase();
          noteSearch(q, "results");
        }
        onSubmit(e);
      }}
      className={`relative ${className}`}
      role="search"
      data-no-loader
      id={id}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocused(false);
          setActive(-1);
          // Not when the whole window lost focus (another tab or app): the
          // shopper is coming back to this search.
          if (document.hasFocus()) leftTyped();
        }
      }}
    >
      <div
        className={
          hero
            ? "flex items-center gap-2 rounded-full border border-blush-200 bg-white p-1.5 pl-5 shadow-[0_18px_40px_-24px_rgba(4,43,82,0.45)] transition-colors focus-within:border-rose-600"
            : "flex items-center rounded-full border border-transparent bg-[#f5f5f5] pl-5 pr-1.5 transition-colors focus-within:border-rose-600 focus-within:bg-white"
        }
      >
        {hero && <SearchIcon className="h-5 w-5 shrink-0 text-fog" strokeWidth={2} />}
        <input
          type="search"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(-1);
          }}
          onKeyDown={keyDown}
          placeholder={placeholder}
          aria-label="Search books, authors, categories or ISBN"
          role="combobox"
          aria-expanded={showResults || showPopular}
          aria-controls={showResults || showPopular ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && options[active] ? `${listId}-${options[active].key}` : undefined}
          autoFocus={autoFocus}
          enterKeyHint="search"
          className={`w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-fog [&::-webkit-search-cancel-button]:hidden ${
            hero ? "h-12 text-[15px] sm:h-14 sm:text-[16px]" : "h-12 text-[13px] lg:h-11"
          }`}
        />
        <button
          type="submit"
          aria-label="Search"
          className={
            hero
              ? "flex h-12 shrink-0 items-center gap-2 rounded-full bg-rose-600 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 sm:h-14 sm:px-7"
              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-rose-600 hover:text-white lg:h-9 lg:w-9"
          }
        >
          <SearchIcon className={hero ? "h-[18px] w-[18px]" : "h-[17px] w-[17px]"} strokeWidth={2} />
          {hero && <span className="hidden sm:inline">Search</span>}
        </button>
      </div>

      {(showResults || showPopular) && (
        <div
          className={`overflow-hidden rounded-2xl border border-blush-200 bg-white text-left ${
            inline ? "mt-3" : "absolute inset-x-0 top-full z-50 mt-2 shadow-lift"
          }`}
        >
          {showPopular ? (
            <div id={listId} className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fog">Popular searches</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {popular.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    onClick={(e) => {
                      e.preventDefault();
                      go(p.href);
                    }}
                    className="rounded-full border border-blush-200 px-3 py-1.5 text-[12.5px] text-cocoa transition-colors hover:border-rose-600 hover:bg-rose-600 hover:text-white"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : any ? (
            <>
              <div id={listId} role="listbox" aria-label="Search suggestions" className="max-h-[min(26rem,60vh)] overflow-auto p-2">
                {GROUPS.map(({ key, label }) => {
                  const group = options.filter((o) => o.group === key);
                  if (!group.length) return null;
                  const headId = `${listId}-${key}`;
                  return (
                    <div key={key} role="group" aria-labelledby={headId} className="py-1">
                      <p id={headId} className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog">
                        {label}
                      </p>
                      {group.map((o) => {
                        const on = options[active]?.key === o.key;
                        if (o.group === "books" && results) {
                          const b = results.books[o.index];
                          return (
                            <Link key={o.key} {...optionProps(o)} className={optionClass(on)}>
                              <span className="relative h-12 w-9 shrink-0 overflow-hidden rounded" style={{ background: `linear-gradient(135deg, ${b.colors.from}, ${b.colors.to})` }}>
                                {b.image && <Image src={b.image} alt="" fill sizes="36px" className="object-cover" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] text-cocoa">
                                  <Marked text={b.name} q={q} />
                                </span>
                                {b.author && (
                                  <span className="block truncate text-[11.5px] text-fog">
                                    <Marked text={b.author} q={q} />
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-[13px] font-semibold text-rose-600">{money(b.price)}</span>
                            </Link>
                          );
                        }
                        if (o.group === "authors" && results) {
                          const a = results.authors[o.index];
                          return (
                            <Link key={o.key} {...optionProps(o)} className={optionClass(on)}>
                              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-[11px] font-semibold text-rose-600">
                                {a.photo ? (
                                  <Image src={a.photo} alt="" fill sizes="36px" className="object-cover" fallback={initialsOf(a.name) || <UserIcon className="h-4 w-4" />} />
                                ) : (
                                  initialsOf(a.name) || <UserIcon className="h-4 w-4" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[13px] text-cocoa">
                                <Marked text={a.name} q={q} />
                              </span>
                              <span className="shrink-0 text-[11.5px] text-fog">
                                {a.books} {a.books === 1 ? "book" : "books"}
                              </span>
                            </Link>
                          );
                        }
                        if (o.group === "categories" && results) {
                          const c = results.categories[o.index];
                          return (
                            <Link key={o.key} {...optionProps(o)} className={optionClass(on)}>
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush-100 text-rose-600">
                                <GridIcon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-[13px] text-cocoa">
                                <Marked text={c.name} q={q} />
                              </span>
                              <span className="shrink-0 text-[11.5px] text-fog">
                                {c.books} {c.books === 1 ? "book" : "books"}
                              </span>
                            </Link>
                          );
                        }
                        const s = results!.isbn[o.index];
                        return (
                          <Link key={o.key} {...optionProps(o)} className={optionClass(on)}>
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush-100 text-rose-600">
                              <BookOpenIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-[12.5px] text-ink">{s.isbn}</span>
                              <span className="block truncate text-[11.5px] text-fog">{s.name}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <button
                type="submit"
                className="block w-full border-t border-blush-200 px-4 py-3 text-left text-[12.5px] font-semibold text-rose-600 transition-colors hover:bg-blush-50"
              >
                See all results for &ldquo;{q}&rdquo; &rarr;
              </button>
            </>
          ) : (
            <p id={listId} className="px-4 py-5 text-center text-[12.5px] text-fog">
              {searching ? "Searching…" : `Nothing matches “${q}” — try a title, an author, an ISBN or a subject.`}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
