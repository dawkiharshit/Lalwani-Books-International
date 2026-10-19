"use client";

import { useState } from "react";
import Image from "@/components/Image";
import type { ProductCard } from "@/lib/types";

type Subject = Pick<ProductCard, "id" | "name" | "image" | "colors"> & { author?: string | null };

/**
 * Book cover photo that falls back to a drawn cover when there is no photo,
 * or the file behind `src` has gone missing.
 *
 * The drawn cover fills the frame edge to edge, as a real cover would on a
 * Bookory-style shelf: the book's own colours, its title and author, and a
 * spine shadow on the left so a grid of them still reads as books.
 */
export function ProductImage({
  product,
  sizes,
  className = "",
  showLabel = true,
  eager = false,
}: {
  product: Subject;
  sizes: string;
  className?: string;
  showLabel?: boolean;
  /**
   * For the first covers on a page: fetched straight away, at high priority,
   * instead of once the browser has run the scripts and worked out that they
   * are on screen. On a phone that wait put the first cover — the largest
   * thing on the page — about a second late.
   */
  eager?: boolean;
  /** Accepted for older call sites; the drawn cover has no padding. */
  padClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  // A blush shimmer sits behind the photo until it has arrived.
  const [loaded, setLoaded] = useState(false);

  if (product.image && !failed) {
    return (
      <>
        {!loaded && <span aria-hidden className="skeleton absolute inset-0" />}
        <Image
          src={product.image}
          alt={`${product.name} — cover`}
          fill
          sizes={sizes}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          loading={eager ? "eager" : undefined}
          fetchPriority={eager ? "high" : undefined}
          className={`object-cover ${className}`}
        />
      </>
    );
  }

  return <DrawnCover product={product} showLabel={showLabel} className={className} />;
}

export function DrawnCover({
  product,
  showLabel = true,
  className = "",
}: {
  product: Subject;
  showLabel?: boolean;
  className?: string;
}) {
  const { from, to, accent } = product.colors;
  // Long titles step down so they still fit inside the frame.
  const size = product.name.length > 40 ? "text-[0.8em]" : product.name.length > 22 ? "text-[0.95em]" : "text-[1.12em]";

  return (
    <span
      role="img"
      aria-label={`${product.name}${product.author ? ` by ${product.author}` : ""} — cover`}
      className={`absolute inset-0 flex flex-col overflow-hidden [container-type:inline-size] ${className}`}
      style={{ background: `linear-gradient(150deg, ${from} 0%, ${to} 100%)` }}
    >
      {/* Spine shadow and a soft light from the top right. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/30 to-transparent" />
      <span aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_60%_at_85%_0%,rgba(255,255,255,0.22),transparent_70%)]" />

      {showLabel && (
        <span className="relative flex h-full flex-col px-[11%] pb-[9%] pt-[22%] text-white [font-size:clamp(8px,8.6cqw,19px)]">
          <span aria-hidden className="mb-[0.6em] block h-[2px] w-[22%] rounded-full" style={{ background: accent }} />
          <span className={`line-clamp-4 font-semibold leading-[1.15] tracking-[-0.01em] [overflow-wrap:anywhere] [hyphens:auto] ${size}`}>{product.name}</span>
          {product.author && (
            <span className="mt-[0.6em] line-clamp-2 text-[0.62em] font-medium leading-snug text-white/85">
              {product.author}
            </span>
          )}
          <span className="mt-auto text-[0.42em] font-semibold uppercase tracking-[0.18em] text-white/75">
            Lalwani Books
          </span>
        </span>
      )}
    </span>
  );
}
