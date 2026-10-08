"use client";

import { useEffect, useState } from "react";
import { clientApi, ApiError } from "@/admin/lib/api";
import { SettingsForm } from "../settings-form";
import { Spinner } from "@/admin/components/ui";
import type { ProductDetail } from "@/admin/lib/types";

interface Row extends ProductDetail {
  is_active: boolean;
}

/**
 * Picks the one product shown in the home-page spotlight.
 *
 * The dropdown is built from the live catalogue rather than typed by hand, so
 * it can never point at a product that does not exist.
 */
export default function AdminSpotlight() {
  const [products, setProducts] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: Row[] }>("/admin/products")
      .then((res) => {
        setProducts(res.data.filter((p) => p.is_active));
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no products.
         */
        setProducts([]);
        setError(
          err instanceof ApiError
            ? `Could not load products: ${err.message}`
            : "Could not load products. Check that the API is running."
        );
      });
  }, []);

  if (!products) {
    return (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> Loading products…
      </div>
    );
  }

  return (
    <>
      {error && <p className="mb-5 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
      <SettingsForm
        heading="Product Spotlight"
        blurb="One product shown large on the home page, right after “What's In Trend” — cover, author, rating, price and an add-to-cart button. The title, author, price, MRP, cover and stock all come from the book itself, so there is nothing to keep in sync here."
        sections={[
          {
            fields: [
              {
                key: "spotlight_enabled",
                label: "Show the spotlight on the home page",
                type: "toggle",
                span: true,
              },
              {
                key: "spotlight_product_slug",
                label: "Product",
                type: "select",
                span: true,
                options: [
                  { value: "", label: "— none selected —" },
                  ...products.map((p) => ({
                    value: p.slug,
                    label: `${p.name} · ${p.sku ?? "no SKU"}`,
                  })),
                ],
                hint: "Only active products are listed. Archive the chosen product and the whole block disappears from the home page on its own.",
              },
            ],
          },
          {
            title: "Wording",
            fields: [
              {
                key: "spotlight_eyebrow",
                label: "Small line above the heading",
                placeholder: "This month",
              },
              {
                key: "spotlight_heading",
                label: "Heading",
                placeholder: "The one everyone asks about",
                hint: "Leave both blank and the block starts straight at the product, with no heading.",
              },
              {
                key: "spotlight_note",
                label: "Short description",
                span: true,
                placeholder: "A modern classic everyone is talking about.",
                hint: "Shown under the heading. Leave blank to use the book's own description.",
              },
            ],
          },
        ]}
      />
    </>
  );
}
