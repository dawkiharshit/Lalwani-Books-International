"use client";

import { useEffect } from "react";

/** Give up putting a page back after this long (its content never arrived). */
const GIVE_UP_MS = 8000;
/** A page counts as settled once its height has held still this long. */
const SETTLED_MS = 700;
/** Where each page of this tab was left (sessionStorage), newest last. */
const STORE = "lbi-scroll";
const KEEP = 60;
/** The shopper taking over: stop putting the page back. */
const TAKE_OVER = ["pointerdown", "touchstart", "wheel", "keydown"] as const;

type NavigationLike = { currentEntry?: { key?: string } | null };

/** The history entry on screen: the browser's own key for it where it has one, else its address. */
function entryKey(): string {
  const nav = (window as { navigation?: NavigationLike }).navigation;
  return nav?.currentEntry?.key || location.pathname + location.search + location.hash;
}

function loadPositions(): Map<string, number> {
  try {
    const raw = sessionStorage.getItem(STORE);
    return new Map(raw ? (JSON.parse(raw) as [string, number][]) : []);
  } catch {
    return new Map();
  }
}

/**
 * Back and Forward return the shopper to the spot they left, straight away.
 *
 * The browser restores that spot itself, but only as far as the page is tall
 * at that moment, and with the site's smooth scrolling it glides there from
 * the top. Pages that load their content after they open — wishlist, cart,
 * account, orders — are still a short loading card then, so the shopper came
 * back near the top instead. This remembers where each page was left and, on
 * Back/Forward, puts it back instantly, holding the spot while late content
 * arrives. It lets go as soon as the shopper touches, scrolls or types. Not
 * used in the admin panel.
 */
export function BackForwardScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const positions = loadPositions();
    const inAdmin = () => location.pathname.startsWith("/admin");
    let restoring: (() => void) | null = null;
    let frame = 0;
    let saveTimer = 0;

    const persist = () => {
      try {
        sessionStorage.setItem(STORE, JSON.stringify([...positions].slice(-KEEP)));
      } catch {
        // Storage full or blocked: positions still work for this visit.
      }
    };

    const remember = () => {
      frame = 0;
      if (restoring || inAdmin()) return;
      const key = entryKey();
      positions.delete(key); // re-added, so the newest survive trimming
      positions.set(key, Math.round(window.scrollY));
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(persist, 400);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(remember);
    };

    const restore = (target: number) => {
      restoring?.();
      const href = location.href;
      const started = performance.now();
      let changedAt = started;
      let lastHeight = -1;
      let raf = 0;
      // Jump rather than glide, and keep the browser's scroll anchoring from
      // nudging the page while it is being put back.
      const { scrollBehavior, overflowAnchor } = html.style;
      html.style.scrollBehavior = "auto";
      html.style.overflowAnchor = "none";

      const stop = () => {
        cancelAnimationFrame(raf);
        TAKE_OVER.forEach((type) => window.removeEventListener(type, stop, true));
        html.style.scrollBehavior = scrollBehavior;
        html.style.overflowAnchor = overflowAnchor;
        restoring = null;
        remember();
      };
      const tick = () => {
        const now = performance.now();
        if (location.href !== href || now - started > GIVE_UP_MS) return stop();
        const height = html.scrollHeight;
        if (height !== lastHeight) {
          lastHeight = height;
          changedAt = now;
        }
        const wanted = Math.max(0, Math.min(target, height - window.innerHeight));
        if (Math.abs(window.scrollY - wanted) > 1) window.scrollTo(0, wanted);
        if (now - changedAt > SETTLED_MS && Math.abs(window.scrollY - target) <= 1) return stop();
        raf = requestAnimationFrame(tick);
      };

      TAKE_OVER.forEach((type) => window.addEventListener(type, stop, { capture: true, passive: true }));
      restoring = stop;
      raf = requestAnimationFrame(tick);
    };

    const onPopState = () => {
      if (inAdmin()) return;
      const target = positions.get(entryKey());
      if (target !== undefined) restore(target);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", persist);

    // Back/Forward into this tab from another page load (not the browser's
    // instant page cache): put it back the same way.
    const load = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (load?.type === "back_forward" && !inAdmin()) {
      const target = positions.get(entryKey());
      if (target) restore(target);
    }

    return () => {
      restoring?.();
      cancelAnimationFrame(frame);
      window.clearTimeout(saveTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", persist);
    };
  }, []);

  return null;
}
