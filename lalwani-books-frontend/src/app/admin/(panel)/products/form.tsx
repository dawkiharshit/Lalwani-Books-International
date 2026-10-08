"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clientApi, apiUpload, ApiError } from "@/admin/lib/api";
import type { Category } from "@/admin/lib/types";
import { Spinner } from "@/admin/components/ui";
import { CURRENCY } from "@/admin/lib/format";
import { Select } from "@/admin/components/Select";

/** Mirrors the `max:6` on AdminMediaController::storeGallery. */
const GALLERY_MAX = 6;

export interface ProductFormValues {
  category_id: number;
  name: string;
  /** An author record from Categories & Authors; 0 = none. */
  author_id: number;
  /** A publisher record from Publishers; 0 = none. */
  publisher_id: number;
  isbn: string;
  pages: string;
  language: string;
  binding: string;
  published_year: string;
  sku: string;
  hsn_code: string;
  weight_grams: string;
  low_stock_threshold: string;
  tagline: string;
  description: string;
  price: string;
  compare_at_price: string;
  stock: string;
  size_ml: string;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_category_pick: boolean;
  image: string;
  video_url: string;
  color_from: string;
  color_to: string;
  accent: string;
  notes_top: string;
  notes_heart: string;
  notes_base: string;
}

export const EMPTY_PRODUCT: ProductFormValues = {
  category_id: 0,
  name: "",
  author_id: 0,
  publisher_id: 0,
  isbn: "",
  pages: "",
  language: "English",
  binding: "Paperback",
  published_year: "",
  sku: "",
  hsn_code: "",
  weight_grams: "",
  low_stock_threshold: "",
  tagline: "",
  description: "",
  price: "",
  compare_at_price: "",
  stock: "100",
  size_ml: "",
  is_featured: false,
  is_new_arrival: false,
  is_category_pick: false,
  image: "",
  video_url: "",
  color_from: "#F65D4E",
  color_to: "#C2410C",
  accent: "#FDE68A",
  notes_top: "",
  notes_heart: "",
  notes_base: "",
};

