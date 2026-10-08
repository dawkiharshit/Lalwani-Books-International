"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronIcon } from "@/components/icons";

/**
 * "About this book": the first lines of the description with a "More details"
 * button. Opening it shows the whole description, the book's details (author,
 * publisher, binding…) and the delivery and returns notes in one place, and
 * the button turns into "Fewer details". Closed by default on every screen
 * size, so the page stays short until a shopper asks for more.
 */
export function ProductDetails({
  description,
  details,
  delivery,
}: {
  description: string;
  details: { label: string; value: string }[];
  /** The delivery & returns list, rendered by the page since it needs the shop's settings. */
  delivery: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const heading = "text-[12px] font-semibold font-accent uppercase tracking-[0.18em] text-rose-500";

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-blush-200 p-5 sm:p-6 md:rounded-none md:border-0 md:p-0">
      <h2 id={`${id}-title`} className={heading}>
        About this book
      </h2>
      <p className={`mt-3 whitespace-pre-line text-[14px] leading-relaxed text-cocoa ${open ? "" : "line-clamp-3"}`}>{description}</p>

      <div id={`${id}-more`} hidden={!open} className="mt-6 space-y-6">
        {details.length > 0 && (
          <div>
            <h3 className={heading}>Book Details</h3>
            <dl className="mt-3 divide-y divide-blush-200 text-[13.5px]">
              {details.map((d) => (
                <div key={d.label} className="grid grid-cols-[120px_1fr] gap-4 py-2.5">
                  <dt className="text-fog">{d.label}</dt>
                  <dd className="font-medium text-ink">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div>
          <h3 className={heading}>Delivery &amp; Returns</h3>
          <div className="mt-3">{delivery}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-more`}
        className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-blush-200 px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-rose-300 hover:text-rose-600"
      >
        {open ? "Fewer details" : "More details"}
        <ChevronIcon className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
    </section>
  );
}
