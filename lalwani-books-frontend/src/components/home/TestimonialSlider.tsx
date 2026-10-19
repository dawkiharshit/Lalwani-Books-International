"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QuoteIcon } from "@/components/icons";
import { Portrait } from "@/components/Portrait";
import { Stars } from "@/components/ui";
import type { Testimonial } from "./bookory-client";

/** Two rows at a time, as many cards per row as the screen fits. */
const ROWS = 2;
const COLUMNS = [
  { from: 1280, columns: 3 },
  { from: 640, columns: 2 },
  { from: 0, columns: 1 },
];
/** How long each set of cards stays before the next slides in. */
const EVERY = 7000;

function columnsFor(width: number) {
  return (COLUMNS.find((c) => width >= c.from) ?? COLUMNS[COLUMNS.length - 1]).columns;
}

/**
 * The reader quotes, two rows at a time, sliding on to the next set by
 * itself. How many cards sit in a row follows the screen (three on a
 * computer, two on a tablet, one on a phone), so a set is 6, 4 or 2 cards.
 *
 * It is a scrolling row underneath, so a phone can swipe through it, and the
 * dots jump to any set. Sliding stops while the pointer is over it, while a
 * card has keyboard focus, and for anyone who has asked for less motion.
 */
export function TestimonialSlider({ items }: { items: Testimonial[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);
  const [slide, setSlide] = useState(0);
  const [held, setHeld] = useState(false);
  const still = useRef(false);

  const perSlide = columns * ROWS;
  const slides: Testimonial[][] = [];
  for (let i = 0; i < items.length; i += perSlide) slides.push(items.slice(i, i + perSlide));
  const count = Math.max(slides.length, 1);

  // Follow the screen: the row count is what decides how many sets there are.
  useEffect(() => {
    const read = () => setColumns(columnsFor(window.innerWidth));
    read();
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  const goTo = useCallback((index: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: smooth && !still.current ? "smooth" : "auto" });
  }, []);

  // A narrower screen makes more sets; a wider one fewer. Reading the shown
  // set from the count keeps it in range without storing a stale number.
  const current = Math.min(slide, count - 1);

  // Keep the row lined up with the set it is showing after a resize.
  useEffect(() => {
    goTo(Math.min(slide, count - 1), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a column change only, not on every scroll
  }, [columns, count]);

  useEffect(() => {
    if (held || still.current || count < 2) return;
    const timer = setTimeout(() => {
      const next = (current + 1) % count;
      setSlide(next);
      goTo(next);
    }, EVERY);
    return () => clearTimeout(timer);
  }, [current, held, count, goTo]);

  // Swiping by hand moves the dots with it.
  function onScroll() {
    const el = track.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (index !== current && index >= 0 && index < count) setSlide(index);
  }

  return (
    <div
      className="mt-8"
      role="group"
      aria-roledescription="carousel"
      aria-label="What readers say"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div
        ref={track}
        onScroll={onScroll}
        className="scrollbar-hidden flex snap-x snap-mandatory overflow-x-auto"
      >
        {slides.map((group, i) => (
          <div
            key={i}
            className="w-full shrink-0 snap-start"
            aria-roledescription="slide"
            aria-label={`Set ${i + 1} of ${count}`}
            // Only the set on screen can be tabbed into, so the keyboard does
            // not wander off into cards nobody can see.
            inert={i !== current}
          >
            <ul className="grid gap-4 px-0.5 pb-1 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
              {group.map((t, j) => (
                <li
                  key={t.id}
                  // Before the screen width is known the sets hold six; showing
                  // only two rows' worth meanwhile stops phones and tablets from
                  // flashing a long column of cards as the page loads.
                  className={`flex h-full flex-col rounded-2xl bg-white p-6 shadow-soft transition-shadow duration-300 hover:shadow-lift sm:p-7 ${
                    j >= 2 ? "max-sm:hidden" : ""
                  } ${j >= 4 ? "max-xl:hidden" : ""}`}
                >
                  <QuoteIcon className="h-7 w-7 shrink-0 text-rose-300" />
                  <blockquote className="mt-3 text-[15px] font-semibold leading-relaxed text-ink">&ldquo;{t.content}&rdquo;</blockquote>
                  {t.rating > 0 && <Stars rating={t.rating} size="md" className="mt-4" />}
                  <div className="mt-auto flex items-center gap-3 pt-5">
                    <Portrait name={t.name} photo={t.photo} />
                    <p className="min-w-0 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink">
                      {t.name}
                      {(t.designation || t.location) && (
                        <span className="mt-0.5 block truncate font-normal normal-case tracking-normal text-fog">
                          {[t.designation, t.location].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSlide(i);
                goTo(i);
              }}
              aria-label={`Show reader quotes, set ${i + 1} of ${count}`}
              aria-current={i === current}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === current ? "w-7 bg-rose-700" : "w-2.5 bg-rose-700/30 hover:bg-rose-700/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
