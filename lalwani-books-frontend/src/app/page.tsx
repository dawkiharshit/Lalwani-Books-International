import type { Metadata } from "next";
import { api } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import type { Author, Category, Deal, Paginated, ProductCard } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { VoiceQueryButton } from "@/components/voice/VoiceQueryButton";
import { RecentlyViewed } from "@/components/home/RecentlyViewed";
import { PopupGate } from "@/components/PopupGate";
import { HeroCarousel, type HeroBanner, type Testimonial } from "@/components/home/bookory-client";
import {
  AuthorsAndReading,
  DealsOfTheWeek,
  GENRE_TINTS,
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
import { siteShare } from "@/lib/page-meta";
import { SITE_URL, absoluteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { INSTITUTION_AUDIENCES, InstitutionsBand } from "@/components/home/institutions";
import { BrowseShelves, type ShelfSummary } from "@/components/home/shelves";

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
 * Home page, laid out after Bookory's first home: hero, bestsellers, trending,
 * new arrivals, genres, authors, the weekly deals right above the About block,
 * and testimonials. Every section is fed from the API and hides itself when it
 * has nothing.
 */
/**
 * What tells two cover pictures apart. The same picture is often uploaded for
 * several books (each copy gets its own file name), so this shop's own uploads
 * are told apart by file size; any other address is judged by URL alone. Sizes
 * are remembered by address (an upload always gets a new file name) and the
 * checks are cached for an hour, so they only run when the page is rebuilt.
 */
const coverKeys = new Map<string, Promise<string>>();
function coverKey(image: string) {
  const known = coverKeys.get(image);
  if (known) return known;
  if (coverKeys.size > 1000) coverKeys.clear();
  const origin = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1").replace(/\/api\/v1\/?$/, "");
  const url = /^https?:\/\//i.test(image) ? image : `${origin}${image}`;
  const key = url.startsWith(`${origin}/storage/`)
    ? fetch(url, { method: "HEAD", next: { revalidate: 3600 } })
        .then((r) => {
          const size = r.headers.get("content-length");
          return size ? `size:${size}` : `url:${image}`;
        })
        .catch(() => {
          coverKeys.delete(image); // try again next time
          return `url:${image}`;
        })
    : Promise.resolve(`url:${image}`);
  coverKeys.set(image, key);
  return key;
}

/**
 * Up to three covers that look different, for a fan of covers. `shown` holds
 * the pictures other fans on the page already use: those are taken only when
 * nothing else is left.
 */
async function distinctCovers(candidates: ProductCard[], want = 3, shown = new Set<string>()) {
  const picked: { image: string; name: string }[] = [];
  const mine = new Set<string>();
  for (const fresh of [true, false]) {
    for (const b of candidates) {
      if (picked.length === want) break;
      if (!b.image) continue;
      const key = await coverKey(b.image);
      if (mine.has(key) || (fresh && shown.has(key))) continue;
      mine.add(key);
      picked.push({ image: b.image, name: b.name });
    }
  }
  mine.forEach((key) => shown.add(key));
  return picked;
}

/**
 * The home page's canonical address — admin → SEO's "canonical URL", else the
 * site root — and the same address in its share preview (og:url).
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const canonical = String(settings.seo_canonical ?? "").trim() || "/";
  const share = siteShare(settings);
  return {
    alternates: { canonical },
    openGraph: {
      title: share.title,
      description: share.description,
      url: canonical,
      type: "website",
      siteName: share.name,
      locale: "en_IN",
      images: share.images,
    },
  };
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
  const [all, bestsellers, newest, featured, banners, categories, testimonials, posts, settings, authorList, dealOffers, giftIdeas] = await Promise.all([
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
    // Browse By Genre → Discover → Gift Ideas.
    list("/products?gift=1&per_page=8"),
  ]);

  const books = all.data;
  const byRating = [...books].sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count);
  // Ids climb as books are added, so this is the catalogue newest first.
  const byNewest = [...books].sort((a, b) => b.id - a.id);

  // Books for Institutions band: how many books each audience's shelf holds,
  // and a fan of study covers (other books if there are too few of those).
  const shelfCount = (slugs: string[]) =>
    slugs.length ? categories.filter((c) => slugs.includes(c.slug)).reduce((n, c) => n + c.products_count, 0) : all.meta.total;
  const institutionCounts = Object.fromEntries(INSTITUTION_AUDIENCES.map((a) => [a.slug, shelfCount(a.categories)]));
  const studySlugs = ["academic", "science", "children", "competitive-exams"];
  const withCovers = books.filter((b) => b.image);
  const institutionCovers = await distinctCovers([
    ...withCovers.filter((b) => studySlugs.includes(b.category?.slug ?? "")),
    ...withCovers.filter((b) => !studySlugs.includes(b.category?.slug ?? "")),
  ]);

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

  // Browse By Genre: the All Books tile, with a pile of the shop's books (one
  // per subject first, for a varied pile), and the four Discover lists, each
  // with how many books it holds and covers that differ from card to card. A
  // list with nothing ticked shows what its page falls back to: the whole shop.
  const subjects = new Set<string>();
  const onePerSubject = books.filter((b) => {
    const key = b.category?.slug ?? `#${b.id}`;
    if (subjects.has(key)) return false;
    subjects.add(key);
    return true;
  });
  const allBooks = {
    count: all.meta.total,
    spines: [...onePerSubject, ...books.filter((b) => !onePerSubject.includes(b))]
      .slice(0, 7)
      .map((b) => ({ name: b.name })),
  };
  const discover: Record<string, ShelfSummary> = {};
  if (on("genres")) {
    const shown = new Set<string>();
    const summary = async (picked: Paginated<ProductCard>, fallback: ProductCard[]): Promise<ShelfSummary> => {
      const ticked = picked.meta.total > 0;
      return {
        count: ticked ? picked.meta.total : fallback.length ? all.meta.total : 0,
        covers: await distinctCovers(ticked ? picked.data : fallback, 3, shown),
      };
    };
    discover["new-arrivals"] = await summary(newest, byNewest);
    discover.bestsellers = await summary(bestsellers, byRating);
    discover["lalwani-edit"] = await summary(featured, byRating);
    // The API itself offers hardcovers and bestsellers while no gift idea is ticked.
    discover["gift-ideas"] = await summary(giftIdeas, []);
  }

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
        {/* The books this visitor opened, from their browser — hidden until there are some. */}
        {on("recent") && <RecentlyViewed title={text("home_recent_title", "Recently Viewed")} />}
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
        {/* Books (All Books + the genres) and Discover (New Arrivals, Bestsellers,
            The Lalwani Edit, Gift Ideas). */}
        {on("genres") && (
          <BrowseShelves
            title={text("home_genres_title", "Browse By Genre")}
            categories={categories}
            allBooks={allBooks}
            discover={discover}
          />
        )}
        {on("rails") && <CategoryRails />}
        {(on("authors") || on("reading")) && (
          <AuthorsAndReading
            authors={on("authors") ? authors : []}
            reading={on("reading") ? byRating.slice(0, 5) : []}
            authorsTitle={text("home_authors_title", "Popular Authors")}
            readingTitle={text("home_reading_title", "Keep Reading")}
          />
        )}
        {on("deals") && (
          <DealsOfTheWeek
            deals={deals}
            offers={dealOffers}
            title={text("home_deals_title", "Deals Of The Week")}
          />
        )}
        <AboutHome settings={settings} books={byRating.slice(5)} />
        {/* Bulk buyers: schools, universities, libraries, companies → /institutions. */}
        <InstitutionsBand covers={institutionCovers} counts={institutionCounts} phone={String(settings.support_phone ?? "")} />
        {on("blog") && <LatestPosts posts={posts} title={text("home_blog_title", "From The Blog")} />}
        {/* Readers' words close the page, right above the footer. */}
        {on("testimonials") && <TestimonialBand items={testimonials} title={text("home_testimonials_title", "What readers say")} />}
      </main>

      <Footer />
      <WhatsAppButton />
      <VoiceQueryButton />
    </div>
  );
}
