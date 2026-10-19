"use client";

import { useState } from "react";

export interface SearchDay {
  date: string;
  searches: number;
  nothing: number;
}

/*
 * The two parts of a day's searches. Slots 1 and 2 of the reference
 * categorical palette, checked with the dataviz validator against the white
 * card: colour-blind separation ΔE 24.7, normal vision 33.6, both above 3:1.
 */
const FOUND = "#2a78d6";
const NOTHING = "#eb6834";

/** A clean top for the scale whose half is a whole number: 4, 6, 8, 10, then 1 / 2 / 5 × 10ⁿ. */
function scaleTop(peak: number) {
  if (peak <= 10) return Math.max(4, peak + (peak % 2));
  const step = 10 ** Math.floor(Math.log10(peak));
  return [1, 2, 5, 10].map((m) => m * step).find((v) => v >= peak) ?? 10 * step;
}

const day = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", ...opts });

/**
 * Searches per day as columns: the part that found books, and on top of it
 * the part that found nothing. Point at (or arrow-key to) a day for its
 * numbers; every number is also in the table under the chart.
 */
export function SearchesChart({ days }: { days: SearchDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  const n = days.length;
  const peak = Math.max(0, ...days.map((d) => d.searches));
  const top = scaleTop(peak);
  const peakIndex = days.findIndex((d) => d.searches === peak);

  // Dates under the columns — every day for a week, else six or so (three on
  // a phone), counted back from today so today is always labelled.
  const every = n <= 7 ? 1 : Math.ceil(n / 6);
  const edge = (i: number, centre: string) => (n > 1 && i === 0 ? "-20%" : n > 1 && i === n - 1 ? "-80%" : centre);

  const pick = active === null ? null : { ...days[active], at: active };

  function keyDown(e: React.KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowLeft: Math.max(0, (active ?? n) - 1),
      ArrowRight: Math.min(n - 1, (active ?? -1) + 1),
      Home: 0,
      End: n - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  }

  if (peak === 0) {
    return <p className="py-10 text-center text-[12.5px] text-fog">No searches on these days yet.</p>;
  }

  return (
    <div>
      {/* Legend: the same shapes as the marks, the words in text colours. */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-cocoa">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: FOUND }} /> Found books
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: NOTHING }} /> Found nothing
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        {/* Scale: 0, half and top, each against a hairline. */}
        <div className="w-7 shrink-0 pt-6 text-right text-[10.5px] tabular-nums text-fog" aria-hidden>
          <div className="relative h-44">
            {[top, top / 2, 0].map((v, i) => (
              <span key={v} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${i * 50}%` }}>
                {v.toLocaleString("en-IN")}
              </span>
            ))}
          </div>
        </div>

        <div className="relative min-w-0 flex-1 pt-6">
          {/* The day pointed at, floating above the columns. */}
          {pick && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 z-10 w-max rounded-xl border border-blush-200 bg-white px-3 py-2 text-[11.5px] shadow-[0_10px_30px_-12px_rgba(4,43,82,0.35)]"
              style={{
                left: `${((pick.at + 0.5) / n) * 100}%`,
                transform: `translate(${pick.at < n * 0.2 ? "-10%" : pick.at > n * 0.8 ? "-90%" : "-50%"}, calc(-100% + 18px))`,
              }}
            >
              <p className="font-semibold text-ink">{day(pick.date, { weekday: "short", day: "numeric", month: "short" })}</p>
              <p className="mt-1 text-cocoa">
                <b className="font-semibold tabular-nums text-ink">{pick.searches}</b> {pick.searches === 1 ? "search" : "searches"}
              </p>
              <p className="flex items-center gap-2 text-cocoa">
                <span className="h-0.5 w-3 rounded-full" style={{ background: FOUND }} />
                <span>
                  <b className="font-semibold tabular-nums text-ink">{pick.searches - pick.nothing}</b> found books
                </span>
              </p>
              <p className="flex items-center gap-2 text-cocoa">
                <span className="h-0.5 w-3 rounded-full" style={{ background: NOTHING }} />
                <span>
                  <b className="font-semibold tabular-nums text-ink">{pick.nothing}</b> found nothing
                </span>
              </p>
            </div>
          )}

          <div
            tabIndex={0}
            role="group"
            aria-label="Searches per day. Use the left and right arrow keys to read each day."
            onKeyDown={keyDown}
            onFocus={() => setActive((a) => a ?? n - 1)}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
            className="relative flex h-44 items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-rose-600/40"
          >
            {/* Hairlines at the top and half, the baseline a step darker. */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-blush-150" aria-hidden />
            <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-blush-150" aria-hidden />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-blush-300" aria-hidden />

            {days.map((d, i) => {
              const found = d.searches - d.nothing;
              return (
                // The day's whole slot answers the pointer, not just its thin column.
                <div
                  key={d.date}
                  onPointerEnter={() => setActive(i)}
                  className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end px-px"
                >
                  {/* The busiest day's total, on its cap. */}
                  {i === peakIndex && (
                    <span
                      className="absolute pb-1 text-[10.5px] font-semibold tabular-nums leading-none text-ink"
                      style={{ bottom: `${(d.searches / top) * 100}%` }}
                    >
                      {d.searches}
                    </span>
                  )}
                  <div
                    className={`flex w-full max-w-6 flex-col justify-end gap-0.5 transition-opacity ${
                      active !== null && active !== i ? "opacity-40" : ""
                    }`}
                    style={{ height: `${(d.searches / top) * 100}%` }}
                  >
                    {d.nothing > 0 && (
                      <span className="block min-h-0.5 rounded-t-[4px]" style={{ flexGrow: d.nothing, background: NOTHING }} />
                    )}
                    {found > 0 && (
                      <span
                        className={`block min-h-0.5 ${d.nothing > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ flexGrow: found, background: FOUND }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mt-2 h-4 text-[10.5px] text-fog" aria-hidden>
            {days.map((d, i) =>
              (n - 1 - i) % every === 0 ? (
                <span
                  key={d.date}
                  // On a phone every other date, so neighbours never touch.
                  className={`absolute top-0 whitespace-nowrap ${n > 7 && ((n - 1 - i) / every) % 2 === 1 ? "max-sm:hidden" : ""}`}
                  style={{ left: `${((i + 0.5) / n) * 100}%`, transform: `translateX(${edge(i, "-50%")})` }}
                >
                  {n <= 7 ? day(d.date, { weekday: "short" }) : day(d.date, { day: "numeric", month: "short" })}
                </span>
              ) : null
            )}
          </div>

          <p className="sr-only" aria-live="polite">
            {pick
              ? `${day(pick.date, { weekday: "long", day: "numeric", month: "long" })}: ${pick.searches} searches, ${pick.nothing} found nothing.`
              : ""}
          </p>
        </div>
      </div>

      {/* The same numbers as a table, for reading without pointing. */}
      <details className="mt-4 text-[12px]">
        <summary className="cursor-pointer select-none text-rose-600 hover:underline">See the numbers by day</summary>
        <div className="mt-3 max-h-72 overflow-auto rounded-xl border border-blush-200">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-blush-50 text-[10.5px] uppercase tracking-wide text-fog">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">Searches</th>
                <th className="px-3 py-2 text-right font-medium">Found nothing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush-100 tabular-nums">
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5 text-cocoa">{day(d.date, { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{d.searches}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{d.nothing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
