"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUpload, clientApi, ApiError } from "@/admin/lib/api";
import { Spinner, Stars } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";

interface Row {
  id: number;
  name: string;
  designation: string | null;
  location: string | null;
  content: string;
  rating: number;
  is_active: boolean;
  sort_order: number;
  /** The reader's picture, shown beside the quote on the home page. */
  photo: string | null;
}

const EMPTY = { name: "", designation: "Verified buyer", location: "", content: "", rating: "5" };
/** Pictures the form accepts, matching what the API allows. */
const PHOTO_TYPES = "image/jpeg,image/png,image/webp";
const PHOTO_MAX_MB = 4;

export default function AdminTestimonials() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  // The testimonial being edited in the form above, or null when adding one.
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The picture chosen for the testimonial being written, and the one already
  // saved on the one being edited.
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoSaved, setPhotoSaved] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    clientApi<{ data: Row[] }>("/admin/testimonials")
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no testimonials.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load testimonials: ${err.message}`
            : "Could not load testimonials. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      name: form.name,
      designation: form.designation.trim() || null,
      location: form.location.trim() || null,
      content: form.content,
      rating: Number(form.rating),
    };
    try {
      if (photo) {
        // A picture can only be sent as multipart, which PHP does not read on
        // a PUT — so a photo always goes by POST (see the API's routes).
        const fd = new FormData();
        Object.entries(body).forEach(([k, v]) => fd.append(k, v === null ? "" : String(v)));
        fd.append("photo", photo);
        await apiUpload(editing ? `/admin/testimonials/${editing}` : "/admin/testimonials", fd);
      } else if (editing) {
        await clientApi(`/admin/testimonials/${editing}`, { method: "PUT", body });
      } else {
        await clientApi("/admin/testimonials", { method: "POST", body });
      }
      setForm(EMPTY);
      setEditing(null);
      setPhoto(null);
      setPhotoSaved(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function edit(t: Row) {
    setEditing(t.id);
    setForm({
      name: t.name,
      designation: t.designation ?? "",
      location: t.location ?? "",
      content: t.content,
      rating: String(t.rating),
    });
    setPhoto(null);
    setPhotoSaved(t.photo);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY);
    setPhoto(null);
    setPhotoSaved(null);
  }

  /** Checked here as well as on the server, so a wrong file says so at once. */
  function choosePhoto(chosen: File | undefined) {
    if (!chosen) return;
    if (!PHOTO_TYPES.split(",").includes(chosen.type)) {
      setError("Choose a JPG, PNG or WebP picture.");
      return;
    }
    if (chosen.size > PHOTO_MAX_MB * 1024 * 1024) {
      setError(`That picture is over ${PHOTO_MAX_MB} MB. Choose a smaller one.`);
      return;
    }
    setError("");
    setPhoto(chosen);
  }

  async function removePhoto() {
    if (!editing) {
      setPhoto(null);
      return;
    }
    await clientApi(`/admin/testimonials/${editing}/photo`, { method: "DELETE" });
    setPhoto(null);
    setPhotoSaved(null);
    load();
  }

  async function toggle(t: Row) {
    await clientApi(`/admin/testimonials/${t.id}`, { method: "PUT", body: { toggle: true } });
    load();
  }

  async function remove(t: Row) {
    if (!confirm(`Delete testimonial by ${t.name}?`)) return;
    await clientApi(`/admin/testimonials/${t.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">Testimonials</h1>
        <p className="mt-1 text-[12px] text-fog">
          Shown as cards in the testimonials band on the home page and the About page — photo,
          name, role, location, stars and quote (rename or hide the band in Home Page). Two rows
          show at a time and the band slides on to the next set by itself; up to twelve live ones
          are shown. Hide one and it disappears from the website.
        </p>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <form onSubmit={save} className="card grid gap-4 p-6 sm:grid-cols-2">
        {editing && (
          <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-rose-600 sm:col-span-2">
            Editing a testimonial
          </p>
        )}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-base" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Rating</label>
          <Select
            value={String(form.rating)}
            onChange={(v) => setForm({ ...form, rating: v })}
            options={[5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} ★` }))}
            ariaLabel="Rating"
            variant="field"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Role</label>
          <input
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            className="input-base"
            placeholder="Verified buyer"
          />
          <p className="mt-1 text-[11px] text-fog">Shown after the name, e.g. “Teacher” or “Verified buyer”. Optional.</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Location</label>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="input-base"
            placeholder="New Delhi"
          />
          <p className="mt-1 text-[11px] text-fog">Shown after the role. Optional.</p>
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 block text-[11px] font-medium text-cocoa">Photo</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blush-100 text-[11px] text-fog">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- the file just chosen, not yet uploaded
                <img src={URL.createObjectURL(photo)} alt="" className="h-full w-full object-cover" />
              ) : photoSaved ? (
                // eslint-disable-next-line @next/next/no-img-element -- one small picture from our own storage
                <img src={photoSaved} alt="" className="h-full w-full object-cover" />
              ) : (
                "None"
              )}
            </span>
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100"
            >
              {photo || photoSaved ? "Change photo" : "Upload photo"}
            </button>
            {(photo || photoSaved) && (
              <button
                type="button"
                onClick={removePhoto}
                className="rounded-full px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50"
              >
                Remove
              </button>
            )}
            <input
              ref={photoInput}
              type="file"
              accept={PHOTO_TYPES}
              className="hidden"
              aria-label="Choose a photo for this testimonial"
              onChange={(e) => {
                choosePhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-fog">
            The reader&rsquo;s picture, shown beside the quote. JPG, PNG or WebP, up to {PHOTO_MAX_MB} MB. Without one,
            their initials are shown.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Quote</label>
          <textarea
            required
            rows={3}
            maxLength={1000}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="input-base resize-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />} {editing ? "Save changes" : "+ Add Testimonial"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-full border border-blush-200 px-5 py-2 text-[13px] text-cocoa hover:bg-blush-100"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : rows.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[13px] text-fog">No testimonials yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((t) => (
            <article key={t.id} className="card px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                {t.photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- one small picture from our own storage
                  <img src={t.photo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                )}
                <p className="text-[13px] font-semibold text-ink">{t.name}</p>
                {(t.designation || t.location) && (
                  <span className="text-[11px] text-fog">{[t.designation, t.location].filter(Boolean).join(", ")}</span>
                )}
                <Stars rating={t.rating} />
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    t.is_active ? "bg-green-100 text-green-700" : "bg-blush-100 text-fog"
                  }`}
                >
                  {t.is_active ? "Live" : "Hidden"}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => edit(t)}
                    className="rounded-full border border-blush-200 px-4 py-1 text-[12px] text-cocoa hover:bg-blush-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggle(t)}
                    className="rounded-full border border-blush-200 px-4 py-1 text-[12px] text-cocoa hover:bg-blush-100"
                  >
                    {t.is_active ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => remove(t)} className="rounded-full px-3 py-1 text-[12px] text-red-500 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-cocoa">{t.content}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
