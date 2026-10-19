"use client";

import { useEffect, useState } from "react";
import { clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { STOREFRONT_URL } from "@/admin/lib/storefront";
import { clock } from "@/lib/audio";
import { Recording, VOICE_QUERIES_CHANGED, type VoiceQuery } from "./recording";

type Tab = "new" | "answered" | "all";

interface Page {
  data: VoiceQuery[];
  meta: { page: number; last_page: number; total: number; new: number; keep_days: number };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** "9810012345" → "+91 98100 12345" */
const shown = (phone: string) => `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;

/**
 * Admin → Voice Queries: questions customers recorded with the mic button on
 * the website. Play one, call or WhatsApp them back, then mark it answered.
 */
export default function VoiceQueries() {
  const [tab, setTab] = useState<Tab>("new");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<VoiceQuery | null>(null);
  const [reloadAt, setReloadAt] = useState(0);

  useEffect(() => {
    let current = true;
    clientApi<Page>(`/admin/voice-queries?status=${tab}&page=${page}`)
      .then((res) => {
        if (!current) return;
        setList(res);
        setError("");
      })
      .catch((err) => current && setError(describeError(err, "load the voice queries")));
    return () => {
      current = false;
    };
  }, [tab, page, reloadAt]);

  function changed() {
    setReloadAt((n) => n + 1);
    window.dispatchEvent(new Event(VOICE_QUERIES_CHANGED));
  }

  async function mark(q: VoiceQuery, answered: boolean) {
    setBusy(q.id);
    try {
      await clientApi(`/admin/voice-queries/${q.id}`, { method: "PUT", body: { answered } });
      changed();
    } catch (err) {
      setError(describeError(err, "update it"));
    } finally {
      setBusy(null);
    }
  }

  async function remove(q: VoiceQuery) {
    setBusy(q.id);
    try {
      await clientApi(`/admin/voice-queries/${q.id}`, { method: "DELETE" });
      setDeleting(null);
      changed();
    } catch (err) {
      setDeleting(null);
      setError(describeError(err, "delete it"));
    } finally {
      setBusy(null);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "new", label: list?.meta.new ? `New (${list.meta.new})` : "New" },
    { key: "answered", label: "Answered" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* The words take the card's width; the tabs sit at its right, and below them on a phone. */}
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[1.6rem] text-ink">Voice Queries</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fog">
            Questions customers recorded with the mic button on the website. Play one, call or WhatsApp them back, then
            mark it answered.
          </p>
        </div>
        <div role="tablist" aria-label="Show" className="flex shrink-0 self-start rounded-full bg-blush-50 p-1 text-[12px] sm:self-center">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
                setList(null);
              }}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 ${tab === t.key ? "bg-white font-semibold text-ink shadow-sm" : "text-fog hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      {!list ? (
        !error && (
          <div className="card flex items-center justify-center gap-2 py-16 text-fog">
            <Spinner className="h-5 w-5" /> Loading...
          </div>
        )
      ) : list.data.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[12.5px] text-fog">
          {tab === "new"
            ? "No new voice queries. Customers record them with the mic button at the bottom right of the website, just above WhatsApp."
            : tab === "answered"
              ? "Nothing marked answered yet."
              : "No voice queries yet. Customers record them with the mic button at the bottom right of the website, just above WhatsApp."}
        </p>
      ) : (
        list.data.map((q) => (
          <article key={q.id} className="card flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {q.phone ? (
                  <p className="text-[15px] font-semibold text-ink">{shown(q.phone)}</p>
                ) : (
                  <p className="text-[15px] font-semibold text-ink">No number left</p>
                )}
                {q.user && (
                  <p className="mt-0.5 break-words text-[12.5px] text-cocoa">
                    Signed-in customer: {q.user.name} · {q.user.email}
                  </p>
                )}
                <p className="mt-0.5 text-[12px] text-fog">
                  {when(q.created_at)} · {clock(q.seconds)}
                  {q.page && (
                    <>
                      {" · from "}
                      {STOREFRONT_URL ? (
                        <a
                          href={`${STOREFRONT_URL}${q.page}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all underline-offset-2 hover:text-rose-600 hover:underline"
                        >
                          {q.page}
                        </a>
                      ) : (
                        <span className="break-all">{q.page}</span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  q.status === "new" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"
                }`}
              >
                {q.status === "new" ? "New" : `Answered${q.answered_at ? ` · ${when(q.answered_at)}` : ""}`}
              </span>
            </div>

            <Recording query={q} />

            <div className="flex flex-wrap items-center gap-2">
              {q.phone && (
                <>
                  <a
                    href={`tel:+91${q.phone}`}
                    className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa transition-colors hover:bg-blush-100"
                  >
                    Call
                  </a>
                  <a
                    href={`https://wa.me/91${q.phone}?text=${encodeURIComponent("Hello! This is Lalwani Books International — about the question you sent us by voice on our website.")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa transition-colors hover:bg-blush-100"
                  >
                    WhatsApp
                  </a>
                </>
              )}
              <button
                type="button"
                disabled={busy === q.id}
                onClick={() => mark(q, q.status === "new")}
                className="rounded-full bg-maroon-800 px-4 py-1.5 text-[12px] text-white transition-colors hover:bg-maroon-900 disabled:opacity-60"
              >
                {q.status === "new" ? "Mark as answered" : "Mark as new"}
              </button>
              <button
                type="button"
                disabled={busy === q.id}
                onClick={() => setDeleting(q)}
                className="ml-auto rounded-full px-3 py-1.5 text-[12px] text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </article>
        ))
      )}

      {list && list.meta.last_page > 1 && (
        <div className="flex items-center justify-center gap-3 text-[12.5px]">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-blush-200 bg-white px-4 py-1.5 text-cocoa hover:bg-blush-100 disabled:opacity-50"
          >
            ← Newer
          </button>
          <span className="text-fog">
            Page {list.meta.page} of {list.meta.last_page}
          </span>
          <button
            type="button"
            disabled={page >= list.meta.last_page}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-blush-200 bg-white px-4 py-1.5 text-cocoa hover:bg-blush-100 disabled:opacity-50"
          >
            Older →
          </button>
        </div>
      )}

      {list && (
        <p className="px-1 text-[11.5px] leading-relaxed text-fog">
          Recordings are kept privately — only you and staff with Inbox access can play them — and are deleted after{" "}
          {list.meta.keep_days} days.
        </p>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this voice query?"
        body="The recording and the number are removed for good."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting !== null && busy === deleting.id}
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
