"use client";

import { useEffect, useState } from "react";
import { clientApi } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { CloseIcon } from "@/components/icons";

interface PopupConfig {
  enabled: boolean;
  delay: number;
  showOnce: boolean;
  title: string;
  subtitle: string;
  discount: string;
  button: string;
  disclaimer: string;
  /** Optional picture from admin → Popup Banner; '' for none. */
  image: string;
}

const SEEN_KEY = "lalwani_popup_seen";

/** Email-capture popup — all copy and behaviour come from admin → Popup Banner. */
export function PopupBanner({ config }: { config: PopupConfig }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!config.enabled) return;
    if (config.showOnce) {
      try {
        if (localStorage.getItem(SEEN_KEY)) return;
      } catch {
        /* private mode — just show it */
      }
    }
    const t = setTimeout(() => setOpen(true), Math.max(0, config.delay) * 1000);
    return () => clearTimeout(t);
  }, [config.enabled, config.delay, config.showOnce]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      await clientApi("/newsletter/subscribe", { method: "POST", body: { email }, token: null });
      setState("done");
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
      setTimeout(() => setOpen(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not subscribe.");
      setState("idle");
    }
  }

  if (!open) return null;

  // A picture that fails to load (say, replaced in admin a moment ago while
  // this page was cached) drops out, leaving the plain card, never a broken box.
  const image = imageFailed ? "" : config.image;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-black/45" onClick={dismiss} />
      {/*
        With a picture the card widens on computers into picture | text, and
        on phones stacks the picture above the text. The picture is always
        shown whole (contained, never cropped, so words on a poster survive),
        and the card scrolls inside itself if a short screen cannot hold it.
      */}
      <div
        className={`card relative z-10 max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain p-0 ${
          image ? "max-w-md md:grid md:max-w-3xl md:grid-cols-2" : "max-w-md overflow-hidden"
        }`}
      >
        <button
          onClick={dismiss}
          aria-label="Close popup"
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-cocoa shadow-soft hover:bg-white"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>

        {image && (
          <div className="flex items-center justify-center bg-[linear-gradient(120deg,#e8eff8_0%,#d5e2f1_100%)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- any shape of admin upload, shown at its own ratio */}
            <img
              src={image}
              alt={config.title}
              decoding="async"
              onError={() => setImageFailed(true)}
              className="block h-auto max-h-[38vh] w-full object-contain md:max-h-[80vh]"
            />
          </div>
        )}

        <div className={image ? "md:flex md:flex-col md:justify-center" : ""}>
        <div className={`${image ? "bg-white" : "bg-[linear-gradient(120deg,#e8eff8_0%,#d5e2f1_100%)]"} px-8 py-7 text-center`}>
          {config.discount && (
            <span className="inline-block rounded-full bg-maroon-800 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              {config.discount}
            </span>
          )}
          <h2 className="mt-3 font-serif text-[1.5rem] leading-tight text-ink">{config.title}</h2>
          {config.subtitle && <p className="mt-1.5 text-[12.5px] leading-relaxed text-cocoa">{config.subtitle}</p>}
        </div>

        <div className="px-8 py-6">
          {state === "done" ? (
            <p className="text-center text-[13px] text-green-700">Welcome to the house list ✨</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-base"
              />
              {error && <p className="text-[12px] text-red-500">{error}</p>}
              <button
                disabled={state === "busy"}
                className="flex items-center justify-center gap-2 rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {state === "busy" && <Spinner className="h-4 w-4" />} {config.button || "Subscribe"}
              </button>
              {config.disclaimer && (
                <p className="text-center text-[10.5px] text-fog">{config.disclaimer}</p>
              )}
            </form>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
