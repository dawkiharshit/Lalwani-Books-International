"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, ApiError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { dealTheme } from "@/lib/deal-themes";

interface DealRow {
  id: number;
  eyebrow: string | null;
  heading: string;
  description: string | null;
  ends_label: string | null;
  ends_at: string | null;
  button_text: string | null;
  button_url: string | null;
  category: { id: number; name: string; slug: string } | null;
  theme: string;
  is_active: boolean;
  sort_order: number;
}

const endsText = (d: DealRow) =>
  d.ends_at
    ? new Date(d.ends_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "Sunday midnight, every week";

/** List only — creating and editing happen on their own pages. */
export default function AdminDeals() {
  const [rows, setRows] = useState<DealRow[] | null>(null);
  // When the list arrived — what "Ended" is judged against.
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    clientApi<{ data: DealRow[] }>("/admin/deals")
      .then((res) => {
        setRows(res.data);
        setLoadedAt(Date.now());
        setError("");
      })
      .catch((err) => {
        // Say the load failed rather than showing an empty list.
        setRows([]);
        setError(err instanceof ApiError ? `Could not load deals: ${err.message}` : "Could not load deals. Check that the API is running.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(d: DealRow) {
    setError("");
    try {
      await clientApi(`/admin/deals/${d.id}`, { method: "PUT", body: { is_active: !d.is_active } });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change the status.");
    }
  }

  async function remove(d: DealRow) {
    if (!confirm("Delete this deal?")) return;
    setError("");
    try {
      await clientApi(`/admin/deals/${d.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  const ended = (d: DealRow) => loadedAt > 0 && d.ends_at !== null && new Date(d.ends_at).getTime() <= loadedAt;
  const live = rows?.filter((d) => d.is_active && !ended(d)).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[1.6rem] text-ink">Deals</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-fog">
            The offers in the home page&rsquo;s Deals Of The Week panel. Two or more live deals slide one after another every five
            seconds, each beside its own reduced books. Switch the whole section off or rename it in Home Page.
          </p>
        </div>
        <Link href="/admin/deals/new" className="shrink-0 rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700">
          + Add Deal
        </Link>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      {rows && rows.length > 0 && (
        <p className="text-[11.5px] text-fog">
          {live === 0
            ? "Nothing live — the site shows a standard “Save up to …% on books” offer."
            : live === 1
              ? "1 deal live — shown on its own."
              : `${live} deals live — they slide every five seconds.`}
        </p>
      )}

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-[13px] text-fog">No deals yet — the site shows a standard &ldquo;Save up to …% on books&rdquo; offer.</p>
          <Link href="/admin/deals/new" className="mt-5 inline-block rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white hover:bg-rose-700">
            Add the first deal
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((d) => {
            const status = ended(d) ? "Ended" : d.is_active ? "Live" : "Off";
            return (
              <article key={d.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
                <div className={`flex h-20 w-32 shrink-0 flex-col justify-center overflow-hidden rounded-xl px-3 text-white ${dealTheme(d.theme).panel}`}>
                  {d.eyebrow && <span className="truncate text-[8.5px] font-semibold uppercase tracking-[0.14em] text-white/90">{d.eyebrow}</span>}
                  <span className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight">{d.heading.split("{discount}").join("…")}</span>
                </div>

                <div className="min-w-40 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink">{d.heading}</p>
                  <p className="mt-0.5 text-[12px] text-cocoa">
                    {d.category ? `${d.category.name} only` : "Every reduced book"} · Countdown: {endsText(d)}
                  </p>
                  {d.button_text && (
                    <p className="mt-0.5 text-[11px] text-fog">
                      Button: {d.button_text} &rarr; {d.button_url}
                    </p>
                  )}
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    status === "Live" ? "bg-green-100 text-green-700" : "bg-blush-100 text-fog"
                  }`}
                >
                  {status}
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/deals/${d.id}/edit`} className="rounded-full bg-maroon-800 px-4 py-1 text-[12px] text-white hover:bg-maroon-900">
                    Edit
                  </Link>
                  <button onClick={() => toggle(d)} className="rounded-full border border-blush-200 px-3.5 py-1 text-[12px] text-cocoa hover:bg-blush-100">
                    {d.is_active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => remove(d)} className="rounded-full px-3 py-1 text-[12px] text-red-500 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
