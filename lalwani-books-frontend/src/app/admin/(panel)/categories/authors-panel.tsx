"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { clientApi, apiUpload, ApiError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";

interface Row {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  photo: string | null;
  sort_order: number;
  products_count: number;
}

type Draft = { name: string; bio: string; sort_order: string };

const EMPTY: Draft = { name: "", bio: "", sort_order: "" };

/** Two-letter monogram for an author without a photo, as the website draws it. */
function initials(name: string) {
  return name
    .replace(/[^A-Za-z\s.&]/g, "")
    .split(/[\s.&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * The authors half of Categories & Authors. An author is created here first,
 * then chosen on each book; the website shows them in "Popular Authors" and
 * in the circles under the hero — photo when there is one, initials otherwise
 * — each linking to the author's books.
 */
export function AuthorsPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState<Draft>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const photoInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(() => {
    clientApi<{ data: Row[] }>("/admin/authors")
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        setRows([]);
        setError(
          err instanceof ApiError ? `Could not load authors: ${err.message}` : "Could not load authors. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toFormData(d: Draft, photo: File | null) {
    const fd = new FormData();
    fd.append("name", d.name.trim());
    fd.append("bio", d.bio.trim());
    if (d.sort_order.trim()) fd.append("sort_order", d.sort_order.trim());
    if (photo) fd.append("photo", photo);
    return fd;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiUpload("/admin/authors", toFormData(form, file));
      setForm(EMPTY);
      setFile(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the author.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setDraft({ name: row.name, bio: row.bio ?? "", sort_order: String(row.sort_order ?? "") });
    setRowError(null);
  }

  async function saveEdit() {
    if (editingId === null) return;
    setBusy(true);
    try {
      await apiUpload(`/admin/authors/${editingId}`, toFormData(draft, null));
      setEditingId(null);
      load();
    } catch (err) {
      setRowError({ id: editingId, message: err instanceof ApiError ? err.message : "Save failed." });
    } finally {
      setBusy(false);
    }
  }

  async function replacePhoto(row: Row, f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setRowError(null);
    try {
      const fd = new FormData();
      fd.append("photo", f);
      await apiUpload(`/admin/authors/${row.id}`, fd);
      load();
    } catch (err) {
      setRowError({ id: row.id, message: err instanceof ApiError ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  async function clearPhoto(row: Row) {
    setBusy(true);
    setRowError(null);
    try {
      await clientApi(`/admin/authors/${row.id}/photo`, { method: "DELETE" });
      load();
    } catch (err) {
      setRowError({ id: row.id, message: err instanceof ApiError ? err.message : "Could not remove the photo." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Row) {
    if (!confirm(`Delete author "${row.name}"?`)) return;
    setBusy(true);
    setRowError(null);
    try {
      await clientApi(`/admin/authors/${row.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setRowError({ id: row.id, message: err instanceof ApiError ? err.message : "Delete failed." });
    } finally {
      setBusy(false);
    }
  }

  const field = (label: string, value: string, onChange: (v: string) => void, props: Record<string, unknown> = {}) => (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-cocoa">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input-base" {...props} />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">Authors</h1>
        <p className="mt-1 text-[12px] text-fog">
          Create an author here, then choose them on each book. The website shows every author with books
          in &ldquo;Popular Authors&rdquo; and in the round circles under the hero on the home page — with
          the photo when there is one, otherwise their initials. Each links to a shelf of their books.
          Photos: square, 400×400px or larger.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <form onSubmit={create} className="card grid gap-4 p-7 sm:grid-cols-2">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">
          Add an author
        </p>
        {field("Name", form.name, (v) => setForm({ ...form, name: v }), { required: true, placeholder: "R. K. Narayan" })}
        {field("Sort order", form.sort_order, (v) => setForm({ ...form, sort_order: v }), { type: "number", placeholder: "auto" })}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Short bio (optional)</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            className="input-base resize-y"
            placeholder="Shown at the top of the author's shelf on the website."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <label className="cursor-pointer rounded-full border border-blush-200 px-4 py-2 text-[12px] text-cocoa hover:bg-blush-100">
            {file ? `Photo: ${file.name}` : "Choose photo (optional)"}
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
            {busy && <Spinner className="h-4 w-4" />} + Add Author
          </button>
        </div>
      </form>

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : rows.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[13px] text-fog">No authors yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <article key={row.id} className="card px-6 py-5">
              {editingId === row.id ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">
                    Editing author
                  </p>
                  {field("Name", draft.name, (v) => setDraft({ ...draft, name: v }), { required: true })}
                  {field("Sort order", draft.sort_order, (v) => setDraft({ ...draft, sort_order: v }), { type: "number" })}
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[11px] font-medium text-cocoa">Short bio</label>
                    <textarea
                      value={draft.bio}
                      onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                      rows={3}
                      className="input-base resize-y"
                    />
                  </div>
                  {rowError?.id === row.id && <p className="text-[12px] text-red-600 sm:col-span-2">{rowError.message}</p>}
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={busy}
                      className="rounded-full bg-ink px-5 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-full border border-blush-200 px-5 py-1.5 text-[12px] text-cocoa hover:bg-blush-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blush-100 text-[14px] font-semibold text-rose-600">
                    {row.photo ? (
                      <Image src={row.photo} alt="" fill sizes="56px" className="object-cover" unoptimized />
                    ) : (
                      initials(row.name) || "?"
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{row.name}</p>
                    {row.bio && <p className="mt-0.5 line-clamp-1 text-[12px] text-cocoa">{row.bio}</p>}
                    <p className="mt-0.5 text-[11px] text-fog">
                      {row.products_count} {row.products_count === 1 ? "book" : "books"}
                      {!row.photo && " · no photo — shown as initials"}
                    </p>
                    {rowError?.id === row.id && <p className="mt-1 text-[12px] text-red-600">{rowError.message}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="rounded-full bg-ink px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-rose-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => photoInputs.current[row.id]?.click()}
                      disabled={busy}
                      className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
                    >
                      {row.photo ? "Replace photo" : "Add photo"}
                    </button>
                    <input
                      ref={(el) => {
                        photoInputs.current[row.id] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        replacePhoto(row, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {row.photo && (
                      <button
                        type="button"
                        onClick={() => clearPhoto(row)}
                        disabled={busy}
                        className="rounded-full px-3 py-1.5 text-[12px] text-fog hover:bg-blush-100 disabled:opacity-60"
                      >
                        Remove photo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      disabled={busy}
                      className="rounded-full px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
