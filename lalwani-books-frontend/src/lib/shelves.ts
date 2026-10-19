/**
 * The home page's "Browse By Genre" section, in two groups:
 *
 *   Books     All Books, then eight genres, each one of the shop's categories.
 *   Discover  New Arrivals, Bestsellers, The Lalwani Edit, Gift Ideas — lists
 *             of books from any category, ticked in admin → Products.
 *
 * A shelf is a list that is not one category; it opens at /collection?shelf=…
 */

export interface Shelf {
  slug: string;
  label: string;
  /** One line under the name, on the home tile and the shelf's page. */
  note: string;
  /** The shelf's page, and its description for search engines. */
  description: string;
  /** What the products API is asked for. */
  params: Record<string, string>;
  /** Asked for instead while no book is ticked for this shelf. */
  fallback?: Record<string, string>;
}

/** Real-world reading: Non-Fiction until the shop has a category of that name. */
const NON_FICTION_CATEGORIES = ["academic", "competitive-exams", "business", "self-help", "science"];

export const SHELVES: Shelf[] = [
  {
    slug: "new-arrivals",
    label: "New Arrivals",
    note: "Fresh on our shelves",
    description: "The newest books at Lalwani Books International, latest first.",
    params: { new_arrival: "1", sort: "newest" },
    fallback: { sort: "newest" },
  },
  {
    slug: "bestsellers",
    label: "Bestsellers",
    note: "What readers buy most",
    description: "The books our readers buy most, from fiction to exam guides.",
    params: { bestsellers: "1" },
    fallback: {},
  },
  {
    slug: "lalwani-edit",
    label: "The Lalwani Edit",
    note: "Hand-picked by our team",
    description: "Our team’s pick of the books worth reading right now.",
    params: { featured: "1" },
    fallback: { sort: "rating" },
  },
  {
    // With none ticked, the API offers hardcovers and bestsellers itself.
    slug: "gift-ideas",
    label: "Gift Ideas",
    note: "Books made to be given",
    description: "Books that make a thoughtful gift, for birthdays, festivals and every reader you know.",
    params: { gift: "1" },
  },
  {
    slug: "non-fiction",
    label: "Non-Fiction",
    note: "Real-world reading",
    description: "Non-fiction books: academic, exam preparation, business, self-help and science.",
    params: { category: NON_FICTION_CATEGORIES.join(",") },
  },
];

/** The Discover group on the home page, in this order. */
export const DISCOVER_SHELVES = ["new-arrivals", "bestsellers", "lalwani-edit", "gift-ideas"]
  .map((slug) => SHELVES.find((s) => s.slug === slug))
  .filter((s): s is Shelf => Boolean(s));

export function shelfBySlug(slug: string | undefined | null) {
  return slug ? SHELVES.find((s) => s.slug === slug) : undefined;
}

/**
 * The Books group's genres, in this order. Each is the category whose name or
 * address matches; Non-Fiction stands in as a shelf until the shop has one.
 */
export const BOOK_GENRES: { label: string; slugs: string[]; shelf?: string }[] = [
  { label: "Fiction", slugs: ["fiction"] },
  { label: "Non-Fiction", slugs: ["non-fiction", "nonfiction"], shelf: "non-fiction" },
  { label: "Academic", slugs: ["academic", "academic-education"] },
  { label: "Children", slugs: ["children", "childrens-books", "children-books"] },
  { label: "Art & Design", slugs: ["art-design", "art-and-design", "arts-design"] },
  { label: "Business", slugs: ["business", "business-economics"] },
  { label: "Competitive Exams", slugs: ["competitive-exams"] },
  { label: "Indian Literature", slugs: ["indian-literature"] },
];

/** "Art & Design", "art-and-design" and "Art and Design" all compare equal. */
const plain = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

export function categoryForGenre<C extends { slug: string; name: string }>(
  genre: (typeof BOOK_GENRES)[number],
  categories: C[]
) {
  const keys = new Set([genre.label, ...genre.slugs].map(plain));
  return categories.find((c) => keys.has(plain(c.slug)) || keys.has(plain(c.name)));
}
