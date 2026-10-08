"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { clientApi, apiUpload, ApiError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
// The website's own monogram, so a publisher without a logo looks the same in both places.
import { initialsOf } from "@/lib/format";

interface Row {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  sort_order: number;
  products_count: number;
}

type Draft = { name: string; description: string; sort_order: string };

const EMPTY: Draft = { name: "", description: "", sort_order: "" };

/**
 * The Publications half of Categories & Authors: publishers, managed the way
 * authors are — created here first, then chosen on each book. The website
 * lists every publisher on its Publications page — logo when there is one,
 * initials otherwise — each linking to a shelf of their books.
 */
export function PublishersPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState<Draft>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const logoInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(() => {
    clientApi<{ data: Row[] }>("/admin/publishers")
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        setRows([]);
        setError(
          err instanceof ApiError ? `Could not load publishers: ${err.message}` : "Could not load publishers. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toFormData(d: Draft, logo: File | null) {
    const fd = new FormData();
    fd.append("name", d.name.trim());
    fd.append("description", d.description.trim());
    if (d.sort_order.trim()) fd.append("sort_order", d.sort_order.trim());
    if (logo) fd.append("logo", logo);
    return fd;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiUpload("/admin/publishers", toFormData(form, file));
      setForm(EMPTY);
      setFile(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the publisher.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setDraft({ name: row.name, description: row.description ?? "", sort_order: String(row.sort_order ?? "") });
    setRowError(null);
  }

  async function saveEdit() {
    if (editingId === null) return;
    setBusy(true);
    try {
      await apiUpload(`/admin/publishers/${editingId}`, toFormData(draft, null));
      setEditingId(null);
      load();
    } catch (err) {
      setRowError({ id: editingId, message: err instanceof ApiError ? err.message : "Save failed." });
    } finally {
      setBusy(false);
    }
  }

  async function replaceLogo(row: Row, f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setRowError(null);
    try {
      const fd = new FormData();
      fd.append("logo", f);
      await apiUpload(`/admin/publishers/${row.id}`, fd);
      load();
    } catch (err) {
      setRowError({ id: row.id, message: err instanceof ApiError ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  async function clearLogo(row: Row) {
    setBusy(true);
    setRowError(null);
    try {
      await clientApi(`/admin/publishers/${row.id}/logo`, { method: "DELETE" });
      load();
    } catch (err) {
      setRowError({ id: row.id, message: err instanceof ApiError ? err.message : "Could not remove the logo." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Row) {
    if (!confirm(`Delete publisher "${row.name}"?`)) return;
    setBusy(true);
    setRowError(null);
    try {
      await clientApi(`/admin/publishers/${row.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setRowError({ id: row.id, message: err instanceof ApiError ? err.message : "Delete failed." });
    } finally {
      setBusy(false);
    }
  }

  const field = (id: string, label: string, value: string, onChange: (v: string) => void, props: Record<string, unknown> = {}) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-cocoa">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input-base" {...props} />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">Publications</h1>
        <p className="mt-1 max-w-3xl text-[12px] text-fog">
          Create a publisher here, then choose them on each book (Products → Publisher). The website lists every publisher on
          its Publications page — with the logo when there is one, otherwise their initials — and each links to a shelf of
          their books. Logos: PNG or WebP with a transparent or white background, 400px wide or larger.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <form onSubmit={create} className="card grid gap-4 p-7 sm:grid-cols-2">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">Add a publisher</p>
        {field("publisher-name", "Name", form.name, (v) => setForm({ ...form, name: v }), {
          required: true,
          maxLength: 120,
          placeholder: "Penguin Random House",
        })}
        {field("publisher-order", "Sort order", form.sort_order, (v) => setForm({ ...form, sort_order: v }), {
          type: "number",
          min: 0,
          placeholder: "auto",
        })}
        <div className="sm:col-span-2">
          <label htmlFor="publisher-description" className="mb-1 block text-[11px] font-medium text-cocoa">
            Short description (optional)
          </label>
          <textarea
            id="publisher-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            maxLength={2000}
            className="input-base resize-y"
            placeholder="Shown on the Publications page and at the top of the publisher's shelf."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <label className="cursor-pointer rounded-full border border-blush-200 px-4 py-2 text-[12px] text-cocoa hover:bg-blush-100">
            {file ? `Logo: ${file.name}` : "Choose logo (optional)"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button disabled={busy} className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60">
            {busy && <Spinner className="h-4 w-4" />} + Add Publisher
          </button>
        </div>
      </form>

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : rows.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[13px] text-fog">No publishers yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <article key={row.id} className="card px-6 py-5">
              {editingId === row.id ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">Editing publisher</p>
                  {field(`publisher-${row.id}-name`, "Name", draft.name, (v) => setDraft({ ...draft, name: v }), { required: true, maxLength: 120 })}
                  {field(`publisher-${row.id}-order`, "Sort order", draft.sort_order, (v) => setDraft({ ...draft, sort_order: v }), {
                    type: "number",
                    min: 0,
                  })}
                  <div className="sm:col-span-2">
                    <label htmlFor={`publisher-${row.id}-description`} className="mb-1 block text-[11px] font-medium text-cocoa">
                      Short description
                    </label>
                    <textarea
                      id={`publisher-${row.id}-description`}
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      rows={3}
                      maxLength={2000}
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
                  <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blush-100 text-[14px] font-semibold text-rose-600">
                    {row.logo ? (
                      <Image src={row.logo} alt="" fill sizes="56px" className="bg-white object-contain p-1.5" unoptimized />
                    ) : (
                      initialsOf(row.name)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-ink">{row.name}</p>
                    {row.description && <p className="mt-0.5 line-clamp-1 text-[12px] text-cocoa">{row.description}</p>}
                    <p className="mt-0.5 text-[11px] text-fog">
                      {row.products_count} {row.products_count === 1 ? "book" : "books"}
                      {!row.logo && " · no logo — shown as initials"}
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
                      onClick={() => logoInputs.current[row.id]?.click()}
                      disabled={busy}
                      className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
                    >
                      {row.logo ? "Replace logo" : "Add logo"}
                    </button>
                    <input
                      ref={(el) => {
                        logoInputs.current[row.id] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        replaceLogo(row, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    {row.logo && (
                      <button
                        type="button"
                        onClick={() => clearLogo(row)}
                        disabled={busy}
                        className="rounded-full px-3 py-1.5 text-[12px] text-fog hover:bg-blush-100 disabled:opacity-60"
                      >
                        Remove logo
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
