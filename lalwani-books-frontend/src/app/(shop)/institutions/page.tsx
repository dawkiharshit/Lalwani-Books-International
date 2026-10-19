import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { CheckIcon } from "@/components/icons";
import { DottedPaper } from "@/components/home/doodles";
import { INSTITUTIONS_LINE } from "@/components/home/institutions";
import { QuoteForm } from "./quote-form";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Books for Institutions",
    description: `${INSTITUTIONS_LINE} Request a quote from Lalwani Books International.`,
    path: "/institutions",
  });
}

const POINTS = [
  "One title or a whole library — any quantity",
  "Genuine editions, sourced from publishers and distributors",
  "A GST invoice with every order",
  "Delivered across India",
];

/**
 * Books for Institutions: who it is for, what the shop does, and the quote
 * form. Every request lands in admin → Messages & Subscribers.
 */
export default function InstitutionsPage() {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      <section className="relative overflow-hidden rounded-[var(--radius-hero)] bg-pine-900 px-6 py-10 text-white sm:px-10 lg:sticky lg:top-24 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_100%_0%,rgba(232,176,75,0.16),transparent_65%),radial-gradient(60%_80%_at_0%_100%,rgba(141,177,220,0.16),transparent_65%)]" />
          <DottedPaper dot="rgba(232,238,246,0.12)" />
        </div>
        <div className="relative">
          {/* The page's main heading is the service's name (what people search
              for); the audience line under it is the big display text. */}
          <h1 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-mustard">Books for Institutions</h1>
          <p className="mt-3 text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold leading-tight tracking-[-0.01em]">
            Schools · Universities · Libraries · Corporates
          </p>
          <p className="mt-4 text-[14.5px] leading-relaxed text-parchment/80">{INSTITUTIONS_LINE}</p>

          <ul className="mt-7 space-y-2.5">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[13.5px] text-parchment/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mustard text-rose-800">
                  <CheckIcon className="h-3 w-3" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <QuoteForm />
    </div>
  );
}
