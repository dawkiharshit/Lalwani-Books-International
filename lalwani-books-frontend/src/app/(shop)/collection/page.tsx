import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { Author, Category, Paginated, ProductCard as ProductCardType, Publisher } from "@/lib/types";
import { initialsOf } from "@/lib/format";
import Image from "@/components/Image";
import { ProductCard } from "@/components/ProductCard";
import { PageBanner } from "@/components/PageBanner";
import { Pagination } from "./filters";
import { FilterSidebar } from "./filter-sidebar";
import { CollectionToolbar } from "./toolbar";
import { SearchNote } from "./search-note";
import { plainSnippet } from "@/lib/seo";
import { pageMetadata } from "@/lib/page-meta";
import { audienceBySlug, type InstitutionAudience } from "@/components/home/institutions";
import { ChevronIcon } from "@/components/icons";
import { shelfBySlug, type Shelf } from "@/lib/shelves";
import { SHELF_LOOKS } from "@/components/home/shelves";

const SHOP_DESCRIPTION =
  "Browse fiction, Indian literature, children’s, academic, competitive-exam, business, self-help and science books.";

/**
 * A title, description and canonical address for each kind of listing, so a
 * category, author or publisher page can rank for its own name. Sorting and
 * price filters only reorder the same books, so the canonical leaves them out.
 * Search results are thin and endless: they stay out of the index, links on
 * them are still followed. The lists come from the same cached requests the
 * page makes. Each listing also gets its own share preview, and page 2 on
 * says which page it is, so no two pages share a title and description.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const page = Math.max(1, Math.floor(Number(get("page")) || 1));
  const onPage = (canonical: string) => (page > 1 ? `${canonical}${canonical.includes("?") ? "&" : "?"}page=${page}` : canonical);
  const suffix = page > 1 ? ` — Page ${page}` : "";
  // A short description gets one more sentence, so the snippet under the
  // title in search results says enough to be worth a click.
  const sentence = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`);
  const fuller = (d: string) => (d.length >= 100 ? d : plainSnippet(`${sentence(d)} Genuine editions, delivered across India.`));
  const listing = (title: string, description: string, canonical: string) =>
    pageMetadata({
      title: `${title}${suffix}`,
      description: page > 1 ? `${sentence(fuller(description))} Page ${page}.` : fuller(description),
      path: onPage(canonical),
    });

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
    // A one-line category note (admin → Categories) is topped up with what
    // the page offers, so the description says enough to be worth a click.
    const note = plainSnippet(category.description);
    const offer = `Buy ${category.name} books online from Lalwani Books International, delivered across India.`;
    const description = note.length >= 70 ? note : note ? plainSnippet(`${sentence(note)} ${offer}`) : offer;
    return listing(`${category.name} Books`, description, `/collection?category=${encodeURIComponent(category.slug)}`);
  }
  const author = await pick<Author>("/authors", get("author"));
  if (author) {
    // The author's bio (admin → Categories & Authors), when there is one, makes each page's description its own.
    return listing(
      `Books by ${author.name}`,
      plainSnippet(`Buy books by ${author.name} online from Lalwani Books International. ${plainSnippet(author.bio, 400)}`),
      `/collection?author=${encodeURIComponent(author.slug)}`
    );
  }
  const publisher = await pick<Publisher>("/publishers", get("publisher"));
  if (publisher) {
    return listing(
      `Books from ${publisher.name}`,
      plainSnippet(`Buy books published by ${publisher.name} online from Lalwani Books International. ${plainSnippet(publisher.description, 400)}`),
      `/collection?publisher=${encodeURIComponent(publisher.slug)}`
    );
  }
  const audience = audienceBySlug(get("for"));
  if (audience) {
    return listing(
      `Books for ${audience.label}`,
      `${audience.note} — books for ${audience.label.toLowerCase()} from Lalwani Books International, in any quantity.`,
      `/collection?for=${audience.slug}`
    );
  }
  const shelf = shelfBySlug(get("shelf"));
  if (shelf) {
    return listing(shelf.label, shelf.description, `/collection?shelf=${shelf.slug}`);
  }

  return listing("Shop Books", SHOP_DESCRIPTION, "/collection");
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
function heading(
  search: string | undefined,
  category: Category | undefined,
  author?: Author,
  publisher?: Publisher,
  audience?: InstitutionAudience,
  shelf?: Shelf
) {
  if (search) return `Results for “${search}”`;
  if (author) return `Books by ${author.name}`;
  if (publisher) return `Books from ${publisher.name}`;
  // A list of ticked books (Bestsellers…) narrowed to one category keeps its name.
  if (category) return shelf && !shelf.params.category ? `${shelf.label}: ${category.name}` : category.name;
  if (audience) return `Books for ${audience.label}`;
  if (shelf) return shelf.label;
  return "Shop";
}

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  /*
   * "Books for Schools / Universities / Libraries / Corporates" (the tiles on
   * the home page and /institutions): a few categories at once, asked for in
   * one request. A category picked in the filters takes over; categories the
   * shop no longer has are skipped, and if none are left, every book shows.
   */
  const audience = audienceBySlug(get("for"));
  let audienceCategories: string | undefined;
  if (audience && !get("category") && audience.categories.length) {
    const known = await api<{ data: Category[] }>("/categories", { revalidate: 300 })
      .then((r) => r.data)
      .catch(() => [] as Category[]);
    const slugs = audience.categories.filter((s) => known.some((c) => c.slug === s));
    if (slugs.length) audienceCategories = slugs.join(",");
  }

  /*
   * A Browse By Genre list (/collection?shelf=…): New Arrivals, Bestsellers,
   * The Lalwani Edit and Gift Ideas are books ticked in admin → Products, and
   * the filters narrow them further; while none are ticked, the list's
   * stand-in shows instead. Non-Fiction gathers several categories, and a
   * category picked in the filters takes over from those.
   */
  const shelf = shelfBySlug(get("shelf"));
  let shelfParams = shelf?.params ?? {};
  if (shelf?.fallback) {
    const ticked = await api<Paginated<ProductCardType>>(`/products${qs({ ...shelf.params, per_page: "1" })}`, { revalidate: 60 })
      .then((r) => r.meta.total)
      .catch(() => 1);
    if (ticked === 0) shelfParams = shelf.fallback;
  }

  const query = qs({
    ...shelfParams,
    search: get("search"),
    category: get("category") ?? audienceCategories ?? shelfParams.category,
    author: get("author"),
    publisher: get("publisher"),
    sort: get("sort") ?? shelfParams.sort,
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

  // A whole ISBN typed in the search bar (10 or 13 digits, dashes or spaces
  // allowed) that names exactly one book opens that book straight away.
  const typed = (get("search") ?? "").trim();
  if (/^[\d\s-]+[Xx]?$/.test(typed) && /^(\d{9}[\dXx]|\d{13})$/.test(typed.replace(/[\s-]/g, "")) && products.meta.total === 1) {
    redirect(`/product/${products.data[0].slug}`);
  }

  const activeCategory = categories.find((c) => c.slug === get("category"));
  // The Author and Publication filters list only names with books to show.
  const authorOptions = authors.filter((a) => a.products_count > 0).map((a) => ({ name: a.name, slug: a.slug }));
  const publisherOptions = publishers.filter((p) => p.products_count > 0).map((p) => ({ name: p.name, slug: p.slug }));
  const activeAuthor = authors.find((a) => a.slug === get("author"));
  const activePublisher = publishers.find((p) => p.slug === get("publisher"));
  const title = heading(get("search"), activeCategory, activeAuthor, activePublisher, audience, shelf);
  // The audience banner shows only while that shelf is what is on screen.
  const audienceShelf = audience && !activeCategory && !activeAuthor && !activePublisher && !get("search") ? audience : undefined;
  // Likewise a Browse By Genre list's card.
  const listShelf = shelf && !audience && !activeCategory && !activeAuthor && !activePublisher && !get("search") ? shelf : undefined;
  const ListIcon = listShelf ? SHELF_LOOKS[listShelf.slug]?.Icon : undefined;

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
          ...(shelf && !audience ? [{ label: shelf.label, href: listShelf ? undefined : `/collection?shelf=${shelf.slug}` }] : []),
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
          ...(activeAuthor ? [{ label: activeAuthor.name }] : []),
          ...(activePublisher ? [{ label: activePublisher.name }] : []),
          ...(audienceShelf ? [{ label: `For ${audienceShelf.label}` }] : []),
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
              defaultSort={shelfParams.sort ?? "featured"}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/* The author's shelf: photo, name and bio from admin → Categories & Authors. */}
          {activeAuthor && (
            <div className="flex flex-wrap items-center gap-5 rounded-[var(--radius-card)] bg-blush-100 px-6 py-5">
              <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[1.3rem] font-semibold text-rose-600 shadow-soft">
                {activeAuthor.photo ? (
                  <Image src={activeAuthor.photo} alt="" fill fixed sizes="80px" className="object-cover" fallback={initialsOf(activeAuthor.name)} />
                ) : (
                  initialsOf(activeAuthor.name)
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-rose-600">Author</p>
                <p className="text-[1.25rem] font-semibold text-ink">{activeAuthor.name}</p>
                {activeAuthor.bio && <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-cocoa">{activeAuthor.bio}</p>}
              </div>
            </div>
          )}

          {/* An institutions shelf (Schools, Universities…): who it is for, and the way to a bulk quote. */}
          {audienceShelf && (
            <div className="flex flex-wrap items-center gap-5 rounded-[var(--radius-card)] bg-pine-900 px-6 py-5 text-white">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-mustard/15 text-mustard">
                <audienceShelf.Icon className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-mustard">Books for Institutions</p>
                <p className="text-[1.25rem] font-semibold">Books for {audienceShelf.label}</p>
                <p className="mt-0.5 text-[13px] text-parchment/75">
                  {audienceShelf.note}.{" "}
                  <Link href="/collection" className="font-semibold text-parchment underline underline-offset-2 hover:text-white">
                    See all books
                  </Link>
                </p>
              </div>
              <Link
                href="/institutions#quote"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mustard px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-rose-800 transition-colors hover:bg-[#f0c36b]"
              >
                Request a bulk quote
                <ChevronIcon className="h-3 w-3 -rotate-90" strokeWidth={2.4} />
              </Link>
            </div>
          )}

          {/* A Browse By Genre list (New Arrivals, Gift Ideas…): what it holds. */}
          {listShelf && (
            <div className="flex flex-wrap items-center gap-5 rounded-[var(--radius-card)] bg-blush-100 px-6 py-5">
              {ListIcon && (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 shadow-soft">
                  <ListIcon className="h-7 w-7" strokeWidth={1.7} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-rose-600">{listShelf.note}</p>
                <p className="text-[1.25rem] font-semibold text-ink">{listShelf.label}</p>
                <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-cocoa">{listShelf.description}</p>
              </div>
            </div>
          )}

          {/* The publisher's shelf: logo, name and description from admin → Publishers. */}
          {activePublisher && (
            <div className="flex flex-wrap items-center gap-5 rounded-[var(--radius-card)] bg-blush-100 px-6 py-5">
              <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white text-[1.3rem] font-semibold text-rose-600 shadow-soft">
                {activePublisher.logo ? (
                  <Image src={activePublisher.logo} alt="" fill fixed sizes="80px" className="object-contain p-2" />
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
            defaultSort={shelfParams.sort ?? "featured"}
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
            // No fade-in here: the first books are the page's main content, and
            // waiting for the scripts to reveal them made phones show them late.
            // For the same reason the first row's covers load at once.
            <div data-search-results={get("search") ? "" : undefined} className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 xl:grid-cols-4">
              {products.data.map((product, i) => (
                <ProductCard key={product.id} product={product} eager={i < 4} />
              ))}
            </div>
          )}

          <Pagination meta={products.meta} />
          {/* What was searched, for admin → Search insights. */}
          {typed && <SearchNote q={typed} />}
        </div>
      </div>
    </>
  );
}
