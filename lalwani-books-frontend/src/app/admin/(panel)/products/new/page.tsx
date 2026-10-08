"use client";

import { BackLink } from "@/admin/components/BackLink";
import { EMPTY_PRODUCT, ProductForm } from "../form";

export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/admin/products" label="Back to products" />

      <h1 className="font-serif text-[1.6rem] text-ink">New Product</h1>
      <ProductForm initial={EMPTY_PRODUCT} />
    </div>
  );
}
