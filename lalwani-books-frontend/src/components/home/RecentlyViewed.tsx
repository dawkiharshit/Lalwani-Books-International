"use client";

import { clearRecentlyViewed, useRecentBooks } from "@/lib/recently-viewed";
import { BookRail } from "./bookory-client";
import { SectionHead } from "./section-head";

/**
 * "Recently Viewed": the books this shopper opened (RememberViewed on each
 * book's page), newest first. It is read from this browser after the page
 * loads — the home page itself is the same for everyone — so it stays hidden
 * for a first visit and appears below the fold for a returning one. Prices
 * and stock are today's; a book no longer on sale drops out. The header's
 * "Recently Viewed" menu shows the same list (RecentlyViewedNav).
 */
export function RecentlyViewed({ title }: { title: string }) {
  const { books } = useRecentBooks();

  if (!books || books.length === 0) return null;

  return (
    <section id="recently-viewed" className="container-shop scroll-mt-24 pt-16 lg:pt-20" aria-label={title}>
      <SectionHead
        title={title}
        action={
          <button
            type="button"
            onClick={clearRecentlyViewed}
            className="rounded-full border border-blush-200 px-4 py-2 text-[12px] font-semibold text-cocoa transition-colors hover:border-rose-600 hover:text-rose-600"
          >
            Clear
          </button>
        }
      />
      <BookRail products={books} />
    </section>
  );
}
