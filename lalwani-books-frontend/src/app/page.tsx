import type { Metadata } from "next";
import { api } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import type { Author, Category, Deal, Paginated, ProductCard } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { PopupGate } from "@/components/PopupGate";
import { HeroCarousel, type HeroBanner, type Testimonial } from "@/components/home/bookory-client";
import {
  AuthorsAndReading,
  DealsOfTheWeek,
  GENRE_TINTS,
  GenreTiles,
  GridSection,
  LatestPosts,
  RailSection,
  TestimonialBand,
  TrendSection,
} from "@/components/home/bookory";
import {
  AboutHome,
  BookSpotlight,
  CategoryRails,
  CollectionCircles,
  PromoBand,
} from "@/components/home/connected";
import { getSettings } from "@/lib/settings";
import { SITE_URL, absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 120;

const R = { revalidate: 120 } as const;

function list(path: string) {
  return api<Paginated<ProductCard>>(path, R).catch(
    () => ({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } }) as Paginated<ProductCard>
  );
}

/** Use the flagged picks when there are any, otherwise fall back to a sort. */
function orFallback(picked: ProductCard[], fallback: ProductCard[]) {
  return picked.length > 0 ? picked : fallback;
}

/**
 * Home page, laid out after Bookory's first home: hero, bestsellers, weekly
 * deals, trending, testimonials, popular books, genres, authors and stats.
 * Every section is fed from the API and hides itself when it has nothing.
 */
/** The home page's canonical address: admin → SEO's "canonical URL", else the site root. */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const canonical = String(settings.seo_canonical ?? "").trim();
  return { alternates: { canonical: canonical || "/" } };
}

/**
 * Who the shop is (name, logo, contact, social profiles) and how to search it,
 * so a search engine can show the store's details and a search box for it.
 */
