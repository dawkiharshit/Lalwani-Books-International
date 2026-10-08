import Link from "next/link";
import type { ProductCard as ProductCardType } from "@/lib/types";
import { money } from "@/lib/format";
import { CardQuantityControl } from "./AddToCart";
import { WishlistButton } from "./WishlistButton";
import { ProductImage } from "./ProductImage";
import { Stars } from "./ui";

/**
 * Bookory book card: a rounded cover, then title, rating, author and a coral
 * price. Wishlist sits on the cover; add-to-cart sits under the price.
 */
export function ProductCard({ product }: { product: ProductCardType }) {
  const off = product.compare_at_price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  return (
    <Link href={`/product/${product.slug}`} className="group relative flex h-full flex-col">
      <div className="relative overflow-hidden rounded-[10px] bg-blush-150 pb-[140%] transition-[translate,box-shadow] duration-300 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_22px_40px_-22px_rgba(0,0,0,0.55)]">
        <ProductImage
          product={product}
          sizes="(max-width: 640px) 46vw, (max-width: 1280px) 25vw, 18vw"
          className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />

        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {off > 0 && (
            <span className="rounded-full bg-rose-600 px-2.5 py-1 text-[10.5px] font-semibold leading-none text-white">
              -{off}%
            </span>
          )}
          {!product.in_stock && (
            <span className="rounded-full bg-ink px-2.5 py-1 text-[10.5px] font-semibold leading-none text-white">
              Sold out
            </span>
          )}
        </div>

        <WishlistButton
          productId={product.id}
          className="absolute right-2.5 top-2.5 h-9 w-9 border-0 bg-white shadow-soft transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        />
      </div>

      <div className="flex flex-1 flex-col pt-3.5">
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink transition-colors group-hover:text-rose-600 sm:text-[16px]">
          {product.name}
        </p>

        <div className="mt-1.5 flex items-center gap-1.5">
          <Stars rating={product.rating_avg} className="h-3 w-3" />
          <span className="text-[11.5px] text-ink">{product.rating_count}</span>
        </div>

        {product.author && <p className="mt-1 line-clamp-1 text-[12px] text-fog">{product.author}</p>}

        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="text-[18px] font-semibold leading-none text-rose-600">{money(product.price)}</span>
          {product.compare_at_price && (
            <span className="text-[12.5px] text-fog line-through">{money(product.compare_at_price)}</span>
          )}
        </div>

        {product.in_stock && (
          <div className="mt-3">
            <CardQuantityControl productId={product.id} label="Add to cart" />
          </div>
        )}
      </div>
    </Link>
  );
}

export function ProductThumb({
  product,
  className = "",
}: {
  product: Pick<ProductCardType, "name" | "image" | "colors" | "id" | "author">;
  className?: string;
}) {
  return (
    <span className={`relative block overflow-hidden bg-blush-150 ${className}`}>
      <ProductImage product={product} sizes="80px" showLabel={false} />
    </span>
  );
}
