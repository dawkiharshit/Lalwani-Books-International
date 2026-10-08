import Link from "next/link";
import Image from "@/components/Image";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { StoreSettings } from "@/lib/settings";
import type { ProductCard as ProductCardType, ProductDetail } from "@/lib/types";
import { AddToCartPanel } from "../AddToCart";
import { ProductImage } from "../ProductImage";
import { ChevronIcon } from "../icons";
import { Stars } from "../ui";
import { RailSection } from "./bookory";
import { CirclesSlider } from "./circles-slider";

/*
 * Home sections driven by admin pages that have no product flag of their own:
 * Collection Circles, Promo Band, Product Spotlight, Stats Counter, About
 * Page (home block) and the per-category rails. Each one renders
 * nothing while it is switched off or empty in the admin.
 */

export interface ContentRow {
  /** A number from the content tables; a string for rows built on the page (authors). */
  id: number | string;
  image: string | null;
  /** Drawn in place of a photo — an author without one shows their initials. */
  initials?: string | null;
  /** Gradient stops (from, to) behind the initials. */
  tint?: string[];
  title?: string | null;
  caption?: string | null;
  link_url?: string | null;
  post_url?: string | null;
}

const str = (s: StoreSettings, key: string) => String(s[key] ?? "").trim();

/**
 * Round author shortcuts under the hero (admin → Categories & Authors).
 * Drawn by CirclesSlider, which glides a long row.
 */
export function CollectionCircles({ rows }: { rows: ContentRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="container-shop pt-12">
      <CirclesSlider rows={rows} />
    </section>
  );
}

/** Wide call-to-action band — admin → Promo Band. */
export function PromoBand({ settings: s }: { settings: StoreSettings }) {
  if (str(s, "cta_banner_enabled") !== "1" || !str(s, "cta_banner_heading")) return null;
  return (
    <section className="container-shop pt-16 lg:pt-20">
      <div
        data-reveal
        className="relative overflow-hidden rounded-[var(--radius-hero)] bg-maroon-800 px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-10"
      >
        <span aria-hidden className="blob-drift absolute -right-20 -top-24 h-72 w-72 rounded-full bg-rose-600/40 blur-2xl" />
        <span aria-hidden className="blob-drift absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[#ffd44d]/20 blur-2xl [animation-delay:-6s]" />
        <div className="relative max-w-2xl">
          {str(s, "cta_banner_eyebrow") && (
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-rose-400">{str(s, "cta_banner_eyebrow")}</p>
          )}
          <h2 className="mt-3 text-[1.8rem] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[2.4rem]">
            {str(s, "cta_banner_heading")}
          </h2>
          {str(s, "cta_banner_description") && (
            <p className="mt-3 text-[14px] leading-relaxed text-white/75">{str(s, "cta_banner_description")}</p>
          )}
        </div>
        {str(s, "cta_banner_button_text") && (
          <Link
            href={str(s, "cta_banner_button_url") || "/collection"}
            className="relative mt-7 inline-flex shrink-0 items-center gap-2 rounded-full bg-rose-600 px-7 py-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 lg:mt-0"
          >
            {str(s, "cta_banner_button_text")}
            <ChevronIcon className="h-3.5 w-3.5 -rotate-90" strokeWidth={2.2} />
          </Link>
        )}
      </div>
    </section>
  );
}

