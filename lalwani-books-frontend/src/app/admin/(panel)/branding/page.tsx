"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiUpload, clientApi } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";

type Branding = {
  site_name: string;
  site_tagline: string;
  site_logo: string;
  site_favicon: string;
  announcement: string;
};

const EMPTY: Branding = {
  site_name: "",
  site_tagline: "",
  site_logo: "",
  site_favicon: "",
  announcement: "",
};

/**
 * Branding — logo, favicon, store name, tagline and the announcement bar.
 * Files upload straight away (POST /admin/branding/{field}); the text fields
 * save together through the shared settings endpoint.
 */
export default function AdminBranding() {
  const [form, setForm] = useState<Branding | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | "">("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clientApi<{ data: Record<string, string> }>("/admin/settings")
      .then((res) => setForm({ ...EMPTY, ...(res.data as unknown as Branding) }))
      .catch(() => setError("Could not load branding."));
  }, []);

  function set(key: keyof Branding, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
  }

  async function upload(field: "logo" | "favicon", file: File) {
    setUploading(field);
    setError("");
    setSaved(false);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiUpload<{ data: Branding }>(`/admin/branding/${field}`, body);
      setForm((f) => (f ? { ...f, ...res.data } : f));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading("");
      if (field === "logo" && logoInput.current) logoInput.current.value = "";
      if (field === "favicon" && faviconInput.current) faviconInput.current.value = "";
    }
  }

  async function remove(field: "logo" | "favicon") {
    if (!confirm(`Remove the current ${field}?`)) return;
    setUploading(field);
    setError("");
    try {
      const res = await clientApi<{ data: Branding }>(`/admin/branding/${field}`, {
        method: "DELETE",
      });
      setForm((f) => (f ? { ...f, ...res.data } : f));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the file.");
    } finally {
      setUploading("");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await clientApi("/admin/settings", {
        method: "PUT",
        body: {
          site_name: form.site_name,
          site_tagline: form.site_tagline,
          announcement: form.announcement,
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!form)
    return (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> {error || "Loading..."}
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">Branding</h1>
        <p className="mt-1 text-[12px] text-fog">
          Logo, favicon and the store name shown in the header, footer, browser tab and page titles.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
      {saved && (
        <p className="rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">
          Saved — refresh the storefront to see it.
        </p>
      )}

      {/* Logo */}
      <section className="card p-7">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">Logo</p>

        {form.site_logo ? (
          <div className="mt-4 flex flex-wrap items-center gap-5">
            <div className="flex h-24 min-w-[180px] items-center justify-center rounded-xl border border-blush-200 bg-[linear-gradient(45deg,#f2e4d7_25%,transparent_25%),linear-gradient(-45deg,#f2e4d7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f2e4d7_75%),linear-gradient(-45deg,transparent_75%,#f2e4d7_75%)] bg-[length:14px_14px] bg-[position:0_0,0_7px,7px_-7px,-7px_0] px-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.site_logo} alt="Current logo" className="max-h-16 max-w-[220px] object-contain" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="break-all text-[11px] text-fog">{form.site_logo}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => logoInput.current?.click()}
                  disabled={uploading === "logo"}
                  className="flex items-center gap-2 rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
                >
                  {uploading === "logo" && <Spinner className="h-3.5 w-3.5" />} Replace
                </button>
                <button
                  type="button"
                  onClick={() => remove("logo")}
                  disabled={uploading === "logo"}
                  className="rounded-full px-4 py-1.5 text-[12px] text-red-500 hover:bg-red-50 disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => logoInput.current?.click()}
            disabled={uploading === "logo"}
            className="mt-4 flex h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blush-300 bg-blush-50 text-[12.5px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
          >
            {uploading === "logo" ? <Spinner className="h-4 w-4" /> : "+"} Upload a logo
          </button>
        )}

        <input
          ref={logoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload("logo", file);
          }}
        />

        <p className="mt-3 text-[11px] leading-relaxed text-fog">
          PNG or SVG with a transparent background, at least 200×80px. Max 2MB. With no logo
          uploaded, the built-in Lalwani Books International logo is shown.
        </p>
      </section>

      {/* Favicon */}
      <section className="card p-7">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">Favicon</p>

        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-blush-200 bg-blush-50">
            {form.site_favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.site_favicon} alt="Current favicon" className="h-10 w-10 object-contain" />
            ) : (
              <span className="text-[10px] text-fog">none</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {form.site_favicon && (
              <p className="break-all text-[11px] text-fog">{form.site_favicon}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => faviconInput.current?.click()}
                disabled={uploading === "favicon"}
                className="flex items-center gap-2 rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
              >
                {uploading === "favicon" && <Spinner className="h-3.5 w-3.5" />}
                {form.site_favicon ? "Replace" : "Upload favicon"}
              </button>
              {form.site_favicon && (
                <button
                  type="button"
                  onClick={() => remove("favicon")}
                  disabled={uploading === "favicon"}
                  className="rounded-full px-4 py-1.5 text-[12px] text-red-500 hover:bg-red-50 disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={faviconInput}
          type="file"
          accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload("favicon", file);
          }}
        />

        <p className="mt-3 text-[11px] leading-relaxed text-fog">
          32×32 or 64×64 PNG (ICO and WebP also work). Max 512KB. Shown in browser tabs and
          bookmarks.
        </p>
      </section>

      {/* Name, tagline, announcement */}
      <form onSubmit={save} className="flex flex-col gap-5">
        <section className="card grid gap-5 p-7 sm:grid-cols-2">
          <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">
            Name &amp; Copy
          </p>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Store name</label>
            <input
              value={form.site_name}
              onChange={(e) => set("site_name", e.target.value)}
              className="input-base"
              placeholder="Lalwani Books International"
              maxLength={60}
            />
            <p className="mt-1 text-[11px] text-fog">
              Shown next to the logo, and instead of it when no logo is uploaded.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Announcement bar</label>
            <input
              value={form.announcement}
              onChange={(e) => set("announcement", e.target.value)}
              className="input-base"
              placeholder="Free shipping on orders over ₹4,999"
              maxLength={190}
            />
            <p className="mt-1 text-[11px] text-fog">
              Thin strip above the header. Leave blank to hide it.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Tagline</label>
            <textarea
              rows={2}
              value={form.site_tagline}
              onChange={(e) => set("site_tagline", e.target.value)}
              className="input-base resize-y"
              maxLength={190}
              placeholder="Books for every reader — publishing and distribution since day one."
            />
            <p className="mt-1 text-[11px] text-fog">Small line under the brand in the footer.</p>
          </div>
        </section>

        {/* Live lockup preview */}
        <section className="card p-7">
          <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">Preview</p>
          <div className="mt-4 rounded-xl bg-blush-50 p-6">
            {form.announcement && (
              <p className="mb-4 rounded-full bg-maroon-800 px-4 py-1.5 text-center text-[11px] text-white">
                {form.announcement}
              </p>
            )}
            <div className="flex items-center gap-3">
              {form.site_favicon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.site_favicon} alt="" className="h-4 w-4 object-contain" />
              )}
              {form.site_logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.site_logo} alt={form.site_name} className="h-10 w-auto object-contain" />
              ) : (
                <span className="font-serif text-[1.6rem] tracking-wide text-ink">
                  {form.site_name || "Lalwani Books International"}
                </span>
              )}
            </div>
            {form.site_tagline && (
              <p className="mt-2.5 max-w-sm text-[12px] leading-relaxed text-cocoa">
                {form.site_tagline}
              </p>
            )}
          </div>
        </section>

        <div>
          <button
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />} Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
