"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { ProductThumb } from "@/admin/components/ProductThumb";
import { useAuth } from "@/admin/context/AuthContext";
import { canOpen } from "@/admin/lib/staff";
import { STOREFRONT_URL } from "@/admin/lib/storefront";
import type { ProductColors } from "@/admin/lib/types";
import { SearchesChart, type SearchDay } from "./searches-chart";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

interface Term {
  term: string;
  count: number;
  /** Of those searches, how many found nothing. */
  nothing: number;
  /** Books the latest of them found. */
  found: number | null;
  last: string | null;
  /** Books the same words find today (searches that found nothing only). */
  now?: number;
}

interface Insights {
  days: number;
  from: string;
  to: string;
  totals: { searches: number; terms: number; nothing: number; opened: number };
  daily: SearchDay[];
  top: Term[];
  missing: Term[];
  books: {
    id: number;
    name: string;
    slug: string;
    author: string | null;
    image: string | null;
    colors: ProductColors;
    on_sale: boolean;
    opens: number;
    terms: string[];
  }[];
  recent: {
    at: string | null;
    term: string;
    way: "results" | "pick" | "typed" | "open";
    found: number | null;
    book: { name: string; slug: string } | null;
  }[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** "just now", "5 min ago", "3 h ago", then the date. */
function ago(iso: string | null) {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
}

/** The words as the shopper typed them, opening the same search on the website. */
function Words({ term, className = "" }: { term: string; className?: string }) {
  if (!STOREFRONT_URL) return <span className={`break-words font-medium text-ink ${className}`}>{term}</span>;
  return (
    <a
      href={`${STOREFRONT_URL}/collection?search=${encodeURIComponent(term)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="See what customers see for this search"
      className={`break-words font-medium text-ink underline-offset-2 hover:text-rose-600 hover:underline ${className}`}
    >
      {term}
    </a>
  );
}

/** How one search ended, in words. */
function ending(r: Insights["recent"][number]) {
  const found = r.found ?? 0;
  switch (r.way) {
    case "open":
      return r.book ? `Opened “${r.book.name}” from the results` : "Opened a book from the results";
    case "pick":
      return r.book ? `Chose “${r.book.name}” from the suggestions` : "Chose a suggestion (an author or subject)";
    case "typed":
      return found ? `Typed only — ${plural(found, "book")} matched` : "Typed only — nothing matched";
    default:
      return found ? `Searched — ${plural(found, "book")} found` : "Searched — nothing found";
  }
}

/**
 * Admin → Search Insights: what customers search for on the website — the
 * books they look for most, and the searches that found nothing (books the
 * shop does not have yet). Only the words are kept, never who searched.
 */
export default function SearchInsights() {
  const { user } = useAuth();
  const [days, setDays] = useState<Period>(30);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");
  // The figures on screen are for another period while the new ones load.
  const loading = !error && data !== null && data.days !== days;

  useEffect(() => {
    let current = true;
    clientApi<{ data: Insights }>(`/admin/search-insights?days=${days}`)
      .then((res) => {
        if (!current) return;
        setData(res.data);
        setError("");
      })
      .catch((err) => current && setError(describeError(err, "load the search insights")));
    return () => {
      current = false;
    };
  }, [days]);

  const canAddBooks = Boolean(user && canOpen(user, "/admin/products/new"));
  const t = data?.totals;
  const share = t && t.searches ? Math.round((t.nothing / t.searches) * 100) : 0;
  const empty = data && data.totals.searches === 0 && data.recent.length === 0;

  const tiles = t
    ? [
        { label: "Searches", value: t.searches.toLocaleString("en-IN"), note: `in the last ${data.days} days` },
        { label: "Different searches", value: t.terms.toLocaleString("en-IN"), note: "different words or titles" },
        { label: "Found nothing", value: t.nothing.toLocaleString("en-IN"), note: `${share}% of searches` },
        { label: "Books opened", value: t.opened.toLocaleString("en-IN"), note: "straight from a search" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      {/* The words take the card's width; the period sits at its right, and below them on a phone. */}
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[1.6rem] text-ink">Search Insights</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fog">
            What customers search for on the website — the books they look for most, and the searches that found nothing,
            so you can see what to stock next. Only the words are kept, never who searched.
          </p>
        </div>
        <div role="tablist" aria-label="Period" className="flex shrink-0 self-start rounded-full bg-blush-50 p-1 text-[12px] sm:self-center">
          {PERIODS.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={days === p}
              onClick={() => {
                setDays(p);
                setError("");
              }}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 ${days === p ? "bg-white font-semibold text-ink shadow-sm" : "text-fog hover:text-ink"}`}
            >
              {p} days
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      {!data ? (
        !error && (
          <div className="card flex items-center justify-center gap-2 py-16 text-fog">
            <Spinner className="h-5 w-5" /> Loading...
          </div>
        )
      ) : empty ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-[15px] font-semibold text-ink">No searches yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-fog">
            Searches customers make on the website from now on show here within a minute — what they typed, what they
            found, and what they could not find.
          </p>
        </div>
      ) : (
        // A new period keeps the old figures on screen, faded, until the new ones arrive.
        <div className={`flex flex-col gap-5 transition-opacity ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.label} className="card p-5 sm:p-6">
                <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-fog">{tile.label}</p>
                <p className="mt-2 font-serif text-[1.5rem] leading-none text-ink sm:text-[1.8rem]">{tile.value}</p>
                <p className="mt-1.5 text-[11.5px] text-fog">{tile.note}</p>
              </div>
            ))}
          </div>

          <section className="card p-5 sm:p-6">
            <h2 className="font-serif text-[1.3rem] text-ink">Searches per day</h2>
            <p className="mt-0.5 text-[12px] text-fog">Each column is one day; the top part is the searches that found nothing.</p>
            <div className="mt-4">
              <SearchesChart days={data.daily} />
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
            <section className="card p-5 sm:p-6">
              <h2 className="font-serif text-[1.3rem] text-ink">Most searched</h2>
              <p className="mt-0.5 text-[12px] text-fog">What customers look for most often. Click a search to see what they see.</p>
              {data.top.length === 0 ? (
                <p className="py-8 text-center text-[12.5px] text-fog">No searches in these days.</p>
              ) : (
                <table className="mt-4 w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-blush-100 text-[10.5px] uppercase tracking-wide text-fog">
                      <th className="pb-2 pr-3 font-medium">Search</th>
                      <th className="pb-2 pr-3 text-right font-medium">Times</th>
                      <th className="pb-2 text-right font-medium">Books found</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blush-50">
                    {data.top.map((row) => (
                      <tr key={row.term}>
                        <td className="py-2.5 pr-3">
                          <Words term={row.term} />
                          <span className="mt-0.5 block text-[11px] text-fog">last {ago(row.last)}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-ink">{row.count.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {row.found ? (
                            <span className="text-ink">{row.found}</span>
                          ) : (
                            <span className="font-semibold text-red-600">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-[1.3rem] text-ink">Searched, but not in the shop</h2>
                  <p className="mt-0.5 text-[12px] text-fog">
                    Books, authors or subjects customers looked for and found nothing — worth stocking.
                  </p>
                </div>
                {canAddBooks && data.missing.length > 0 && (
                  <Link
                    href="/admin/products/new"
                    className="shrink-0 rounded-full bg-maroon-800 px-4 py-2 text-[12px] text-white transition-colors hover:bg-maroon-900"
                  >
                    + Add a book
                  </Link>
                )}
              </div>
              {data.missing.length === 0 ? (
                <p className="py-8 text-center text-[12.5px] text-fog">Every search in these days found something.</p>
              ) : (
                <ul className="mt-3 divide-y divide-blush-50">
                  {data.missing.map((row) => (
                    <li key={row.term} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5 text-[12.5px]">
                      <div className="min-w-0 flex-1">
                        <Words term={row.term} />
                        <span className="mt-0.5 block text-[11px] text-fog">
                          {row.nothing === row.count
                            ? `Searched ${plural(row.count, "time")}`
                            : `Found nothing ${plural(row.nothing, "time")} of ${row.count}`}{" "}
                          · last {ago(row.last)}
                        </span>
                      </div>
                      {row.now ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-green-700">
                          <span aria-hidden>✓</span> Now finds {plural(row.now, "book")}
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-amber-800">
                          <span aria-hidden>!</span> Not in the shop
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card p-5 sm:p-6">
            <h2 className="font-serif text-[1.3rem] text-ink">Books customers find by searching</h2>
            <p className="mt-0.5 text-[12px] text-fog">
              The books opened most often from a search — from the suggestions or the results — and the words that led to them.
            </p>
            {data.books.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-fog">No book has been opened from a search in these days.</p>
            ) : (
              <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.books.map((b, i) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-blush-50 p-3">
                    <span className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-fog">{i + 1}</span>
                    <ProductThumb product={{ id: b.id, name: b.name, image: b.image, colors: b.colors }} className="h-14 w-11 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{b.name}</p>
                      <p className="truncate text-[11.5px] text-fog">
                        {plural(b.opens, "time")}
                        {b.terms.length > 0 && ` · searched as “${b.terms.join("”, “")}”`}
                      </p>
                      {!b.on_sale && <p className="text-[11px] font-semibold text-amber-700">Hidden from the shop now</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-serif text-[1.3rem] text-ink">Latest searches</h2>
            <p className="mt-0.5 text-[12px] text-fog">The newest first, and how each one ended.</p>
            {data.recent.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-fog">No searches in the last week.</p>
            ) : (
              <ul className="mt-3 divide-y divide-blush-50">
                {data.recent.map((r, i) => (
                  <li key={`${r.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5 text-[12.5px]">
                    <span className="w-20 shrink-0 text-[11px] text-fog">{ago(r.at)}</span>
                    <Words term={r.term} className="min-w-0" />
                    <span
                      className={`min-w-0 basis-full text-[11.5px] sm:basis-auto sm:flex-1 ${
                        r.way !== "open" && !r.found && r.way !== "pick" ? "text-red-600" : "text-fog"
                      }`}
                    >
                      {ending(r)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="px-1 text-[11.5px] leading-relaxed text-fog">
            How it counts: a search is counted once, however it ended — on the results page, by choosing a suggestion, or
            by typing and leaving. Words that look like an email address or a phone or card number are never kept, and
            searches are kept for 120 days.
          </p>
        </div>
      )}
    </div>
  );
}
