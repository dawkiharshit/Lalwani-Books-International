import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Author, Category, Paginated, ProductCard as ProductCardType, Publisher } from "@/lib/types";
import { initialsOf } from "@/lib/format";
import Image from "@/components/Image";
import { ProductCard } from "@/components/ProductCard";
import { PageBanner } from "@/components/PageBanner";
import { Pagination } from "./filters";
import { FilterSidebar } from "./filter-sidebar";
import { CollectionToolbar } from "./toolbar";
import { plainSnippet } from "@/lib/seo";

const SHOP_DESCRIPTION =
  "Browse fiction, Indian literature, children’s, academic, competitive-exam, business, self-help and science books.";

/**
 * A title, description and canonical address for each kind of listing, so a
 * category, author or publisher page can rank for its own name. Sorting and
 * price filters only reorder the same books, so the canonical leaves them out.
 * Search results are thin and endless: they stay out of the index, links on
 * them are still followed. The lists come from the same cached requests the
 * page makes.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const page = Math.max(1, Math.floor(Number(get("page")) || 1));
  const onPage = (canonical: string) => (page > 1 ? `${canonical}${canonical.includes("?") ? "&" : "?"}page=${page}` : canonical);
  const suffix = page > 1 ? ` — Page ${page}` : "";

  const search = get("search");
  if (search) {
    return { title: `Results for “${search.slice(0, 60)}”`, robots: { index: false, follow: true } };
  }

  const pick = async <T extends { slug: string; name: string }>(path: string, slug: string) =>
    slug
      ? api<{ data: T[] }>(path, { revalidate: 300 })
          .then((r) => r.data.find((x) => x.slug === slug))
          .catch(() => undefined)
      : undefined;

  const category = await pick<Category>("/categories", get("category"));
  if (category) {
    return {
      title: `${category.name} Books${suffix}`,
      description: plainSnippet(category.description) || `Buy ${category.name} books online from Lalwani Books International.`,
      alternates: { canonical: onPage(`/collection?category=${encodeURIComponent(category.slug)}`) },
    };
  }
  const author = await pick<Author>("/authors", get("author"));
  if (author) {
    return {
      title: `Books by ${author.name}${suffix}`,
      description: `Buy books by ${author.name} online from Lalwani Books International.`,
      alternates: { canonical: onPage(`/collection?author=${encodeURIComponent(author.slug)}`) },
    };
  }
  const publisher = await pick<Publisher>("/publishers", get("publisher"));
  if (publisher) {
    return {
      title: `Books from ${publisher.name}${suffix}`,
      description: `Buy books published by ${publisher.name} online from Lalwani Books International.`,
      alternates: { canonical: onPage(`/collection?publisher=${encodeURIComponent(publisher.slug)}`) },
    };
  }

  return { title: `Shop Books${suffix}`, description: SHOP_DESCRIPTION, alternates: { canonical: onPage("/collection") } };
}

export const revalidate = 60;

interface Search {
  [key: string]: string | string[] | undefined;
}

function qs(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** The band title follows the active filter, so the page never looks generic. */
function heading(search: string | undefined, category: Category | undefined, author?: Author, publisher?: Publisher) {
  if (search) return `Results for “${search}”`;
  if (author) return `Books by ${author.name}`;
  if (publisher) return `Books from ${publisher.name}`;
  if (category) return category.name;
  return "Shop";
}

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const query = qs({
    search: get("search"),
    category: get("category"),
    author: get("author"),
    publisher: get("publisher"),
    sort: get("sort"),
    min_price: get("min_price"),
    max_price: get("max_price"),
    page: get("page"),
    per_page: "12",
  });

  let products: Paginated<ProductCardType> = {
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0 },
  };
  let categories: Category[] = [];
  let authors: Author[] = [];
  let publishers: Publisher[] = [];
  let allPrices: number[] = [];

  try {
    const [prod, cats, prices, auth, pubs] = await Promise.all([
      api<Paginated<ProductCardType>>(`/products${query}`, { revalidate: 60 }),
      api<{ data: Category[] }>("/categories", { revalidate: 300 }).then((r) => r.data),
      // Catalog-wide prices for stable slider bounds that don't shrink when a
      // price filter narrows the visible results.
      api<Paginated<ProductCardType>>("/products?per_page=100", { revalidate: 300 }).then((r) =>
        r.data.map((p) => p.price)
      ),
      // Only needed for an author's shelf, but one cached call is cheap.
      api<{ data: Author[] }>("/authors", { revalidate: 300 }).then((r) => r.data).catch(() => [] as Author[]),
      // Likewise only for a publisher's shelf.
      api<{ data: Publisher[] }>("/publishers", { revalidate: 300 }).then((r) => r.data).catch(() => [] as Publisher[]),
    ]);
    products = prod;
    categories = cats;
    allPrices = prices;
    authors = auth;
    publishers = pubs;
  } catch {
    /* API offline */
  }

  const activeCategory = categories.find((c) => c.slug === get("category"));
  // The Author and Publication filters list only names with books to show.
  const authorOptions = authors.filter((a) => a.products_count > 0).map((a) => ({ name: a.name, slug: a.slug }));
  const publisherOptions = publishers.filter((p) => p.products_count > 0).map((p) => ({ name: p.name, slug: p.slug }));
  const activeAuthor = authors.find((a) => a.slug === get("author"));
  const activePublisher = publishers.find((p) => p.slug === get("publisher"));
  const title = heading(get("search"), activeCategory, activeAuthor, activePublisher);

  // Stable price-slider bounds from the whole catalog (not the filtered page),
  // so narrowing the range never collapses the rail you can drag within.
  const rawLo = allPrices.length ? Math.min(...allPrices) : 0;
  const rawHi = allPrices.length ? Math.max(...allPrices) : 10000;
  const priceFloor = Math.max(0, Math.floor(rawLo / 10) * 10);
  const priceCeil = Math.max(priceFloor + 10, Math.ceil(rawHi / 10) * 10);

  return (
    <>
      <PageBanner
        title={title}
        crumbs={[
          { label: "Shop", href: "/collection" },
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
          ...(activeAuthor ? [{ label: activeAuthor.name }] : []),
          ...(activePublisher ? [{ label: activePublisher.name }] : []),
          ...(get("search") ? [{ label: "Search" }] : []),
        ]}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[270px_1fr]">
        <div className="hidden lg:block">
          {/* Scrolls on its own when it is taller than the window, so the bottom groups stay reachable — with no visible bar (wheel, touch and keys still scroll it). */}
          <div className="scrollbar-hidden sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[var(--radius-hero)]">
            <FilterSidebar
              categories={categories}
              authors={authorOptions}
              publishers={publisherOptions}
              priceFloor={priceFloor}
              priceCeil={priceCeil}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/* The author's shelf: photo, name and bio from admin → Categories & Authors. */}
          {activeAuthor && (
            <div className="flex flex-wrap items-center gap-5 rounded-[var(--radius-card)] bg-blush-100 px-6 py-5">
              <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[1.3rem] font-semibold text-rose-600 shadow-soft">
                {activeAuthor.photo ? (
                  <Image src={activeAuthor.photo} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  activeAuthor.name
                    .split(/[\s.]+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase())
                    .join("")
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-rose-600">Author</p>
                <p className="text-[1.25rem] font-semibold text-ink">{activeAuthor.name}</p>
                {activeAuthor.bio && <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-cocoa">{activeAuthor.bio}</p>}
              </div>
            </div>
          )}

          {/* The publisher's shelf: logo, name and description from admin → Publishers. */}
          {activePublisher && (
            <div className="flex flex-wrap items-center gap-5 rounded-[var(--radius-card)] bg-blush-100 px-6 py-5">
              <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-[1.3rem] font-semibold text-rose-600 shadow-soft">
                {activePublisher.logo ? (
                  <Image src={activePublisher.logo} alt="" fill sizes="80px" className="object-contain p-2" />
                ) : (
                  initialsOf(activePublisher.name)
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-rose-600">Publisher</p>
                <p className="text-[1.25rem] font-semibold text-ink">{activePublisher.name}</p>
                {activePublisher.description && (
                  <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-cocoa">{activePublisher.description}</p>
                )}
              </div>
            </div>
          )}

          {/* The category's own words from admin → Categories. */}
          {activeCategory && (activeCategory.tagline || activeCategory.description) && (
            <div className="rounded-[var(--radius-card)] bg-blush-100 px-6 py-5">
              <p className="text-[1.25rem] font-semibold text-ink">{activeCategory.name}</p>
              {activeCategory.tagline && (
                <p className="mt-0.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-rose-600">{activeCategory.tagline}</p>
              )}
              {activeCategory.description && (
                <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-cocoa">{activeCategory.description}</p>
              )}
            </div>
          )}

          <CollectionToolbar
            categories={categories}
            authors={authorOptions}
            publishers={publisherOptions}
            priceFloor={priceFloor}
            priceCeil={priceCeil}
          />

          {products.data.length === 0 ? (
            <div className="card px-8 py-20 text-center">
              <p className="text-xl font-semibold text-ink">No books found</p>
              <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-fog">
                Nothing matches this combination of filters. Try loosening one, or search by author or ISBN.
              </p>
              <Link
                href="/collection"
                className="mt-6 inline-flex items-center rounded-full bg-rose-600 px-6 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700"
              >
                View all books
              </Link>
            </div>
          ) : (
            <div data-reveal-stagger className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 xl:grid-cols-4">
              {products.data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <Pagination meta={products.meta} />
        </div>
      </div>
    </>
  );
}
