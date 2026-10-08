import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Paginated, ProductCard as ProductCardType, ProductDetail } from "@/lib/types";
import { money } from "@/lib/format";
import { DrawnCover } from "@/components/ProductImage";
import { PageBanner } from "@/components/PageBanner";
import { BookRail } from "@/components/home/bookory-client";
import { AddToCartPanel } from "@/components/AddToCart";
import { PaymentMethods } from "@/components/PaymentMethods";
import type { EnabledMethods } from "@/components/payment-ticker";
import { ProductVideoButton } from "@/components/ProductVideoButton";
import { Stars } from "@/components/ui";
import { DeliveryPromise } from "@/components/DeliveryPromise";
import { getSettings } from "@/lib/settings";
import { ReviewsSection } from "./reviews";
import { ProductGallery } from "./gallery";
import { ProductDetails } from "./details";

export const revalidate = 60;

interface Params {
  slug: string;
}

export async function generateStaticParams() {
  try {
    const res = await api<Paginated<ProductCardType>>("/products?per_page=48", {
      revalidate: 300,
    });
    return res.data.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await api<{ data: ProductDetail }>(`/products/${slug}`, { revalidate: 60 });
    const p = res.data;
    return {
      title: p.author ? `${p.name} by ${p.author}` : p.name,
      description: `${p.author ? `${p.name} by ${p.author}. ` : ""}${p.description.slice(0, 150)}`,
    };
  } catch {
    return { title: "Book" };
  }
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;

  let product: ProductDetail;
  let related: ProductCardType[] = [];

  try {
    const res = await api<{ data: ProductDetail }>(`/products/${slug}`, { revalidate: 60 });
    product = res.data;
    related = await api<{ data: ProductCardType[] }>(`/products/${slug}/related`, {
      revalidate: 120,
    }).then((r) => r.data).catch(() => []);
  } catch {
    notFound();
  }

  // Only promise methods the shop can actually take — with the gateway off,
  // cash on delivery is the only one.
  const pay = await api<{
    data: { razorpay_enabled: boolean; methods?: EnabledMethods };
  }>("/payments/config", { revalidate: 300 })
    .then((r) => r.data)
    .catch(() => ({ razorpay_enabled: false, methods: undefined }));
  const online = pay.razorpay_enabled;

  /*
   * Three rails close the page. "Related Books" is the /related picks plus
   * the rest of this book's category — several categories hold only two or
   * three books, so it runs as long as the category allows. "Bestselling" and
   * "Top Rated" draw on the whole shop, each skipping what a rail above has
   * already shown, so the page offers more to browse rather than the same
   * covers three times. A failed fetch just means a shorter or missing rail:
   * a shopper has no use for an error banner about a recommendation.
   */
  const [sameCategory, bestsellers, topRated] = await Promise.all([
    product.category
      ? api<Paginated<ProductCardType>>(
          `/products?category=${encodeURIComponent(product.category.slug)}&per_page=12`,
          { revalidate: 120 }
        )
          .then((r) => r.data)
          .catch(() => [])
      : Promise.resolve<ProductCardType[]>([]),
    api<Paginated<ProductCardType>>("/products?bestsellers=1&per_page=12", { revalidate: 300 })
      .then((r) => r.data)
      .catch(() => []),
    api<Paginated<ProductCardType>>("/products?sort=rating&per_page=12", { revalidate: 300 })
      .then((r) => r.data)
      .catch(() => []),
  ]);

  const shown = new Set<number>([product.id]);
  const take = (pool: ProductCardType[], max: number) => {
    const out: ProductCardType[] = [];
    for (const p of pool) {
      if (shown.has(p.id)) continue;
      shown.add(p.id);
      out.push(p);
      if (out.length === max) break;
    }
    return out;
  };
  const relatedShelf = take([...related, ...sameCategory], 10);
  const bestsellerShelf = take(bestsellers, 10);
  const topRatedShelf = take(topRated, 10);

  const settings = await getSettings();

  const book = product.book;
  const details = [
    { label: "Author", value: book?.author },
    { label: "Publisher", value: book?.publisher },
    { label: "ISBN", value: book?.isbn },
    { label: "Binding", value: book?.binding },
    { label: "Language", value: book?.language },
    { label: "Pages", value: book?.pages ? String(book.pages) : null },
    { label: "Published", value: book?.published_year ? String(book.published_year) : null },
    { label: "SKU", value: product.sku },
  ].filter((d): d is { label: string; value: string } => Boolean(d.value));

  return (
    <>
      <PageBanner
        as="p"
        title={product.category?.name ?? "Shop"}
        crumbs={[
          { label: "Shop", href: "/collection" },
          ...(product.category ? [{ label: product.category.name, href: `/collection?category=${product.category.slug}` }] : []),
          { label: product.name },
        ]}
      />

      <div className="grid items-start gap-8 lg:grid-cols-2">
        {/* Cover */}
        <section className="card relative min-w-0 p-6 sm:p-10 lg:sticky lg:top-4">
          {product.image ? (
            <ProductGallery name={product.name} image={product.image} gallery={product.gallery ?? []} video={product.video} />
          ) : (
            <div className="relative mx-auto w-full max-w-[380px] overflow-hidden rounded-xl shadow-[0_30px_60px_-28px_rgba(0,0,0,0.45)]">
              <div className="pb-[140%]" />
              <DrawnCover product={product} />
              <ProductVideoButton video={product.video} />
            </div>
          )}
        </section>

        {/* Details */}
        <section className="card flex min-w-0 flex-col p-6 sm:p-9">
          <span
            className={`self-start rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ${
              product.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
            }`}
          >
            {product.stock > 0 ? "In stock" : "Out of stock"}
          </span>

          <h1 className="mt-4 text-[1.8rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[2.2rem]">{product.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-fog">
            {book?.author && (
              <span>
                Author:{" "}
                <Link href={`/collection?search=${encodeURIComponent(book.author)}`} className="font-medium text-ink hover:text-rose-600">
                  {book.author}
                </Link>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Stars rating={product.rating_avg} className="h-3.5 w-3.5" />
              <span className="text-ink">{product.rating_count}</span>
            </span>
            {product.sku && (
              <span>
                SKU: <span className="text-ink">{product.sku}</span>
              </span>
            )}
          </div>

          <hr className="my-6 border-blush-200" />

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-[1.8rem] font-semibold text-rose-600">{money(product.price)}</span>
            {product.compare_at_price && (
              <>
                <span className="text-[15px] text-fog line-through">{money(product.compare_at_price)}</span>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11.5px] font-semibold text-rose-700">
                  Save {Math.round((1 - product.price / product.compare_at_price) * 100)}%
                </span>
              </>
            )}
          </div>
          {product.tagline && <p className="mt-4 text-[14px] leading-relaxed text-cocoa">{product.tagline}</p>}

          <hr className="my-6 border-blush-200" />

          <AddToCartPanel productId={product.id} stock={product.stock} showWishlist />

          <DeliveryPromise freeOver={settings.free_shipping_threshold} flat={settings.flat_shipping} className="mt-6" />

          <div className="mt-6 space-y-1.5 border-t border-blush-200 pt-6 text-[13px] text-fog">
            {product.category && (
              <p>
                Category:{" "}
                <Link href={`/collection?category=${product.category.slug}`} className="text-ink hover:text-rose-600">
                  {product.category.name}
                </Link>
              </p>
            )}
            {book?.publisher && (
              <p>
                Publisher: <span className="text-ink">{book.publisher}</span>
              </p>
            )}
          </div>

          <PaymentMethods online={online} methods={pay.methods} className="mt-6" />
        </section>
      </div>

      {/* About this book (description, details, delivery — behind More details) beside the reviews */}
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-2">
        <ProductDetails
          description={product.description}
          details={details}
          delivery={
            <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-cocoa">
              <li>Books are packed securely and shipped across India.</li>
              <li>
                Free delivery over {money(settings.free_shipping_threshold)}, otherwise a flat {money(settings.flat_shipping)}.
              </li>
              <li>
                Damaged, misprinted or wrong books can be returned — see our{" "}
                <Link href="/pages/terms" className="text-rose-600 underline underline-offset-2">
                  returns policy
                </Link>
                .
              </li>
            </ul>
          }
        />

        <ReviewsSection slug={product.slug} className="min-w-0 self-start" />
      </div>

      <Rail
        title="Related Books"
        href={product.category ? `/collection?category=${product.category.slug}` : "/collection"}
        products={relatedShelf}
      />
      {/* The same heading the home page uses for this shelf (admin → Home Page). */}
      <Rail
        title={String(settings.home_bestsellers_title ?? "").trim() || "Bestselling Books"}
        href="/collection"
        products={bestsellerShelf}
        min={3}
      />
      <Rail title="Top Rated Books" href="/collection?sort=rating" products={topRatedShelf} min={3} />
    </>
  );
}

/** A closing rail in the page's own header style; hidden when too thin to be worth a row. */
function Rail({ title, href, products, min = 1 }: { title: string; href: string; products: ProductCardType[]; min?: number }) {
  if (products.length < min) return null;
  return (
    <section className="mt-16">
      <div className="mb-8 flex items-center gap-6">
        <h2 className="shrink-0 text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.85rem]">{title}</h2>
        <span aria-hidden className="hidden h-px flex-1 bg-blush-200 sm:block" />
        <Link
          href={href}
          className="ml-auto shrink-0 rounded-full bg-rose-600 px-5 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-rose-700 sm:ml-0"
        >
          View All
        </Link>
      </div>
      <BookRail products={products} />
    </section>
  );
}
