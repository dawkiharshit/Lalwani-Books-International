"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Image from "@/components/Image";
import { BookOpenIcon } from "../icons";
import type { ContentRow } from "./connected";

/** Seconds per circle, so the loop runs at the same pace however many there are. */
const SECONDS_PER_ITEM = 4;

function Circle({ r, tabbable = true }: { r: ContentRow; tabbable?: boolean }) {
  const inner = (
    <>
      <span className="relative block h-24 w-24 overflow-hidden rounded-full bg-blush-100 ring-2 ring-transparent ring-offset-4 transition-all duration-300 group-hover:ring-rose-600 sm:h-28 sm:w-28">
        {r.image ? (
          <Image src={r.image} alt="" fill sizes="112px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : r.initials ? (
          <span
            className="absolute inset-0 flex items-center justify-center text-[1.5rem] font-semibold text-white transition-transform duration-500 group-hover:scale-110"
            style={{ background: `linear-gradient(135deg, ${r.tint?.[0] ?? "#f65d4e"}, ${r.tint?.[1] ?? "#c4382a"})` }}
          >
            {r.initials}
          </span>
        ) : (
          <BookOpenIcon className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-rose-400" />
        )}
      </span>
      {r.title && (
        <span className="mt-3 block max-w-[8rem] text-center text-[13.5px] font-semibold leading-snug text-ink transition-colors group-hover:text-rose-600">
          {r.title}
        </span>
      )}
    </>
  );

  return (
    <li className="shrink-0">
      {r.link_url ? (
        <Link href={r.link_url} className="group block" tabIndex={tabbable ? 0 : -1}>
          {inner}
        </Link>
      ) : (
        <span className="group block">{inner}</span>
      )}
    </li>
  );
}

/**
 * The round shortcut links under the hero. A row that fits sits centred; a
 * longer one glides left to right in a seamless loop (two copies, the track
 * sliding by half its width — see .circle-slider in globals.css), pausing
 * under the pointer or keyboard focus, and standing still for anyone who has
 * asked for reduced motion.
 */
export function CirclesSlider({ rows }: { rows: ContentRow[] }) {
  const frame = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLUListElement>(null);
  // A guess for the first paint; the observer below measures for real.
  const [slide, setSlide] = useState(rows.length >= 7);

  useEffect(() => {
    const el = frame.current;
    const copy = first.current;
    if (!el || !copy) return;
    // ResizeObserver reports once on observe, so this also measures at mount.
    const ro = new ResizeObserver(() => setSlide(copy.scrollWidth > el.clientWidth + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length]);

  const items = rows.map((r) => <Circle key={r.id} r={r} />);

  return (
    <div ref={frame} className={`circle-slider ${slide ? "circle-slider--on" : ""}`}>
      <div
        className="circle-slider__track gap-6 sm:gap-10"
        style={slide ? { animationDuration: `${Math.max(20, rows.length * SECONDS_PER_ITEM)}s` } : undefined}
      >
        <ul ref={first} data-reveal-stagger={slide ? undefined : ""} className="flex shrink-0 gap-6 sm:gap-10">
          {items}
        </ul>
        {slide && (
          <ul aria-hidden className="flex shrink-0 gap-6 sm:gap-10">
            {rows.map((r) => (
              <Circle key={`again-${r.id}`} r={r} tabbable={false} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
