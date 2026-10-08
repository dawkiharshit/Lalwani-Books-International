"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { clientApi, apiUpload, ApiError } from "@/admin/lib/api";
import { OfferBadge, Spinner } from "@/admin/components/ui";

interface Banner {
  id: number;
  image: string | null;
  title: string | null;
  subtitle: string | null;
  badge_text: string | null;
  description: string | null;
  button_text: string | null;
  button_url: string | null;
  is_active: boolean;
  show_text: boolean;
  sort_order: number;
}

/** List only — creating and editing happen on their own pages. */
export default function AdminBanners() {
  const [rows, setRows] = useState<Banner[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    clientApi<{ data: Banner[] }>("/admin/banners")
      .then((res) => {
        setRows(res.data);
        setError("");
      })
      .catch((err) => {
        /*
         * Say the load failed rather than rendering an empty list — otherwise a
         * server error is indistinguishable from having no banners.
         */
        setRows([]);
        setError(
          err instanceof ApiError
            ? `Could not load banners: ${err.message}`
            : "Could not load banners. Check that the API is running."
        );
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(b: Banner) {
    setError("");
    try {
      const fd = new FormData();
      fd.append("is_active", b.is_active ? "0" : "1");
      await apiUpload(`/admin/banners/${b.id}`, fd);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change the status.");
    }
  }

  async function remove(b: Banner) {
    if (!confirm("Delete this banner?")) return;
    setError("");
    try {
      await clientApi(`/admin/banners/${b.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  const live = rows?.filter((b) => b.is_active).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[1.6rem] text-ink">Hero Banners</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-fog">
            Two or more live banners turn the home hero into an auto-playing slider. No banners at all =
            the built-in default hero. Any field you leave blank simply is not shown on that slide.
          </p>
        </div>
        <Link
          href="/admin/banners/new"
          className="shrink-0 rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700"
        >
          + Add Banner
        </Link>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      {rows && rows.length > 0 && (
        <p className="text-[11.5px] text-fog">
          {live === 0
            ? "Nothing live — the storefront is showing the default hero."
            : live === 1
              ? "1 banner live — shown as a static hero."
              : `${live} banners live — the hero auto-plays as a slider.`}
        </p>
      )}

      {!rows ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : rows.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-[13px] text-fog">
            No banners yet — the storefront is showing the default hero.
          </p>
          <Link
            href="/admin/banners/new"
            className="mt-5 inline-block rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white hover:bg-rose-700"
          >
            Add the first banner
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((b) => (
            <article key={b.id} className="card flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-blush-100">
                {b.image ? (
                  <Image src={b.image} alt="" fill sizes="128px" className="object-cover" unoptimized />
                ) : (
                  <span className="flex h-full items-center justify-center text-[10px] text-fog">
                    No image
                  </span>
                )}
              </div>

              <div className="min-w-40 flex-1">
                {b.title || b.subtitle ? (
                  <p className="text-[13.5px] font-semibold text-ink">
                    {b.title} <span className="text-rose-600">{b.subtitle}</span>
                  </p>
                ) : (
                  <p className="text-[13px] italic text-fog">
                    No text — this slide shows the photo only
                  </p>
                )}
                {b.badge_text && (
                  <p className="mt-1.5">
                    <OfferBadge size="sm">{b.badge_text}</OfferBadge>
                  </p>
                )}
                {b.description && (
                  <p className="mt-0.5 line-clamp-1 text-[12px] text-cocoa">{b.description}</p>
                )}
                {b.button_text && (
                  <p className="mt-0.5 text-[11px] text-fog">
                    Button: {b.button_text} &rarr; {b.button_url}
                  </p>
                )}
              </div>

              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  b.is_active ? "bg-green-100 text-green-700" : "bg-blush-100 text-fog"
                }`}
              >
                {b.is_active ? "Live" : "Off"}
              </span>
              {b.show_text === false && (
                <span className="rounded-full bg-blush-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fog">
                  Image only
                </span>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/banners/${b.id}/edit`}
                  className="rounded-full bg-maroon-800 px-4 py-1 text-[12px] text-white hover:bg-maroon-900"
                >
                  Edit
                </Link>
                <button
                  onClick={() => toggle(b)}
                  className="rounded-full border border-blush-200 px-3.5 py-1 text-[12px] text-cocoa hover:bg-blush-100"
                >
                  {b.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => remove(b)}
                  className="rounded-full px-3 py-1 text-[12px] text-red-500 hover:bg-red-50"
                >
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
