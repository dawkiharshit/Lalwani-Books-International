"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Floating scroll helper. Only one control shows at a time, following the
 * reader's direction: scroll down and the "to bottom" arrow appears, scroll up
 * and the "to top" arrow appears. Each hides once that end is reached. Works on
 * touch and desktop alike.
 */
export function ScrollButtons() {
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const doc = document.documentElement;
      setAtTop(y < 60);
      setAtBottom(y + window.innerHeight >= doc.scrollHeight - 80);
      const delta = y - lastY.current;
      // Ignore tiny jitters so the direction doesn't flicker.
      if (Math.abs(delta) > 4) {
        setDir(delta > 0 ? "down" : "up");
        lastY.current = y;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const toBottom = () =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });

  const showUp = dir === "up" && !atTop;
  const showDown = dir === "down" && !atBottom;

  return (
    <div className="fixed bottom-5 right-4 z-30 h-10 w-10 sm:bottom-6 sm:right-6 sm:h-11 sm:w-11">
      {/* Up — appears while scrolling up */}
      <button
        type="button"
        onClick={toTop}
        aria-label="Scroll to top"
        aria-hidden={!showUp}
        className={`absolute inset-0 flex items-center justify-center rounded-full bg-maroon-800 text-white shadow-lift transition-all duration-300 hover:bg-maroon-900 ${
          showUp ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>

      {/* Down — appears while scrolling down */}
      <button
        type="button"
        onClick={toBottom}
        aria-label="Scroll to bottom"
        aria-hidden={!showDown}
        className={`absolute inset-0 flex items-center justify-center rounded-full bg-white text-maroon-800 shadow-lift ring-1 ring-blush-200 transition-all duration-300 hover:bg-blush-50 ${
          showDown ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
