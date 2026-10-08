"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { clientApi, apiUpload, ApiError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";

interface Row {
  id: number;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  sort_order: number;
  products_count: number;
  image: string | null;
  has_own_image: boolean;
}

type Draft = { name: string; tagline: string; description: string; sort_order: string };

const EMPTY: Draft = { name: "", tagline: "", description: "", sort_order: "" };

export function CategoriesPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState<Draft>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    clientApi<{ data: Row[] }>("/admin/categories")
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no categories.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load categories: ${err.message}`
            : "Could not load categories. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      (Object.keys(form) as (keyof Draft)[]).forEach((k) => form[k] && fd.append(k, form[k]));
      if (file) fd.append("image", file);
      await apiUpload("/admin/categories", fd);
      setForm(EMPTY);
      setFile(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setDraft({
      name: row.name,
      tagline: row.tagline ?? "",
      description: row.description ?? "",
      sort_order: String(row.sort_order ?? ""),
    });
  }

  async function saveEdit() {
    if (editingId === null) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      // Send blanks too, so clearing a tagline actually clears it.
      (Object.keys(draft) as (keyof Draft)[]).forEach((k) => fd.append(k, draft[k]));
      await apiUpload(`/admin/categories/${editingId}`, fd);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  /*
   * Both of these used to await without a catch, so a rejected upload became an
   * unhandled promise rejection: the row simply did not change and the reason
   * only ever reached the browser console. The server caps artwork at 4 MB and
   * jpg/png/webp, which is the rejection an admin will actually hit, and its
   * 422 names the problem — so it goes on the row, next to the button that was
   * pressed, the same way a refused delete does.
   */
  async function replaceImage(row: Row, f: File | undefined) {
    if (!f) return;
    setRowError(null);
    const fd = new FormData();
    fd.append("image", f);
    try {
      await apiUpload(`/admin/categories/${row.id}`, fd);
      load();
    } catch (err) {
      setRowError({
        id: row.id,
        message: err instanceof ApiError ? err.message : "Could not upload that image.",
      });
    }
  }

  async function clearImage(row: Row) {
    setRowError(null);
    try {
      await clientApi(`/admin/categories/${row.id}/image`, { method: "DELETE" });
      load();
    } catch (err) {
      setRowError({
        id: row.id,
        message: err instanceof ApiError ? err.message : "Could not remove the artwork.",
      });
    }
  }

  async function remove(row: Row) {
    if (!confirm(`Delete category "${row.name}"?`)) return;
    setError("");
    setRowError(null);
    try {
      await clientApi(`/admin/categories/${row.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      // Deleting a collection that still holds products is refused with a 422
      // and a sentence explaining why, so show that sentence rather than a
      // generic failure.
      setRowError({
        id: row.id,
        message: err instanceof ApiError ? err.message : "Delete failed.",
      });
    }
  }

  const field = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-cocoa">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input-base" {...props} />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">Categories</h1>
        <p className="mt-1 text-[12px] text-fog">
          Books are filed under a category, and the website filters by it. The image fills the
          category&rsquo;s tile in &ldquo;Browse By Genre&rdquo; on the home page (wide, 16:9, 800×450 or
          larger); with no image the tile is a coloured panel with a book icon. The tagline and
          description show at the top of the category&rsquo;s shop page.
        </p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <form onSubmit={create} className="card grid gap-4 p-6 sm:grid-cols-2">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">
          Add a category
        </p>
        {field(form.name, (v) => setForm({ ...form, name: v }), "Name", {
          required: true,
          placeholder: "Kark · Cancer",
        })}
        {field(form.tagline, (v) => setForm({ ...form, tagline: v }), "Tagline", {
          placeholder: "Deep, intuitive, dreamlike",
        })}
        {field(form.sort_order, (v) => setForm({ ...form, sort_order: v }), "Sort order", {
          type: "number",
          placeholder: "auto",
        })}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-base resize-none"
          />
        </div>
        <div className="flex items-end gap-3 sm:col-span-2">
          <label className="cursor-pointer rounded-full border border-blush-200 px-4 py-2 text-[12px] text-cocoa hover:bg-blush-100">
            {file ? file.name.slice(0, 24) : "Choose artwork (optional)"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />} + Add Category
          </button>
        </div>
      </form>

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) =>
            editingId === row.id ? (
              <div key={row.id} className="card grid gap-4 p-6 ring-1 ring-rose-300 sm:grid-cols-2">
                <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-rose-500 sm:col-span-2">
                  Editing category
                </p>
                {field(draft.name, (v) => setDraft({ ...draft, name: v }), "Name", { required: true })}
                {field(draft.tagline, (v) => setDraft({ ...draft, tagline: v }), "Tagline")}
                {field(draft.sort_order, (v) => setDraft({ ...draft, sort_order: v }), "Sort order", {
                  type: "number",
                })}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-cocoa">Description</label>
                  <textarea
                    rows={2}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    className="input-base resize-none"
                  />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <button
                    onClick={saveEdit}
                    disabled={busy}
                    className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busy && <Spinner className="h-4 w-4" />} Save Changes
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-full border border-blush-200 px-5 py-2 text-[12.5px] text-cocoa hover:bg-blush-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <article key={row.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-blush-100">
                  {row.image ? (
                    <Image src={row.image} alt="" fill sizes="64px" className="object-cover" unoptimized />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-fog">
                      No art
                    </span>
                  )}
                </div>

                <div className="min-w-40 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink">
                    {row.name}
                  </p>
                  {row.tagline && <p className="mt-0.5 text-[12px] text-cocoa">{row.tagline}</p>}
                  <p className="mt-0.5 text-[11px] text-fog">
                    {row.products_count} product{row.products_count === 1 ? "" : "s"}
                    {!row.has_own_image && row.image && " · using a product photo"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => startEdit(row)}
                    className="rounded-full bg-maroon-800 px-4 py-1 text-[12px] text-white hover:bg-maroon-900"
                  >
                    Edit
                  </button>
                  <label className="cursor-pointer rounded-full border border-blush-200 px-3.5 py-1 text-[12px] text-cocoa hover:bg-blush-100">
                    Artwork
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        replaceImage(row, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {row.has_own_image && (
                    <button
                      onClick={() => clearImage(row)}
                      className="rounded-full border border-blush-200 px-3.5 py-1 text-[12px] text-cocoa hover:bg-blush-100"
                    >
                      Clear art
                    </button>
                  )}
                  <button
                    onClick={() => remove(row)}
                    className="rounded-full px-3 py-1 text-[12px] text-red-500 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>

                {/* w-full so it wraps onto its own line under the buttons it
                    belongs to, inside the same flex row. */}
                {rowError?.id === row.id && (
                  <p className="w-full rounded-xl bg-red-50 px-3.5 py-2 text-[12px] text-red-600">
                    {rowError.message}
                  </p>
                )}
              </article>
            )
          )}
        </div>
      )}
    </div>
  );
}
