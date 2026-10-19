"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi, ApiError } from "@/admin/lib/api";
import { formatDate } from "@/admin/lib/format";
import { STOREFRONT_URL } from "@/admin/lib/storefront";
import { Spinner, Stars } from "@/admin/components/ui";

interface Row {
  id: number;
  name: string;
  rating: number;
  title: string | null;
  body: string;
  is_approved: boolean;
  created_at: string;
  product: { id: number; name: string; slug: string } | null;
}

const FILTERS = [
  { key: "", label: "All" },
  { key: "visible", label: "Published" },
  { key: "hidden", label: "Hidden" },
] as const;

export default function AdminReviews() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    clientApi<{ data: Row[] }>(`/admin/reviews?filter=${filter}`)
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no reviews.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load reviews: ${err.message}`
            : "Could not load reviews. Check that the API is running."
        );
      });
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(r: Row) {
    setBusyId(r.id);
    try {
      await clientApi(`/admin/reviews/${r.id}`, { method: "PUT", body: { is_approved: !r.is_approved } });
      load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: Row) {
    if (!confirm(`Delete this review by ${r.name}?`)) return;
    setBusyId(r.id);
    try {
      await clientApi(`/admin/reviews/${r.id}`, { method: "DELETE" });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[1.6rem] text-ink">Reviews</h1>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-[12px] ${
                filter === f.key ? "bg-rose-600 text-white" : "bg-white text-cocoa hover:bg-blush-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading reviews...
        </div>
      ) : rows.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[13px] text-fog">No reviews here.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <article key={r.id} className="card px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13px] font-semibold text-ink">{r.name}</p>
                <Stars rating={r.rating} />
                {r.product &&
                  (STOREFRONT_URL ? (
                    <a
                      href={`${STOREFRONT_URL}/product/${r.product.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-rose-600 hover:underline"
                    >
                      {r.product.name}
                    </a>
                  ) : (
                    <span className="text-[12px] text-cocoa">{r.product.name}</span>
                  ))}
                <span className="text-[11px] text-fog">{formatDate(r.created_at)}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    r.is_approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {r.is_approved ? "Published" : "Hidden"}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => toggle(r)}
                    disabled={busyId === r.id}
                    className="rounded-full border border-blush-200 px-4 py-1 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-50"
                  >
                    {r.is_approved ? "Hide" : "Publish"}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    disabled={busyId === r.id}
                    className="rounded-full px-3 py-1 text-[12px] text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {r.title && <p className="mt-2 text-[13px] font-medium text-cocoa">{r.title}</p>}
              <p className="mt-1 text-[12.5px] leading-relaxed text-cocoa">{r.body}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
