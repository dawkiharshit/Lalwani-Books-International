"use client";

import { useEffect, useState } from "react";
import { API_BASE, getAuthToken } from "@/admin/lib/api";
import { clock, settleDuration } from "@/lib/audio";

/** Tells the sidebar's Voice Queries count to look again. */
export const VOICE_QUERIES_CHANGED = "lalwani:voice-queries-changed";

export interface VoiceQuery {
  id: string;
  created_at: string;
  phone: string | null;
  user: { id: number; name: string; email: string } | null;
  page: string | null;
  seconds: number;
  bytes: number;
  type: string;
  status: "new" | "answered";
  answered_at: string | null;
}

/**
 * One recording. It sits in private storage, so it is fetched with the
 * admin's sign-in when Play is pressed and played from memory (like the
 * photos on Approvals) — nothing is downloaded until then.
 */
export function Recording({ query }: { query: VoiceQuery }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );

  async function load() {
    setState("loading");
    try {
      const res = await fetch(`${API_BASE}/admin/voice-queries/${query.id}/audio`, {
        headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      setUrl(URL.createObjectURL(await res.blob()));
      setState("idle");
    } catch {
      setState("error");
    }
  }

  if (url) {
    return (
      <audio
        controls
        src={url}
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          settleDuration(audio);
          void audio.play().catch(() => {});
        }}
        className="h-10 w-full max-w-md"
        aria-label={`Recording, ${clock(query.seconds)}`}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={load}
        disabled={state === "loading"}
        className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path d="M7 4.5v15l13-7.5z" />
        </svg>
        {state === "loading" ? "Loading…" : `Play · ${clock(query.seconds)}`}
      </button>
      {state === "error" && <span className="text-[12px] text-red-600">The recording could not be loaded. Try again.</span>}
    </div>
  );
}
