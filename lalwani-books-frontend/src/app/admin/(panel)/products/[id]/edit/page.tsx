"use client";

import { BackLink } from "@/admin/components/BackLink";
import { use, useEffect, useState } from "react";
import { clientApi } from "@/admin/lib/api";
import type { ProductDetail } from "@/admin/lib/types";
import { Spinner } from "@/admin/components/ui";
import { ProductForm, type ProductFormValues } from "../../form";
import { MediaManager } from "../../media";

type Row = ProductDetail & {
  is_active: boolean;
  category_id: number;
  gallery?: { id: number; url: string; alt: string | null }[];
};

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<ProductFormValues | null>(null);
  const [media, setMedia] = useState<{
    slug: string;
    image: string | null;
    gallery: Row["gallery"];
    video: ProductDetail["video"];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Fetch this one product directly — scanning the paginated list broke
    // as soon as the catalogue grew past one page.
    clientApi<{ data: Row }>(`/admin/products/${id}`)
      .then(({ data: row }) => {
        setMedia({ slug: row.slug, image: row.image, gallery: row.gallery ?? [], video: row.video ?? null });
        setInitial({
          category_id: row.category_id,
          name: row.name,
          author_id: row.author_id ?? 0,
          publisher_id: row.publisher_id ?? 0,
          isbn: row.book?.isbn ?? "",
          pages: row.book?.pages ? String(row.book.pages) : "",
          language: row.book?.language ?? "",
          binding: row.book?.binding ?? "Paperback",
          published_year: row.book?.published_year ? String(row.book.published_year) : "",
          sku: row.sku ?? "",
          hsn_code: row.hsn_code ?? "",
          weight_grams: row.weight_grams ? String(row.weight_grams) : "",
          low_stock_threshold:
            row.low_stock_threshold != null ? String(row.low_stock_threshold) : "",
          tagline: row.tagline ?? "",
          description: row.description,
          price: String(row.price),
          compare_at_price: row.compare_at_price ? String(row.compare_at_price) : "",
          stock: String(row.stock),
          size_ml: row.size_ml == null ? "" : String(row.size_ml),
          image: row.image ?? "",
          video_url: row.video_url ?? "",
          is_featured: row.is_featured,
          is_new_arrival: row.is_new_arrival ?? false,
          is_category_pick: row.is_category_pick ?? false,
          color_from: row.colors.from,
          color_to: row.colors.to,
          accent: row.colors.accent,
          notes_top: row.notes.top ?? "",
          notes_heart: row.notes.heart ?? "",
          notes_base: row.notes.base ?? "",
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load this product.")
      );
  }, [id]);

  if (error) return <p className="card px-6 py-5 text-[13px] text-red-600">{error}</p>;
  if (!initial)
    return (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> Loading product...
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/admin/products" label="Back to products" />

      <h1 className="font-serif text-[1.6rem] text-ink">Edit Product</h1>
      {media && (
        <MediaManager
          productId={Number(id)}
          slug={media.slug}
          initialImage={media.image}
          initialGallery={media.gallery ?? []}
          initialVideo={media.video ?? null}
        />
      )}
      <ProductForm initial={initial} productId={Number(id)} />
    </div>
  );
}