function storeJsonLd(name: string, settings: Awaited<ReturnType<typeof getSettings>>) {
  const value = (key: string) => String(settings[key] ?? "").trim();
  const sameAs = ["social_facebook", "social_instagram", "social_youtube", "social_x", "social_telegram"]
    .map(value)
    .filter((u) => /^https?:\/\//i.test(u));

  return [
    {
      "@context": "https://schema.org",
      "@type": "BookStore",
      name,
      url: SITE_URL,
      logo: absoluteUrl("/images/brand/logo.png"),
      image: absoluteUrl("/images/brand/logo.png"),
      ...(value("site_tagline") ? { description: value("site_tagline") } : {}),
      ...(value("support_phone") ? { telephone: value("support_phone") } : {}),
      ...(value("support_email") ? { email: value("support_email") } : {}),
      ...(value("contact_address") ? { address: value("contact_address") } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name,
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/collection?search={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export default async function HomePage() {
  const [all, bestsellers, newest, featured, banners, categories, testimonials, posts, settings, authorList, dealOffers] = await Promise.all([
    list("/products?per_page=48"),
    list("/products?bestsellers=1&per_page=12"),
    // Newest first: the grid shows 6 or 12 of these, and in the default
    // (bestseller, rating) order a book just added — no ratings yet — sorted
    // last and never appeared, however recently it was ticked "New Arrival".
    list("/products?new_arrival=1&sort=newest&per_page=12"),
    list("/products?featured=1&per_page=8"),
    api<{ data: HeroBanner[] }>("/banners", R).then((r) => r.data).catch(() => [] as HeroBanner[]),
    api<{ data: Category[] }>("/categories", R).then((r) => r.data).catch(() => [] as Category[]),
    api<{ data: Testimonial[] }>("/testimonials", R).then((r) => r.data).catch(() => [] as Testimonial[]),
    api<{ data: Parameters<typeof LatestPosts>[0]["posts"] }>("/blogs", R).then((r) => r.data).catch(() => []),
    getSettings(),
    api<{ data: Author[] }>("/authors", R).then((r) => r.data).catch(() => [] as Author[]),
    api<{ data: Deal[] }>("/deals", R).then((r) => r.data).catch(() => [] as Deal[]),
  ]);

  const books = all.data;
  const byRating = [...books].sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count);
  // Ids climb as books are added, so this is the catalogue newest first.
  const byNewest = [...books].sort((a, b) => b.id - a.id);

  // Biggest discount first — these are the week's deals.
  const deals = books
    .filter((b) => b.compare_at_price && b.compare_at_price > b.price)
    .sort((a, b) => b.compare_at_price! / b.price - a.compare_at_price! / a.price);

  // Authors (admin → Categories & Authors) ranked by how many of their books
  // are live, with their photo when one is set. Should the author records be
  // unavailable, the names printed on the books stand in.
  const authors: { name: string; count: number; photo: string | null; slug?: string }[] = authorList
    .filter((a) => a.products_count > 0)
    .sort((a, b) => b.products_count - a.products_count || a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    // Every author with books — the panel's list scrolls, and links on to /authors.
    .map((a) => ({ name: a.name, count: a.products_count, photo: a.photo, slug: a.slug }));
  const authorCounts = new Map<string, number>();
  for (const b of books) if (b.author) authorCounts.set(b.author, (authorCounts.get(b.author) ?? 0) + 1);
  if (authors.length === 0) {
    authors.push(
      ...[...authorCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count, photo: null, slug: undefined }))
    );
  }

  const heroBooks = orFallback(featured.data, bestsellers.data.length ? bestsellers.data : books);
  const trend = orFallback(featured.data, byRating.slice(0, 6));

  // admin → Home Page: a switch and a heading per section.
  const on = (section: string) => String(settings[`home_${section}_enabled`] ?? "1") !== "0";
  const text = (key: string, fallback: string) => {
    const v = String(settings[key] ?? "").trim();
    return v || fallback;
  };

  const storeName = settings.site_name || "Lalwani Books International";

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-clip">
      <JsonLd data={storeJsonLd(storeName, settings)} />
      <AnnouncementBar />
      <PopupGate />
      <SiteHeader />

      <main className="flex-1 pb-20">
        {/* The page's one main heading, for search engines and screen readers:
            the banners carry the visible headings, one per slide. */}
        <h1 className="sr-only">{text("seo_home_title", `${storeName} — Online Book Store`)}</h1>
        <HeroCarousel banners={banners} books={heroBooks} />
        {/* Every author with books (switch in Home Page) — their photo, or
            their initials until one is added. */}
        <CollectionCircles
          rows={[
            ...(on("author_circles")
              ? authorList
                  .filter((a) => a.products_count > 0)
                  .map((a, i) => ({
                    id: `author-${a.id}`,
                    image: a.photo,
                    initials: initialsOf(a.name),
                    tint: GENRE_TINTS[i % GENRE_TINTS.length],
                    title: a.name,
                    link_url: `/collection?author=${a.slug}`,
                  }))
              : []),
          ]}
        />

        {on("bestsellers") && (
          <RailSection
            title={text("home_bestsellers_title", "Bestselling Books")}
            href="/collection"
            products={orFallback(bestsellers.data, byRating.slice(0, 12))}
          />
        )}
        {on("deals") && (
          <DealsOfTheWeek
            deals={deals}
            offers={dealOffers}
            title={text("home_deals_title", "Deals Of The Week")}
          />
        )}
        <PromoBand settings={settings} />
        {on("trend") && <TrendSection products={trend} title={text("home_trend_title", "What's In Trend")} />}
        <BookSpotlight settings={settings} />
        {on("new") && (
          <GridSection
            title={text("home_new_title", "New Arrivals")}
            href="/collection?sort=newest"
            products={orFallback(newest.data, byNewest).slice(0, 12)}
          />
        )}
        {on("genres") && <GenreTiles categories={categories} title={text("home_genres_title", "Browse By Genre")} />}
        {on("rails") && <CategoryRails />}
        {(on("authors") || on("reading")) && (
          <AuthorsAndReading
            authors={on("authors") ? authors : []}
            reading={on("reading") ? byRating.slice(0, 5) : []}
            authorsTitle={text("home_authors_title", "Popular Authors")}
            readingTitle={text("home_reading_title", "Keep Reading")}
          />
        )}
        <AboutHome settings={settings} books={byRating.slice(5)} />
        {on("blog") && <LatestPosts posts={posts} title={text("home_blog_title", "From The Blog")} />}
        {/* Readers' words close the page, right above the footer. */}
        {on("testimonials") && <TestimonialBand items={testimonials} title={text("home_testimonials_title", "What readers say")} />}
      </main>

      <Footer />
    </div>
  );
}
