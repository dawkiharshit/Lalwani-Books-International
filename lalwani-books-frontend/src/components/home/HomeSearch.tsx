import Link from "next/link";
import type { Category } from "@/lib/types";
import { DottedPaper } from "@/components/home/doodles";
import { SearchBox } from "@/components/search/SearchBox";

/**
 * "What are you looking for?" — the home page's search, right under the
 * banners: one big box with live suggestions (books, authors, categories,
 * ISBN), and the most stocked subjects as one-tap shortcuts.
 */
export function HomeSearch({ categories }: { categories: Category[] }) {
  const popular = [...categories]
    .filter((c) => c.products_count > 0)
    .sort((a, b) => b.products_count - a.products_count)
    .slice(0, 6)
    .map((c) => ({ label: c.name, href: `/collection?category=${c.slug}` }));

  return (
    <section className="container-shop pt-10 lg:pt-14" aria-labelledby="home-search">
      {/* No overflow clipping on this box: the suggestions drop down over the page below. */}
      <div data-reveal className="relative rounded-[var(--radius-hero)] bg-[linear-gradient(135deg,#eef3f9_0%,#e3ebf5_100%)] px-5 py-9 sm:px-10 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-hero)]">
          <div className="absolute inset-0 bg-[radial-gradient(40%_80%_at_100%_0%,rgba(232,176,75,0.18),transparent_70%)]" />
          <DottedPaper dot="rgba(4,43,82,0.09)" />
        </div>
        <div className="relative mx-auto max-w-2xl text-center">
          <h2 id="home-search" className="text-[clamp(1.5rem,3.2vw,2.2rem)] font-semibold tracking-[-0.02em] text-ink">
            What are you looking for?
          </h2>
          <p className="mt-2 text-[14px] text-cocoa">Search by title, author, ISBN or subject</p>
          <div className="mt-6 text-left">
            <SearchBox popular={popular} />
          </div>
          {popular.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[12px] font-semibold text-fog">Popular:</span>
              {popular.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="rounded-full bg-white px-3 py-1.5 text-[12.5px] text-cocoa ring-1 ring-blush-200 transition-colors hover:bg-rose-600 hover:text-white hover:ring-rose-600"
                >
                  {p.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
