"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** How long each step stays before the row moves on by one card. */
const EVERY = 4500;
/** After someone swipes or scrolls the row by hand, wait this long before sliding again. */
const AFTER_TOUCH = 8000;

/**
 * A sideways row of cards that slides on by one card at a time by itself and
 * goes back to the start after the last — no arrows or dots, the cards are
 * the whole design. It still scrolls and swipes by hand as before.
 *
 * It holds still while the pointer is over it, while a card has keyboard
 * focus, for a while after a swipe, when every card already fits, and for
 * anyone who has asked for less motion.
 */
export function AutoScrollRow({ className, children }: { className: string; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = row.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let hovered = false;
    let focused = false;
    let restUntil = 0;

    const step = () => {
      if (hovered || focused || Date.now() < restUntil) return;
      const room = el.scrollWidth - el.clientWidth;
      if (room < 4) return; // everything fits: nothing to slide
      if (el.scrollLeft >= room - 4) {
        el.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      // The next card whose left edge is past the current position.
      const start = el.getBoundingClientRect().left;
      const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
      const next = [...el.children]
        .map((c) => c.getBoundingClientRect().left - start + el.scrollLeft - pad)
        .find((x) => x > el.scrollLeft + 4);
      el.scrollTo({ left: Math.min(next ?? room, room), behavior: "smooth" });
    };

    const timer = window.setInterval(step, EVERY);
    const enter = () => (hovered = true);
    const leave = () => (hovered = false);
    const focusIn = () => (focused = true);
    const focusOut = () => (focused = el.contains(document.activeElement));
    const touched = () => (restUntil = Date.now() + AFTER_TOUCH);

    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    el.addEventListener("focusin", focusIn);
    el.addEventListener("focusout", focusOut);
    el.addEventListener("touchstart", touched, { passive: true });
    el.addEventListener("wheel", touched, { passive: true });
    return () => {
      window.clearInterval(timer);
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
      el.removeEventListener("focusin", focusIn);
      el.removeEventListener("focusout", focusOut);
      el.removeEventListener("touchstart", touched);
      el.removeEventListener("wheel", touched);
    };
  }, []);

  return (
    <div ref={row} data-reveal-stagger className={className}>
      {children}
    </div>
  );
}
