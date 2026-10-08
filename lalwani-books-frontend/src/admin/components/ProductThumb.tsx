import type { ProductCard as ProductCardType } from "@/admin/lib/types";
import { ProductImage } from "./ProductImage";

/** A small product photo, as the product list shows it. */
export function ProductThumb({
  product,
  className = "",
}: {
  product: Pick<ProductCardType, "name" | "image" | "colors" | "id">;
  className?: string;
}) {
  return (
    <span className={`relative block overflow-hidden bg-blush-100 ${className}`}>
      <ProductImage product={product} sizes="80px" showLabel={false} padClass="p-1" />
    </span>
  );
}
