"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, ApiError } from "@/admin/lib/api";
import type { ProductDetail } from "@/admin/lib/types";
import { money } from "@/admin/lib/format";
import { ProductThumb } from "@/admin/components/ProductThumb";
import { Spinner } from "@/admin/components/ui";

type Row = ProductDetail & { is_active: boolean; category_id: number };

export default function AdminProducts() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    clientApi<{ data: Row[]; meta: typeof meta }>(`/admin/products?${params}`)
      .then((res) => {
        setRows(res.data);
        setMeta(res.meta);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no products.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load products: ${err.message}`
            : "Could not load products. Check that the API is running."
        );
      });
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(row: Row) {
    await clientApi(`/admin/products/${row.id}`, {
      method: "PUT",
      body: {
        ...toPayload(row),
        is_active: !row.is_active,
      },
    });
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-wrap items-center gap-3 p-5">
        <h1 className="mr-auto font-serif text-[1.5rem] text-ink">Products</h1>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // a new search must start from the first page
          }}
          placeholder="Search products..."
          className="input-base max-w-60"
        />
        <Link
          href="/admin/products/new"
          className="rounded-full bg-rose-600 px-5 py-2 text-[12.5px] text-white hover:bg-rose-700"
        >
          + New Product
        </Link>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <div className="card overflow-x-auto p-6">
        {!rows ? (
          <div className="flex items-center justify-center gap-2 py-16 text-fog">
            <Spinner className="h-5 w-5" /> Loading products...
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-blush-100 text-[10.5px] uppercase tracking-wide text-fog">
                <th className="pb-2 pr-3">Product</th>
                <th className="pb-2 pr-3">Price</th>
                <th className="pb-2 pr-3">Stock</th>
                <th className="pb-2 pr-3">Rating</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush-50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-3">
                      <ProductThumb product={row} className="h-11 w-11 shrink-0 rounded-lg" />
                      <span>
                        <span className="block font-medium text-ink">{row.name}</span>
                        <span className="text-[10.5px] text-fog">{row.sku}</span>
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-cocoa">{money(row.price)}</td>
                  <td className={`py-2.5 pr-3 ${row.stock <= 10 ? "font-semibold text-red-500" : "text-cocoa"}`}>{row.stock}</td>
                  <td className="py-2.5 pr-3 text-cocoa">{row.rating_avg.toFixed(1)} ({row.rating_count})</td>
                  <td className="py-2.5 pr-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-blush-100 text-fog"}`}>
                      {row.is_active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <Link href={`/admin/products/${row.id}/edit`} className="mr-3 text-rose-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => toggleActive(row)} className="text-fog hover:text-ink">
                      {row.is_active ? "Archive" : "Restore"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {rows && rows.length === 0 && (
          <p className="py-12 text-center text-[13px] text-fog">No products match that search.</p>
        )}

        {meta.last_page > 1 && (
          <div className="mt-5 flex items-center justify-between border-t border-blush-100 pt-4">
            <p className="text-[11.5px] text-fog">
              Page {meta.current_page} of {meta.last_page} · {meta.total} products
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={meta.current_page <= 1}
                className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                disabled={meta.current_page >= meta.last_page}
                className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function toPayload(row: Row) {
  return {
    category_id: row.category_id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    price: row.price,
    compare_at_price: row.compare_at_price,
    stock: row.stock,
    size_ml: row.size_ml,
    is_featured: row.is_featured,
    is_new_arrival: row.is_new_arrival ?? false,
    image: row.image,    color_from: row.colors.from,
    color_to: row.colors.to,
    accent: row.colors.accent,
    notes_top: row.notes.top,
    notes_heart: row.notes.heart,
    notes_base: row.notes.base,
  };
}
