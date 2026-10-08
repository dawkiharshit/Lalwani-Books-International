"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { money } from "@/admin/lib/format";

/*
 * Layout effect on the client, plain effect on the server — React warns about
 * useLayoutEffect during SSR, and there is nothing to measure there anyway.
 */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const FORMAT = {
  money: (n: number) => money(n),
  count: (n: number) => Math.round(n).toLocaleString("en-IN"),
} as const;

/** Fast off the mark, then settles — the curve that reads as "counting", not "sliding". */
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * A number that counts up to its value.
 *
 * The markup always holds the FINAL value, so the server render, the hydration
 * snapshot and a reader with JavaScript off all see the right figure. The
 * layout effect then resets it to the start before the first paint — so there
 * is no flash of the real number followed by a drop to zero — and a single rAF
 * loop writes each frame straight into the text node.
 *
 * Direct DOM writes rather than state: a setState per frame would re-render
 * the whole dashboard sixty times a second for twenty-odd numbers, and setting
 * state from an effect is what react-hooks/set-state-in-effect forbids.
 *
 * `kind` is a string rather than a format function so the effect's
 * dependencies stay stable; a function prop would be a new identity on every
 * render and restart the count.
 */
export function CountUp({
  value,
  kind = "count",
  duration = 1100,
  delay = 0,
}: {
  value: number;
  kind?: keyof typeof FORMAT;
  duration?: number;
  /** Milliseconds to hold at the start value — used to stagger a row of numbers. */
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Where the next run starts from: zero on mount, the last value after that,
  // so a refreshed figure counts from what was on screen rather than from 0.
  const from = useRef(0);
  const format = FORMAT[kind];
  const final = format(value);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const start = from.current;
    from.current = value;

    // Nothing to animate, or the reader asked for less motion.
    const still =
      !Number.isFinite(value) ||
      start === value ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      el.textContent = format(value);
      return;
    }

    el.textContent = format(start);

    let frame = 0;
    let began = 0;

    const tick = (now: number) => {
      if (!began) began = now;
      const t = Math.min(Math.max(0, now - began - delay) / duration, 1);

      // Exact on the last frame: the eased curve approaches 1 but the final
      // figure must be the real value, not a rounding of it.
      el.textContent = t >= 1 ? format(value) : format(start + (value - start) * easeOutExpo(t));

      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, kind, duration, delay, format]);

  return (
    <>
      {/* Tabular figures so the width does not twitch as the digits change. */}
      <span ref={ref} aria-hidden style={{ fontVariantNumeric: "tabular-nums" }}>
        {final}
      </span>
      {/* Screen readers get the figure once, not a stream of intermediate ones. */}
      <span className="sr-only">{final}</span>
    </>
  );
}
