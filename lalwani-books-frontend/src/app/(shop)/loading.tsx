import { BookLoader } from "@/components/loading/BookLoader";

/**
 * Shown the instant a link is clicked, while a page that renders on demand
 * (shop filters and searches, blog posts, order pages) is still on its way.
 * Without it the old page simply froze until the server answered, which reads
 * as a dead click. Pre-rendered pages arrive with their prefetch and skip this.
 *
 * The shop's book-spine loader over a shelf of shimmering book cards, so the
 * wait already looks like the page that is coming. Header and footer belong
 * to the (shop) layout and stay put; this only fills <main>.
 */
export default function ShopLoading() {
  return (
    <div role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 py-6 text-fog">
        <BookLoader size="md" />
        <p className="text-[13px] font-medium">Loading…</p>
      </div>
      <div aria-hidden className="mt-2 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i}>
            <div className="skeleton relative overflow-hidden rounded-[10px] pb-[140%]" />
            <div className="skeleton mt-4 h-3.5 w-4/5 rounded-full" />
            <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
            <div className="skeleton mt-3 h-4 w-1/3 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