/** One book given the full treatment — admin → Product Spotlight. */
export async function BookSpotlight({ settings: s }: { settings: StoreSettings }) {
  if (str(s, "spotlight_enabled") !== "1") return null;
  const slug = str(s, "spotlight_product_slug");
  if (!slug) return null;
  const book = await api<{ data: ProductDetail }>(`/products/${encodeURIComponent(slug)}`, { revalidate: 120 })
    .then((r) => r.data)
    .catch(() => null);
  if (!book) return null;

  const off = book.compare_at_price ? Math.round((1 - book.price / book.compare_at_price) * 100) : 0;

  return (
    <section className="container-shop pt-16 lg:pt-20">
      <div data-reveal className="grid items-center gap-10 overflow-hidden rounded-[var(--radius-hero)] bg-blush-100 p-7 sm:p-12 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Link href={`/product/${book.slug}`} className="group relative mx-auto block w-full max-w-[300px]">
          <span className="float-y relative block overflow-hidden rounded-xl shadow-[0_30px_60px_-28px_rgba(0,0,0,0.5)]">
            <span className="block pb-[140%]" />
            <ProductImage product={book} sizes="300px" className="transition-transform duration-500 group-hover:scale-105" />
          </span>
        </Link>
        <div>
          {str(s, "spotlight_eyebrow") && (
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-rose-600">{str(s, "spotlight_eyebrow")}</p>
          )}
          <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            {str(s, "spotlight_heading") || book.name}
          </h2>
          {book.author && <p className="mt-2 text-[14px] text-fog">by <span className="font-medium text-ink">{book.author}</span></p>}
          <div className="mt-3 flex items-center gap-2">
            <Stars rating={book.rating_avg} className="h-3.5 w-3.5" />
            <span className="text-[12px] text-ink">{book.rating_count}</span>
          </div>
          <p className="mt-4 line-clamp-4 text-[14.5px] leading-relaxed text-cocoa">{str(s, "spotlight_note") || book.description}</p>
          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-[1.7rem] font-semibold text-rose-600">{money(book.price)}</span>
            {book.compare_at_price && <span className="text-[15px] text-fog line-through">{money(book.compare_at_price)}</span>}
            {off > 0 && <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[11.5px] font-semibold text-white">Save {off}%</span>}
          </div>
          <div className="mt-6 max-w-md">
            <AddToCartPanel productId={book.id} stock={book.stock} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Who we are" block — admin → About Page (home section). */
export function AboutHome({ settings: s, books }: { settings: StoreSettings; books: ProductCardType[] }) {
  const title = str(s, "about_home_title");
  if (!title) return null;
  const pillars = [1, 2, 3]
    .map((n) => ({ value: str(s, `about_pillar_${n}_value`), label: str(s, `about_pillar_${n}_label`) }))
    .filter((p) => p.value && p.label);
  const images = [1, 2, 3].map((n) => str(s, `about_home_image_${n}`)).filter(Boolean);

  return (
    <section className="container-shop pt-16 lg:pt-20">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div data-reveal className="grid grid-cols-3 gap-4">
          {(images.length ? images : books.slice(0, 3).map((b) => b.id)).slice(0, 3).map((item, i) => (
            <span
              key={String(item)}
              className={`relative block overflow-hidden rounded-xl bg-blush-150 shadow-soft ${i === 1 ? "translate-y-8" : ""}`}
            >
              <span className="block pb-[140%]" />
              {typeof item === "string" ? (
                <Image src={item} alt="" fill sizes="200px" className="object-cover" />
              ) : (
                <ProductImage product={books[i]} sizes="200px" />
              )}
            </span>
          ))}
        </div>
        <div data-reveal>
          {str(s, "about_home_eyebrow") && (
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-rose-600">{str(s, "about_home_eyebrow")}</p>
          )}
          <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[2.4rem]">{title}</h2>
          {str(s, "about_home_body1") && <p className="mt-5 text-[14.5px] leading-relaxed text-cocoa">{str(s, "about_home_body1")}</p>}
          {str(s, "about_home_body2") && <p className="mt-3 text-[14.5px] leading-relaxed text-cocoa">{str(s, "about_home_body2")}</p>}
          {pillars.length > 0 && (
            <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-blush-200 pt-6">
              {pillars.map((p) => (
                <div key={p.label}>
                  <dt className="sr-only">{p.label}</dt>
                  <dd className="text-[1.5rem] font-semibold text-rose-600">{p.value}</dd>
                  <dd className="mt-1 text-[12px] leading-snug text-fog">{p.label}</dd>
                </div>
              ))}
            </dl>
          )}
          <Link href="/about" className="mt-8 inline-flex items-center gap-2 rounded-full border border-ink px-6 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-ink hover:text-white">
            More about us
            <ChevronIcon className="h-3.5 w-3.5 -rotate-90" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Admin → Stats Counter values, when switched on. Null when off. */
export function adminStats(s: StoreSettings) {
  if (str(s, "stats_enabled") !== "1") return null;
  const items = [1, 2, 3, 4]
    .map((n) => ({ value: str(s, `stats_${n}_value`) + str(s, `stats_${n}_suffix`), label: str(s, `stats_${n}_label`) }))
    .filter((i) => i.value && i.label);
  return items.length ? items : null;
}

/** One rail per category — admin → Products → "Category Rail". */
export async function CategoryRails() {
  const rails = await api<{ data: { id: number; name: string; slug: string; products: ProductCardType[] }[] }>("/category-rails", {
    revalidate: 120,
  })
    .then((r) => r.data)
    .catch(() => []);
  return (
    <>
      {rails
        .filter((r) => r.products.length >= 3)
        .slice(0, 3)
        .map((r) => (
          <RailSection key={r.id} title={r.name} href={`/collection?category=${r.slug}`} products={r.products} />
        ))}
    </>
  );
}