export function ProductForm({
  initial,
  productId,
}: {
  initial: ProductFormValues;
  productId?: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<{ id: number; name: string }[]>([]);
  const [authorsError, setAuthorsError] = useState("");

  useEffect(() => {
    clientApi<{ data: { id: number; name: string }[] }>("/admin/authors")
      .then((res) => setAuthors(res.data))
      .catch((err) =>
        setAuthorsError(
          err instanceof ApiError ? `Could not load authors: ${err.message}` : "Could not load authors."
        )
      );
  }, []);
  const [publishers, setPublishers] = useState<{ id: number; name: string }[]>([]);
  const [publishersError, setPublishersError] = useState("");

  useEffect(() => {
    clientApi<{ data: { id: number; name: string }[] }>("/admin/publishers")
      .then((res) => setPublishers(res.data))
      .catch((err) =>
        setPublishersError(
          err instanceof ApiError ? `Could not load publishers: ${err.message}` : "Could not load publishers."
        )
      );
  }, []);
  // Kept apart from `error`, which submit() clears — an empty dropdown needs
  // to keep saying why it is empty.
  const [categoryError, setCategoryError] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  // Only used when creating — existing products manage photos in MediaManager.
  const [photo, setPhoto] = useState<File | null>(null);
  /*
   * Extra photos chosen at create time. They cannot be uploaded yet: the
   * gallery endpoint hangs off a product id that does not exist until the
   * form is saved, so they are held here and sent straight afterwards.
   */
  const [gallery, setGallery] = useState<File[]>([]);

  useEffect(() => {
    clientApi<{ data: Category[] }>("/categories", { token: null, cartToken: null })
      .then((res) => {
        setCategories(res.data);
        // A dropdown whose value matches no option still *looks* filled in, so
        // a stale id would otherwise be submitted silently and rejected.
        setForm((f) =>
          res.data.some((c) => c.id === f.category_id)
            ? f
            : { ...f, category_id: res.data[0]?.id ?? 0 }
        );
      })
      .catch((err) => {
        /*
         * Without this the dropdown is just empty, which reads as "no
         * categories exist" instead of "the request failed".
         */
        setCategoryError(
          err instanceof ApiError
            ? `Could not load categories: ${err.message}`
            : "Could not load categories. Check that the API is running."
        );
      });
  }, []);

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Names the rail this product lands in, so the hint is concrete rather than abstract. */
  const categoryName = categories.find((c) => c.id === form.category_id)?.name ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const body = {
        ...form,
        price: Number(form.price),
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
        stock: Number(form.stock),
        size_ml: form.size_ml.trim() === "" ? null : Number(form.size_ml),
        author_id: form.author_id || null,
        publisher_id: form.publisher_id || null,
        isbn: form.isbn.trim() || null,
        pages: form.pages.trim() ? Number(form.pages) : null,
        language: form.language.trim() || null,
        binding: form.binding.trim() || null,
        published_year: form.published_year.trim() ? Number(form.published_year) : null,
        notes_top: form.notes_top.trim() || null,
        notes_heart: form.notes_heart.trim() || null,
        notes_base: form.notes_base.trim() || null,
        sku: form.sku.trim() || null,
        // The photo is never sent from here: it is uploaded and removed in the
        // Photos panel, and echoing a stale value used to wipe a fresh upload.
        video_url: form.video_url.trim() || null,
        hsn_code: form.hsn_code.trim() || null,
        // Blank means "no value", not zero — the server then uses its default.
        weight_grams: form.weight_grams.trim() ? Number(form.weight_grams) : null,
        low_stock_threshold: form.low_stock_threshold.trim()
          ? Number(form.low_stock_threshold)
          : null,
      };

      if (productId) {
        await clientApi(`/admin/products/${productId}`, { method: "PUT", body });
        router.push("/admin/products");
        return;
      }

      // New product: save first, then upload the chosen photo against the new id.
      const created = await clientApi<{ data: { id: number } }>("/admin/products", {
        method: "POST",
        body,
      });

      if (photo) {
        const fd = new FormData();
        fd.append("file", photo);
        try {
          await apiUpload(`/admin/products/${created.data.id}/image`, fd);
        } catch {
          // The product exists — send the admin to its edit page to retry the photo.
          router.push(`/admin/products/${created.data.id}/edit`);
          return;
        }
      }

      if (gallery.length > 0) {
        const fd = new FormData();
        gallery.forEach((f) => fd.append("files[]", f));
        try {
          await apiUpload(`/admin/products/${created.data.id}/gallery`, fd);
        } catch {
          router.push(`/admin/products/${created.data.id}/edit`);
          return;
        }
      }

      // Land on the edit page when photos were uploaded, so the admin sees what
      // actually arrived and can add more — the product list shows neither.
      router.push(
        photo || gallery.length > 0
          ? `/admin/products/${created.data.id}/edit`
          : "/admin/products"
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrors(err.errors ?? {});
      } else {
        setError("Save failed.");
      }
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];

  const text = (key: keyof ProductFormValues, label: string, props = {}) => (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-cocoa">{label}</label>
      <input
        value={String(form[key])}
        onChange={(e) => set(key, e.target.value as never)}
        className="input-base"
        {...props}
      />
      {err(key) && <p className="mt-1 text-[11px] text-red-500">{err(key)}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="grid items-start gap-6">
      <div className="card grid gap-4 p-7 sm:grid-cols-2">
        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 sm:col-span-2">{error}</p>}
        {text("name", "Name", { required: true })}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Category</label>
          <Select
            value={String(form.category_id ?? "")}
            onChange={(v) => set("category_id", Number(v))}
            options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            ariaLabel="Category"
            variant="field"
          />
          {categoryError && <p className="mt-1 text-[11px] text-red-600">{categoryError}</p>}
        </div>

        {/* Book details — the author shows under the title on every card and
            gets a shelf of their own; they are created in Categories & Authors. */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Author</label>
          <Select
            value={String(form.author_id || 0)}
            onChange={(v) => set("author_id", Number(v))}
            options={[{ value: "0", label: "— No author —" }, ...authors.map((a) => ({ value: String(a.id), label: a.name }))]}
            ariaLabel="Author"
            variant="field"
          />
          {authorsError ? (
            <p className="mt-1 text-[11px] text-red-600">{authorsError}</p>
          ) : (
            <p className="mt-1 text-[11px] text-fog">
              Not listed?{" "}
              <Link href="/admin/categories?tab=authors" className="text-rose-600 hover:underline">
                Add the author first
              </Link>
              , then pick them here.
            </p>
          )}
        </div>
        {/* The publisher is a record too (admin → Publishers), with its own
            shelf on the Publications page. */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Publisher</label>
          <Select
            value={String(form.publisher_id || 0)}
            onChange={(v) => set("publisher_id", Number(v))}
            options={[{ value: "0", label: "— No publisher —" }, ...publishers.map((p) => ({ value: String(p.id), label: p.name }))]}
            ariaLabel="Publisher"
            variant="field"
          />
          {publishersError ? (
            <p className="mt-1 text-[11px] text-red-600">{publishersError}</p>
          ) : (
            <p className="mt-1 text-[11px] text-fog">
              Not listed?{" "}
              <Link href="/admin/categories?tab=publications" className="text-rose-600 hover:underline">
                Add the publisher first
              </Link>
              , then pick them here.
            </p>
          )}
        </div>
        {text("isbn", "ISBN", { placeholder: "978-...", maxLength: 17 })}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Binding</label>
          <Select
            value={form.binding}
            onChange={(v) => set("binding", v)}
            options={["Paperback", "Hardcover", "Board Book", "Spiral Bound", "eBook"].map((b) => ({ value: b, label: b }))}
            ariaLabel="Binding"
            variant="field"
          />
        </div>
        {text("language", "Language")}
        {text("pages", "Pages", { type: "number", min: "1" })}
        {text("published_year", "Published year", { type: "number", min: "1000", max: "2100" })}


        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">SKU</label>
          <input
            value={form.sku}
            onChange={(e) => set("sku", e.target.value.toUpperCase())}
            className="input-base font-mono tracking-wide"
            placeholder={productId ? "" : "Leave blank to generate"}
            maxLength={40}
          />
          {err("sku") ? (
            <p className="mt-1 text-[11px] text-red-500">{err("sku")}</p>
          ) : (
            <p className="mt-1 text-[11px] text-fog">
              Your own stock code. Leave it blank and one is generated (LBI-XXXXXX). Must be unique.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">HSN code</label>
          <input
            value={form.hsn_code}
            onChange={(e) => set("hsn_code", e.target.value.replace(/\D/g, ""))}
            className="input-base font-mono tracking-wide"
            placeholder="4901"
            maxLength={8}
            inputMode="numeric"
          />
          {err("hsn_code") ? (
            <p className="mt-1 text-[11px] text-red-500">{err("hsn_code")}</p>
          ) : (
            <p className="mt-1 text-[11px] text-fog">
              Printed on the GST invoice — legally required there. 4, 6 or 8 digits. Printed books are
              usually 4901.
            </p>
          )}
        </div>

        {productId ? (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Product photo</label>
            <p className="rounded-xl bg-blush-50 px-4 py-2.5 text-[12px] leading-relaxed text-cocoa">
              Upload, replace or remove the photo in the Photos panel above — it saves the moment you
              choose a file, and this Save button leaves it untouched.
            </p>
          </div>
        ) : (
          /* On create there is no product id yet, so the file is held here and
             uploaded right after the product is saved. */
          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Product photo</label>
            <div className="flex items-center gap-2.5">
              <label className="cursor-pointer rounded-full border border-blush-200 px-4 py-2 text-[12px] text-cocoa hover:bg-blush-100">
                {photo ? "Change" : "Choose image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
              {photo && (
                <>
                  <span className="max-w-32 truncate text-[11.5px] text-cocoa">{photo.name}</span>
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="text-[11px] text-red-500 hover:underline"
                  >
                    remove
                  </button>
                </>
              )}
            </div>
            <p className="mt-1 text-[11px] text-fog">
              Optional — leave empty and a drawn cover in the book&rsquo;s colours is used. This is the photo shown on the
              product card.
            </p>

            <label className="mb-1 mt-4 block text-[11px] font-medium text-cocoa">
              More photos <span className="text-fog">(gallery — optional)</span>
            </label>
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="cursor-pointer rounded-full border border-blush-200 px-4 py-2 text-[12px] text-cocoa hover:bg-blush-100">
                {gallery.length > 0 ? "Add more" : "Choose images"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    // Matches the server's max:6 per request, so a seventh file
                    // is refused here rather than failing the whole upload.
                    setGallery((g) => [...g, ...picked].slice(0, GALLERY_MAX));
                    e.target.value = "";
                  }}
                />
              </label>
              {gallery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setGallery([])}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  clear all
                </button>
              )}
            </div>

            {gallery.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {gallery.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-1.5 rounded-full bg-blush-100 py-1 pl-3 pr-1.5 text-[11px] text-cocoa"
                  >
                    <span className="max-w-32 truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => setGallery((g) => g.filter((_, j) => j !== i))}
                      className="rounded-full px-1 text-fog hover:text-red-500"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-1 text-[11px] text-fog">
              Up to {GALLERY_MAX}, shown as thumbnails on the product page. You can add or remove
              more any time from this product&rsquo;s Photos panel after saving.
            </p>
          </div>
        )}

        {text("tagline", "Tagline")}
        {text("price", `Price (${CURRENCY})`, { required: true, type: "number", step: "0.01", min: "0" })}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">
            Compare-at price <span className="text-fog">(original / MRP — optional)</span>
          </label>
          <input
            value={String(form.compare_at_price)}
            onChange={(e) => set("compare_at_price", e.target.value as never)}
            className="input-base"
            type="number"
            step="0.01"
            min="0"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-fog">
            The original price, shown struck-through. Keep it higher than the price to show the
            discount — e.g. Price {CURRENCY}2,999 + Compare-at {CURRENCY}4,499 shows{" "}
            <span className="font-medium text-emerald-600">Save 33%</span>. Leave blank for no discount.
          </p>
        </div>
        {text("stock", "Stock", { required: true, type: "number", min: "0" })}

        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">
            Shipping weight (grams)
          </label>
          <input
            value={form.weight_grams}
            onChange={(e) => set("weight_grams", e.target.value)}
            className="input-base"
            type="number"
            min="1"
            placeholder="400"
          />
          {err("weight_grams") ? (
            <p className="mt-1 text-[11px] text-red-500">{err("weight_grams")}</p>
          ) : (
            <p className="mt-1 text-[11px] text-fog">
              The packed book. Sent to Shiprocket so the courier quote matches what it actually
              weighs. Blank uses 400g.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">
            Low stock warning at
          </label>
          <input
            value={form.low_stock_threshold}
            onChange={(e) => set("low_stock_threshold", e.target.value)}
            className="input-base"
            type="number"
            min="0"
            placeholder="10"
          />
          {err("low_stock_threshold") ? (
            <p className="mt-1 text-[11px] text-red-500">{err("low_stock_threshold")}</p>
          ) : (
            <p className="mt-1 text-[11px] text-fog">
              Counts towards the dashboard warning at or below this number. Blank uses 10.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4 pt-5 sm:col-span-2 sm:flex-row sm:gap-10">
          <div>
            <label className="flex items-center gap-2 text-[12px] text-cocoa">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => set("is_featured", e.target.checked)}
              />
              Featured
            </label>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-fog">
              Its photo represents this product&rsquo;s category on the Collection page. Tick none
              and the highest-rated product with a photo is used.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-[12px] text-cocoa">
              <input
                type="checkbox"
                checked={form.is_new_arrival}
                onChange={(e) => set("is_new_arrival", e.target.checked)}
              />
              New Arrival
            </label>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-fog">
              Shows in the New Arrivals rail on the home page. Tick none anywhere and the newest
              products are shown automatically.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-[12px] text-cocoa">
              <input
                type="checkbox"
                checked={form.is_category_pick}
                onChange={(e) => set("is_category_pick", e.target.checked)}
              />
              Category Rail
            </label>
            <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-fog">
              Shows in its own category&rsquo;s rail on the home page — this one goes under{" "}
              {categoryName || "its category"}. Tick none in a category and its newest products are
              shown automatically.
            </p>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-cocoa">
            Video — YouTube link <span className="text-fog">(optional)</span>
          </label>
          <input
            value={form.video_url}
            onChange={(e) => set("video_url", e.target.value)}
            className="input-base"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          {err("video_url") ? (
            <p className="mt-1 text-[11px] text-red-500">{err("video_url")}</p>
          ) : (
            <p className="mt-1 text-[11px] text-fog">
              Paste a YouTube link to show a video on the product page. To upload your own .mp4
              instead, save the product and use the &ldquo;Product video&rdquo; box below the photos.
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Description</label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="input-base resize-none"
          />
          {err("description") && <p className="mt-1 text-[11px] text-red-500">{err("description")}</p>}
        </div>
        {/* Cover-tint colours are not picked by hand — a new book takes the
            house defaults and an existing one keeps what it had. They ride
            along in the payload so the drawn placeholder cover stays tinted. */}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />} {productId ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </div>

    </form>
  );
}
