"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A row that fits its frame sits still and centred; a row wider than the
 * frame glides left to right in a seamless loop — two copies of the items,
 * the track sliding by exactly half its width (see .marquee in globals.css) —
 * pausing under the pointer or keyboard focus, and standing still for anyone
 * who has asked for reduced motion. Children are <li>s; the second copy is
 * hidden from assistive technology so nothing is read twice.
 */
export function Marquee({
  children,
  count,
  secondsPerItem = 6,
  minSeconds = 24,
  className = "",
}: {
  children: ReactNode;
  /** How many items `children` holds — sets the pace so the loop runs at the same speed however many there are. */
  count: number;
  secondsPerItem?: number;
  minSeconds?: number;
  className?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLUListElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = frame.current;
    const copy = first.current;
    if (!el || !copy) return;
    // ResizeObserver reports once on observe, so this also measures at mount.
    const ro = new ResizeObserver(() => setOn(copy.scrollWidth > el.clientWidth + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  return (
    // The caller's spacing goes on this wrapper: .marquee's own negative margin
    // (the room it keeps for the cards' shadows) would otherwise cancel it.
    <div className={className}>
      <div ref={frame} className={`marquee ${on ? "marquee--on" : ""}`}>
        <div className="marquee__track" style={on ? { animationDuration: `${Math.max(minSeconds, count * secondsPerItem)}s` } : undefined}>
          <ul ref={first} className="marquee__copy">
            {children}
          </ul>
          <ul className="marquee__copy marquee__copy--dup" aria-hidden>
            {children}
          </ul>
        </div>
      </div>
    </div>
  );
}
