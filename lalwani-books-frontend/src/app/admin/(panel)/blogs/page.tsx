"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { clientApi, apiUpload, ApiError } from "@/admin/lib/api";
import { formatDate } from "@/admin/lib/format";
import { Spinner } from "@/admin/components/ui";

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  thumbnail: string | null;
  category: string | null;
  tags: string | null;
  author_name: string | null;
  is_active: boolean;
  is_featured: boolean;
  published_at: string | null;
  views: number;
}

const EMPTY = { title: "", excerpt: "", content: "", category: "", tags: "" };

export default function AdminBlogs() {
  const [rows, setRows] = useState<Post[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<Post | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The editor is tucked away until "Add New Blog" (or Edit) opens it.
  const [showForm, setShowForm] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setFile(null);
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(EMPTY);
    setFile(null);
    setShowForm(false);
  }

  const load = useCallback(() => {
    clientApi<{ data: Post[] }>("/admin/blogs")
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no posts.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load posts: ${err.message}`
            : "Could not load posts. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      const src = editing
        ? { title: editing.title, excerpt: editing.excerpt ?? "", content: editing.content, category: editing.category ?? "", tags: editing.tags ?? "" }
        : form;
      Object.entries(src).forEach(([k, v]) => v && fd.append(k, String(v)));
      if (file) fd.append("thumbnail", file);

      await apiUpload(editing ? `/admin/blogs/${editing.id}` : "/admin/blogs", fd);
      setForm(EMPTY);
      setEditing(null);
      setFile(null);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: Post) {
    const fd = new FormData();
    fd.append("is_active", p.is_active ? "0" : "1");
    await apiUpload(`/admin/blogs/${p.id}`, fd);
    load();
  }

  async function remove(p: Post) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    await clientApi(`/admin/blogs/${p.id}`, { method: "DELETE" });
    load();
  }

  const v = editing ?? form;
  const setV = (k: string, val: string) =>
    editing ? setEditing({ ...editing, [k]: val } as Post) : setForm({ ...form, [k]: val });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="font-serif text-[1.6rem] text-ink">Blog</h1>
          <p className="mt-1 text-[12px] text-fog">
            Posts on the Blog page (/blog) and in “From The Blog” on the home page. Hide a post to take it off the website.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openNew}
            className="rounded-full bg-rose-600 px-5 py-2 text-[12.5px] text-white hover:bg-rose-700"
          >
            + Add New Blog
          </button>
        )}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      {showForm && (
      <form onSubmit={submit} className="card grid gap-4 p-6 sm:grid-cols-2">
        <div className="flex items-center justify-between sm:col-span-2">
          <p className="text-[13px] font-medium text-ink">
            {editing ? <>Editing &ldquo;{editing.title}&rdquo;</> : "New Post"}
          </p>
          <button type="button" onClick={closeForm} className="text-[12px] text-fog underline hover:text-rose-600">
            Cancel
          </button>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Title</label>
          <input required value={v.title} onChange={(e) => setV("title", e.target.value)} className="input-base" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Category</label>
            <input value={v.category ?? ""} onChange={(e) => setV("category", e.target.value)} className="input-base" placeholder="Skin Notes" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Tags</label>
            <input value={v.tags ?? ""} onChange={(e) => setV("tags", e.target.value)} className="input-base" placeholder="reading list, new arrivals" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Excerpt</label>
          <textarea rows={2} value={v.excerpt ?? ""} onChange={(e) => setV("excerpt", e.target.value)} className="input-base resize-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-cocoa">
            Content <span className="text-fog">(HTML supported)</span>
          </label>
          <textarea
            required
            rows={12}
            value={v.content}
            onChange={(e) => setV("content", e.target.value)}
            className="input-base resize-y font-mono text-[12px]"
            placeholder="<h2>A heading</h2><p>A paragraph with <strong>bold</strong> and <a href='/collection'>a link</a>.</p><ul><li>Point one</li><li>Point two</li></ul>"
          />
          <p className="mt-1 text-[11px] text-fog">
            Write HTML — supported tags: &lt;h2&gt; &lt;h3&gt; &lt;p&gt; &lt;strong&gt; &lt;em&gt;
            &lt;ul&gt;&lt;li&gt; &lt;ol&gt; &lt;a href&gt; &lt;img src&gt; &lt;blockquote&gt; &lt;hr&gt;.
          </p>
        </div>
        <div className="flex items-end gap-3 sm:col-span-2">
          <label className="cursor-pointer rounded-full border border-blush-200 px-4 py-2 text-[12px] text-cocoa hover:bg-blush-100">
            {file ? file.name.slice(0, 24) : "Cover image"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button disabled={busy} className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60">
            {busy && <Spinner className="h-4 w-4" />} {editing ? "Save Post" : "+ Publish Post"}
          </button>
        </div>
      </form>
      )}

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : rows.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[13px] text-fog">No posts yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((p) => (
            <article key={p.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-blush-100">
                {p.thumbnail ? (
                  <Image src={p.thumbnail} alt="" fill sizes="96px" className="object-cover" unoptimized />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-fog">No cover</span>
                )}
              </div>
              <div className="min-w-40 flex-1">
                <p className="text-[13.5px] font-semibold text-ink">{p.title}</p>
                <p className="mt-0.5 text-[11px] text-fog">
                  {p.category && <>{p.category} · </>}
                  {p.published_at ? formatDate(p.published_at) : "Draft"} · {p.views} views
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${p.is_active ? "bg-green-100 text-green-700" : "bg-blush-100 text-fog"}`}>
                {p.is_active ? "Live" : "Hidden"}
              </span>
              <div className="flex items-center gap-2">
                <Link href={`/admin/blogs/${p.id}/seo`} className="rounded-full border border-rose-200 bg-blush-50 px-3.5 py-1 text-[12px] font-medium text-rose-600 hover:bg-blush-100">
                  SEO
                </Link>
                <button onClick={() => { setEditing(p); setFile(null); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-full border border-blush-200 px-3.5 py-1 text-[12px] text-cocoa hover:bg-blush-100">
                  Edit
                </button>
                <button onClick={() => toggle(p)} className="rounded-full border border-blush-200 px-3.5 py-1 text-[12px] text-cocoa hover:bg-blush-100">
                  {p.is_active ? "Hide" : "Show"}
                </button>
                <button onClick={() => remove(p)} className="rounded-full px-3 py-1 text-[12px] text-red-500 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
