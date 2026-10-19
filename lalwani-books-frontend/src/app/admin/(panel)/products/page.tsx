"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, ApiError } from "@/admin/lib/api";
import type { ProductDetail } from "@/admin/lib/types";
import { money } from "@/admin/lib/format";
import { ProductThumb } from "@/admin/components/ProductThumb";
import { Spinner } from "@/admin/components/ui";

type Row = ProductDetail & { is_active: boolean; category_id: number; created_at?: string };

/** When a book was listed. The last two open their own date boxes. */
const LISTED = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Listed today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "day", label: "On a day…" },
  { value: "range", label: "Between dates…" },
] as const;

type Listed = (typeof LISTED)[number]["value"];

const SORTS = [
  { value: "name", label: "Name (A–Z)" },
  { value: "newest", label: "Newest listed first" },
  { value: "oldest", label: "Oldest listed first" },
] as const;

/**
 * Today in the shop's own time, as a date box writes it (2026-10-19). The
 * en-CA locale is the one that puts the year first; the API reads these
 * dates as Indian days too, so the two always agree.
 */
function indiaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** The same, `days` ago. Midday, so a summer-time shift could never move the date. */
function indiaDaysAgo(days: number): string {
  const noon = new Date(`${indiaToday()}T12:00:00+05:30`);
  noon.setDate(noon.getDate() - days);
  return noon.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** A date as the shop reads it: 19 Oct 2026. */
function dayWords(date: string): string {
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The chosen filter as the two days the API is asked for. */
function chosenDays(listed: Listed, day: string, from: string, to: string): { listed_from?: string; listed_to?: string } {
  switch (listed) {
    case "today":
      return { listed_from: indiaToday(), listed_to: indiaToday() };
    case "7":
      return { listed_from: indiaDaysAgo(6), listed_to: indiaToday() };
    case "30":
      return { listed_from: indiaDaysAgo(29), listed_to: indiaToday() };
    case "day":
      return day ? { listed_from: day, listed_to: day } : {};
    case "range":
      return { ...(from ? { listed_from: from } : {}), ...(to ? { listed_to: to } : {}) };
    default:
      return {};
  }
}

export default function AdminProducts() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [listed, setListed] = useState<Listed>("any");
  const [day, setDay] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("name");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [error, setError] = useState("");

  const days = chosenDays(listed, day, from, to);
  const filtered = Boolean(search || days.listed_from || days.listed_to || sort !== "name");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const chosen = chosenDays(listed, day, from, to);
    if (chosen.listed_from) params.set("listed_from", chosen.listed_from);
    if (chosen.listed_to) params.set("listed_to", chosen.listed_to);
    if (sort !== "name") params.set("sort", sort);
    params.set("page", String(page));
    clientApi<{ data: Row[]; meta: typeof meta }>(`/admin/products?${params}`)
      .then((res) => {
        setRows(res.data);
        setMeta(res.meta);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no products.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load products: ${err.message}`
            : "Could not load products. Check that the API is running."
        );
      });
  }, [search, listed, day, from, to, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(row: Row) {
    await clientApi(`/admin/products/${row.id}`, {
      method: "PUT",
      body: {
        ...toPayload(row),
        is_active: !row.is_active,
      },
    });
    load();
  }

  /** Every change starts again from the first page, or the list looks empty. */
  const onFilter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  function clearFilters() {
    setSearch("");
    setListed("any");
    setDay("");
    setFrom("");
    setTo("");
    setSort("name");
    setPage(1);
  }

  const found =
    days.listed_from && days.listed_to && days.listed_from === days.listed_to
      ? `listed on ${dayWords(days.listed_from)}`
      : days.listed_from && days.listed_to
        ? `listed between ${dayWords(days.listed_from)} and ${dayWords(days.listed_to)}`
        : days.listed_from
          ? `listed from ${dayWords(days.listed_from)}`
          : days.listed_to
            ? `listed up to ${dayWords(days.listed_to)}`
            : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto font-serif text-[1.5rem] text-ink">Products</h1>
          <input
            value={search}
            onChange={(e) => onFilter(setSearch)(e.target.value)}
            placeholder="Search name, author, ISBN or code"
            className="input-base max-w-72"
          />
          <Link
            href="/admin/products/new"
            className="rounded-full bg-rose-600 px-5 py-2 text-[12.5px] text-white hover:bg-rose-700"
          >
            + New Product
          </Link>
        </div>

        {/* When a book went on the website. "On a day…" and "Between dates…"
            open the date boxes beside them. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-blush-100 pt-4">
          <label htmlFor="listed-filter" className="text-[11.5px] font-medium text-fog">
            Listed
          </label>
          <select
            id="listed-filter"
            value={listed}
            onChange={(e) => onFilter(setListed)(e.target.value as Listed)}
            className="input-base max-w-44"
          >
            {LISTED.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {listed === "day" && (
            <input
              type="date"
              aria-label="Listed on"
              max={indiaToday()}
              value={day}
              onChange={(e) => onFilter(setDay)(e.target.value)}
              className="input-base max-w-44"
            />
          )}

          {listed === "range" && (
            <>
              <input
                type="date"
                aria-label="Listed from"
                max={indiaToday()}
                value={from}
                onChange={(e) => onFilter(setFrom)(e.target.value)}
                className="input-base max-w-44"
              />
              <span className="text-[11.5px] text-fog">to</span>
              <input
                type="date"
                aria-label="Listed up to"
                max={indiaToday()}
                value={to}
                onChange={(e) => onFilter(setTo)(e.target.value)}
                className="input-base max-w-44"
              />
            </>
          )}

          <label htmlFor="sort-filter" className="ml-2 text-[11.5px] font-medium text-fog">
            Order
          </label>
          <select
            id="sort-filter"
            value={sort}
            onChange={(e) => onFilter(setSort)(e.target.value as typeof sort)}
            className="input-base max-w-52"
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {filtered && (
            <button onClick={clearFilters} className="text-[12px] text-rose-600 hover:underline">
              Clear
            </button>
          )}

          {rows && (
            <p className="ml-auto text-[11.5px] text-fog">
              {meta.total} {meta.total === 1 ? "book" : "books"}
              {found && ` ${found}`}
            </p>
          )}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <div className="card overflow-x-auto p-6">
        {!rows ? (
          <div className="flex items-center justify-center gap-2 py-16 text-fog">
            <Spinner className="h-5 w-5" /> Loading products...
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-blush-100 text-[10.5px] uppercase tracking-wide text-fog">
                <th className="pb-2 pr-3">Product</th>
                <th className="pb-2 pr-3">Price</th>
                <th className="pb-2 pr-3">Stock</th>
                <th className="pb-2 pr-3">Rating</th>
                <th className="pb-2 pr-3">Listed</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush-50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-3">
                      <ProductThumb product={row} className="h-11 w-11 shrink-0 rounded-lg" />
                      <span>
                        <span className="block font-medium text-ink">{row.name}</span>
                        <span className="text-[10.5px] text-fog">
                          {row.sku} ·{" "}
                          {row.book?.isbn ? (
                            <>ISBN {row.book.isbn}</>
                          ) : (
                            // Readers search and note books by ISBN: flag the ones still without one.
                            <span className="font-semibold text-amber-600">No ISBN</span>
                          )}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-cocoa">{money(row.price)}</td>
                  <td className={`py-2.5 pr-3 ${row.stock <= 10 ? "font-semibold text-red-500" : "text-cocoa"}`}>{row.stock}</td>
                  <td className="py-2.5 pr-3 text-cocoa">{row.rating_avg.toFixed(1)} ({row.rating_count})</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-cocoa">
                    {row.created_at ? dayWords(row.created_at.slice(0, 10)) : "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-blush-100 text-fog"}`}>
                      {row.is_active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <Link href={`/admin/products/${row.id}/edit`} className="mr-3 text-rose-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => toggleActive(row)} className="text-fog hover:text-ink">
                      {row.is_active ? "Archive" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {rows && rows.length === 0 && (
          <p className="py-12 text-center text-[13px] text-fog">
            {filtered ? "No books match these filters." : "No products yet."}
          </p>
        )}

        {meta.last_page > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-blush-100 pt-4">
            <p className="text-[11.5px] text-fog">
              Page {meta.current_page} of {meta.last_page} · {meta.total} products
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.current_page <= 1}
                className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={meta.current_page >= meta.last_page}
                className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function toPayload(row: Row) {
  return {
    category_id: row.category_id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    price: row.price,
    compare_at_price: row.compare_at_price,
    stock: row.stock,
    size_ml: row.size_ml,
    is_featured: row.is_featured,
    is_new_arrival: row.is_new_arrival ?? false,
    image: row.image,    color_from: row.colors.from,
    color_to: row.colors.to,
    accent: row.colors.accent,
    notes_top: row.notes.top,
    notes_heart: row.notes.heart,
    notes_base: row.notes.base,
  };
}
