"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/api";
import type { Paginated, Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Stars, Spinner } from "@/components/ui";
import { StarSolid } from "@/components/icons";

/** How many reviews show before "Show all" — enough to read the mood, not a wall. */
const PREVIEW = 3;

export function ReviewsSection({ slug, className = "" }: { slug: string; className?: string }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, rating_avg: 0, rating_count: 0 });
  const [page, setPage] = useState(1);
  // Collapsed to the first few until the reader asks for the rest.
  const [expanded, setExpanded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(
    (p: number) => {
      clientApi<Paginated<Review> & { meta: typeof meta }>(`/products/${slug}/reviews?page=${p}`, { token: null, cartToken: null })
        .then((res) => {
          setReviews((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
          setMeta(res.meta);
        })
        .catch(() => {});
    },
    [slug]
  );

  useEffect(() => {
    load(page);
  }, [page, load]);

  /*
   * Prefill the name from the signed-in user once, only while the field is
   * still empty — with `name` in the deps this refilled on every clear, so the
   * field could never be edited or emptied. Done during render rather than in
   * an effect so the field is populated on first paint; the sentinel makes it
   * fire once per user rather than on every render.
   */
  const [prefilledFor, setPrefilledFor] = useState<number | null>(null);
  if (user && prefilledFor !== user.id) {
    setPrefilledFor(user.id);
    setName((n) => n || user.name);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await clientApi<{ message?: string }>(`/products/${slug}/reviews`, {
        method: "POST",
        body: { name, rating, title: title || undefined, body },
      });
      setFormOpen(false);
      setTitle("");
      setBody("");
      // A new review waits for admin approval, so it is not shown yet — just
      // confirm it was received.
      setNotice(res?.message || "Thank you! Your review will appear once it is approved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit review.");
    } finally {
      setBusy(false);
    }
  }

  const visible = expanded ? reviews : reviews.slice(0, PREVIEW);
  const total = Math.max(meta.total, reviews.length);
  const allLoaded = meta.current_page >= meta.last_page;

  return (
    <section className={`card p-8 ${className}`} id="reviews">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-[1.5rem] text-ink">Customer Reviews</h2>
          <div className="mt-1 flex items-center gap-2">
            <Stars rating={meta.rating_avg} showValue />
            <span className="text-[12px] text-fog">Based on {meta.rating_count} reviews</span>
          </div>
        </div>
        <button
          onClick={() => {
            setNotice("");
            setFormOpen((v) => !v);
          }}
          className="rounded-full bg-rose-600 px-5 py-2.5 text-[12.5px] text-white transition-colors hover:bg-rose-700"
        >
          {formOpen ? "Close" : "Write a Review"}
        </button>
      </div>

      {notice && (
        <p className="mt-5 rounded-2xl bg-blush-100 px-4 py-3 text-[13px] text-maroon-800">
          {notice}
        </p>
      )}

      {formOpen && (
        <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl bg-blush-50 p-6 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="input-base" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Rating</label>
            <div className="flex items-center gap-1 pt-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} stars`}>
                  <StarSolid className={`h-6 w-6 transition-colors ${i <= rating ? "text-gold" : "text-blush-200"}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Title (optional)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={190} className="input-base" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Review</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} maxLength={2000} className="input-base resize-none" />
          </div>
          {error && <p className="text-[12px] text-red-500 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-3 text-[13px] font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
              {busy && <Spinner className="h-3.5 w-3.5" />} Submit Review
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {reviews.length === 0 ? (
          <p className="text-[13px] text-fog">
            No reviews yet — be the first to share your experience.
          </p>
        ) : (
          <ul className="divide-y divide-blush-200">
            {visible.map((r) => (
              <li key={r.id} className="flex gap-4 py-5 first:pt-0">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[15px] font-semibold text-rose-700">
                  {(r.name.trim()[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[14px] font-semibold text-ink">{r.name}</span>
                    <span className="text-[12px] text-fog">{formatDate(r.created_at)}</span>
                  </div>
                  <Stars rating={r.rating} className="mt-1.5 h-3.5 w-3.5" />
                  {r.title && <p className="mt-2 text-[14px] font-semibold text-ink">{r.title}</p>}
                  <p className="mt-1 text-[13.5px] leading-relaxed text-cocoa">{r.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Collapsed: one button opens everything loaded so far. Open: fetch the
          rest page by page, then offer to fold the list back up. */}
      {!expanded && (reviews.length > PREVIEW || !allLoaded) && (
        <div className="mt-5 text-center">
          <button
            onClick={() => setExpanded(true)}
            className="rounded-full bg-blush-100 px-6 py-2.5 text-[12.5px] font-medium text-cocoa transition-colors hover:bg-blush-150"
          >
            Show all {total} reviews
          </button>
        </div>
      )}
      {expanded && !allLoaded && (
        <div className="mt-5 text-center">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full bg-blush-100 px-6 py-2.5 text-[12.5px] font-medium text-cocoa transition-colors hover:bg-blush-150"
          >
            Load more reviews
          </button>
        </div>
      )}
      {expanded && allLoaded && reviews.length > PREVIEW && (
        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setExpanded(false);
              document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rounded-full px-6 py-2.5 text-[12.5px] font-medium text-fog transition-colors hover:bg-blush-100 hover:text-ink"
          >
            Show fewer
          </button>
        </div>
      )}
    </section>
  );
}
