import Link from "next/link";
import { ChevronIcon } from "../icons";

/**
 * Section title on the left, a hairline, and a coral "View All" pill — or
 * `action` in its place. Its own file so a client section can use it without
 * pulling in the rest of the home page (bookory.tsx).
 */
export function SectionHead({
  title,
  href,
  label = "View All",
  action,
}: {
  title: string;
  href?: string;
  label?: string;
  action?: React.ReactNode;
}) {
  return (
    <div data-reveal className="mb-8 flex items-center gap-6">
      <h2 className="shrink-0 text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.85rem]">{title}</h2>
      <span aria-hidden className="hidden h-px flex-1 bg-blush-200 sm:block" />
      {href && (
        <Link
          href={href}
          className="group/va ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-5 py-2.5 text-[12.5px] font-semibold text-white transition-all hover:bg-rose-700 hover:shadow-[0_10px_24px_-10px_rgba(4,43,82,0.45)] sm:ml-0"
        >
          {label}
          <ChevronIcon className="h-3 w-3 -rotate-90 transition-transform group-hover/va:translate-x-0.5" strokeWidth={2.4} />
        </Link>
      )}
      {action && <div className="ml-auto shrink-0 sm:ml-0">{action}</div>}
    </div>
  );
}
