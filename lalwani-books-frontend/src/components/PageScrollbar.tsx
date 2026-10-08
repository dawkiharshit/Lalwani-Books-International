"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const INSET = 3; // px from the window edge and from top/bottom
const MIN_THUMB = 40;
const IDLE_MS = 1200;
const FINE = "(pointer: fine)";

function subscribePointer(onChange: () => void) {
  const mq = window.matchMedia(FINE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const isFinePointer = () => window.matchMedia(FINE).matches;

/**
 * A slim coral scrollbar that floats over the page instead of sitting in a
 * reserved white gutter. The browser's own page scrollbar is hidden for mouse
 * users in globals.css (`html.overlay-scrollbar`); touch devices keep their
 * native overlay bars, so this renders nothing there.
 *
 * It mirrors the page's scroll position, can be dragged, and a click on the
 * empty track jumps a page. Wheel, keyboard and touch scrolling are untouched —
 * this only draws the bar.
 */
export function PageScrollbar() {
  // Mouse/trackpad devices only; touch keeps the native overlay bars.
  const enabled = useSyncExternalStore(subscribePointer, isFinePointer, () => false);
  const [geo, setGeo] = useState({ top: 0, height: 0, show: false });
  const [active, setActive] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ startY: number; startScroll: number } | null>(null);

  const measure = useCallback(() => {
    const doc = document.documentElement;
    const view = window.innerHeight;
    const total = doc.scrollHeight;
    if (total <= view + 1) {
      setGeo((g) => (g.show ? { ...g, show: false } : g));
      return;
    }
    const track = view - INSET * 2;
    const height = Math.max(MIN_THUMB, (view / total) * track);
    const top = INSET + (window.scrollY / (total - view)) * (track - height);
    setGeo({ top, height, show: true });
  }, []);

  const wake = useCallback(() => {
    setActive(true);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => {
      if (!drag.current) setActive(false);
    }, IDLE_MS);
  }, []);

  // Switch the native page bar off while this one is drawn.
  useEffect(() => {
    document.documentElement.classList.toggle("overlay-scrollbar", enabled);
    return () => document.documentElement.classList.remove("overlay-scrollbar");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onScroll = () => {
      measure();
      wake();
    };
    const first = requestAnimationFrame(measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    // Page height changes as images load, sections reveal and routes change.
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      cancelAnimationFrame(first);
      if (idle.current) clearTimeout(idle.current);
    };
  }, [enabled, measure, wake]);

  if (!enabled || !geo.show) return null;

  const scrollFromThumb = (clientY: number) => {
    const d = drag.current;
    if (!d) return;
    const doc = document.documentElement;
    const view = window.innerHeight;
    const track = view - INSET * 2 - geo.height;
    const ratio = (doc.scrollHeight - view) / Math.max(track, 1);
    window.scrollTo({ top: d.startScroll + (clientY - d.startY) * ratio, behavior: "instant" });
  };

  return (
    <div
      aria-hidden
      className="group fixed inset-y-0 right-0 z-[60] w-3"
      onMouseEnter={wake}
      onPointerDown={(e) => {
        // A click on the empty track pages up or down, like a native bar.
        if (e.target !== e.currentTarget) return;
        const dir = e.clientY < geo.top ? -1 : 1;
        window.scrollBy({ top: dir * window.innerHeight * 0.9, behavior: "smooth" });
      }}
    >
      <div
        className={`absolute right-[3px] w-[5px] cursor-grab rounded-full bg-rose-400 transition-[opacity,width,background-color] duration-300 hover:w-[7px] hover:bg-rose-500 active:cursor-grabbing active:bg-rose-600 ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ top: geo.top, height: geo.height }}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { startY: e.clientY, startScroll: window.scrollY };
          setActive(true);
        }}
        onPointerMove={(e) => scrollFromThumb(e.clientY)}
        onPointerUp={(e) => {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          drag.current = null;
          wake();
        }}
      />
    </div>
  );
}
