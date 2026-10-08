"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  endNavigation,
  getServerSnapshot,
  getSnapshot,
  noteSubmit,
  resetLoading,
  startNavigation,
  subscribe,
  type LoadingKind,
} from "@/lib/loading-bus";
import { BookLoader } from "./BookLoader";

/**
 * The site-wide loading screen (state in lib/loading-bus.ts):
 *
 *  - a thin coral-to-mustard bar across the top the instant a page change or
 *    a form's save begins, filling as it goes and finishing when it is done;
 *  - if that takes longer than a moment (≈0.3s), a soft blush veil with the
 *    book-spine loader and "Loading…" / "Please wait…". Quick page changes —
 *    most of them, since pages are prefetched — never get as far as the veil.
 *
 * A page change starts from any click on a link to another page of this site
 * (and from startNavigation() before a router.push) and ends when the
 * address changes. A form's veil blocks clicks, so a save cannot be sent
 * twice; the page-change veil lets clicks through, so a link that turns out
 * not to navigate can never trap anyone behind it.
 *
 * Mounted once, in the root layout.
 */
export function LoadingLayer({ siteName }: { siteName: string }) {
  const { kind, run } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.hasAttribute("download") || link.dataset.noLoader !== undefined) return;
      // A button inside a link — Add to cart, the quantity steppers, the
      // wishlist heart on a book card — does its own thing, not a page change.
      const control = target?.closest?.("button, input, select, textarea, label, summary, [role=\"button\"]");
      if (control && link.contains(control)) return;
      if (link.target && link.target !== "_self") return;
      const raw = link.getAttribute("href") ?? "";
      if (raw.startsWith("#") || /^(mailto|tel|sms|javascript):/i.test(raw)) return;
      let url: URL;
      try {
        url = new URL(link.href);
      } catch {
        return;
      }
      // Uploaded files and the API are not pages of this site.
      if (/^\/(storage|api)\//.test(url.pathname)) return;
      startNavigation(url.href);
    }
    function onSubmit(e: Event) {
      const form = e.target as HTMLFormElement | null;
      if (form?.dataset?.noLoader !== undefined) return;
      noteSubmit();
    }
    // A page brought back from the back/forward cache returns as it was left,
    // possibly mid-loader (a link that loaded a whole new document).
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) resetLoading();
    }
    document.addEventListener("click", onClick);
    // Capture, so the window opens before the form's own handler sends its request.
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <RouteWatcher />
      </Suspense>
      <ProgressBar active={kind !== "idle"} run={run} />
      {kind !== "idle" && <Veil key={run} kind={kind} siteName={siteName} />}
      <Announcer kind={kind} />
    </>
  );
}

/**
 * What a screen reader hears: one polite line, only once the wait is long
 * enough for the veil to show — a quick page change says nothing. The veil
 * itself is hidden from assistive technology, so nothing is read twice.
 */
function Announcer({ kind }: { kind: LoadingKind }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setText(kind === "idle" ? "" : kind === "submit" ? "Please wait…" : "Loading…"), kind === "idle" ? 0 : 300);
    return () => clearTimeout(t);
  }, [kind]);
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {text}
    </p>
  );
}

/** Ends the page-change loader once the new address is showing. */
function RouteWatcher() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    endNavigation();
  }, [pathname, search]);
  return null;
}

/**
 * The bar across the top. Driven with the Web Animations API from an effect,
 * so it can finish from wherever it had got to rather than jumping.
 */
function ProgressBar({ active, run }: { active: boolean; run: number }) {
  const bar = useRef<HTMLDivElement>(null);
  const shown = useRef(false);

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (active) {
      shown.current = true;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.opacity = "1";
      if (still) {
        el.style.transform = "scaleX(0.6)";
        return;
      }
      el.animate(
        [
          { transform: "scaleX(0)" },
          { transform: "scaleX(0.25)", offset: 0.04 },
          { transform: "scaleX(0.9)" },
        ],
        { duration: 9000, easing: "cubic-bezier(0.1, 0.7, 0.2, 1)", fill: "forwards" },
      );
      return;
    }

    if (!shown.current) return;
    shown.current = false;
    const from = getComputedStyle(el).transform;
    el.getAnimations().forEach((a) => a.cancel());
    if (still) {
      el.style.opacity = "0";
      return;
    }
    const finish = el.animate(
      [
        { transform: from === "none" ? "scaleX(0.9)" : from, opacity: 1 },
        { transform: "scaleX(1)", opacity: 1, offset: 0.45 },
        { transform: "scaleX(1)", opacity: 0 },
      ],
      { duration: 480, easing: "ease-out", fill: "forwards" },
    );
    finish.onfinish = () => {
      el.style.opacity = "0";
      el.style.transform = "scaleX(0)";
      finish.cancel();
    };
  }, [active, run]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[3px]">
      <div
        ref={bar}
        className="h-full w-full origin-left bg-[linear-gradient(90deg,#f65d4e_0%,#f5a48a_55%,#e8b04b_100%)] opacity-0 shadow-[0_0_12px_rgba(246,93,78,0.55)]"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}

/** The veil with the loader, faded in only once the wait is noticeable. */
function Veil({ kind, siteName }: { kind: Exclude<LoadingKind, "idle">; siteName: string }) {
  const saving = kind === "submit";
  return (
    <div
      aria-hidden
      className={`loading-veil fixed inset-0 z-[110] flex items-center justify-center bg-[#fcf1ed]/70 px-6 backdrop-blur-[3px] ${
        saving ? "" : "pointer-events-none"
      }`}
    >
      <div className="flex flex-col items-center rounded-[1.25rem] bg-white px-9 py-7 text-center shadow-[0_24px_60px_-24px_rgba(199,58,42,0.45)] ring-1 ring-[#f5d9cf]">
        <BookLoader size="md" />
        <p className="mt-4 text-[15px] font-semibold text-ink">{saving ? "Please wait…" : "Loading…"}</p>
        <p className="mt-0.5 text-[11.5px] font-medium uppercase tracking-[0.14em] text-rose-600">{siteName}</p>
      </div>
    </div>
  );
}
