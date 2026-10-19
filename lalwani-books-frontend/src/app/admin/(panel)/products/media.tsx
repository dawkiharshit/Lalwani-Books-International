"use client";

import { useState } from "react";
import Image from "next/image";
import { apiUpload, clientApi, ApiError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";

interface GalleryImage {
  id: number;
  url: string;
  alt: string | null;
}

type ProductVideo = { type: "youtube" | "file"; url: string } | null;

interface MediaDetail {
  image: string | null;
  gallery: GalleryImage[];
  video: ProductVideo;
}

/**
 * Product photo manager — real file uploads to the Laravel backend
 * (POST /admin/products/{id}/image and /gallery, multipart).
 */
export function MediaManager({
  productId,
  slug,
  initialImage,
  initialGallery,
  initialVideo,
}: {
  productId: number;
  slug: string;
  initialImage: string | null;
  initialGallery: GalleryImage[];
  initialVideo: ProductVideo;
}) {
  const [image, setImage] = useState<string | null>(initialImage);
  const [gallery, setGallery] = useState<GalleryImage[]>(initialGallery);
  const [video, setVideo] = useState<ProductVideo>(initialVideo);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  function absorb(data: MediaDetail) {
    setImage(data.image);
    setGallery(data.gallery ?? []);
    setVideo(data.video ?? null);
  }

  async function run(label: string, fn: () => Promise<{ data: MediaDetail }>) {
    setBusy(label);
    setError("");
    try {
      const res = await fn();
      absorb(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadThumbnail(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    await run("thumb", () => apiUpload(`/admin/products/${productId}/image`, fd));
  }

  async function uploadGallery(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files)
      .slice(0, 6)
      .forEach((f) => fd.append("files[]", f));
    await run("gallery", () => apiUpload(`/admin/products/${productId}/gallery`, fd));
  }

  async function uploadVideo(file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    await run("video", () => apiUpload(`/admin/products/${productId}/video`, fd));
  }

  return (
    <section className="card p-7">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-[1.15rem] text-ink">Photos</h2>
        <span className="text-[11px] text-fog">JPG / PNG / WebP, up to 4 MB</span>
      </div>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
        {/* Main photo */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-cocoa">Main photo</p>
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-blush-100">
            {image ? (
              <Image src={image} alt="Product photo" fill sizes="220px" className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-fog">
                No photo — the storefront shows a drawn cover
              </div>
            )}
            {busy === "thumb" && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Spinner className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <label className="cursor-pointer rounded-full bg-rose-600 px-4 py-1.5 text-[12px] text-white hover:bg-rose-700">
              {image ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  uploadThumbnail(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {image && image.includes("/storage/") && (
              <button
                type="button"
                onClick={() => run("thumb", () => clientApi(`/admin/products/${productId}/image`, { method: "DELETE" }))}
                className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Gallery */}
        <div>
          <p className="mb-2 text-[11px] font-medium text-cocoa">Gallery ({gallery.length})</p>
          <div className="flex flex-wrap gap-3">
            {gallery.map((g) => (
              <div key={g.id} className="group relative h-24 w-20 overflow-hidden rounded-xl bg-blush-100">
                <Image src={g.url} alt={g.alt ?? ""} fill sizes="80px" className="object-cover" unoptimized />
                <button
                  type="button"
                  aria-label="Delete image"
                  onClick={() =>
                    run("gallery", () => clientApi(`/admin/products/${productId}/gallery/${g.id}`, { method: "DELETE" }))
                  }
                  className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white group-hover:flex"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-blush-200 text-[11px] text-fog hover:bg-blush-100">
              {busy === "gallery" ? <Spinner className="h-4 w-4" /> : <span className="text-lg leading-none">+</span>}
              Add
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  uploadGallery(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="mt-3 text-[11px] text-fog">
            Photos appear on the product page for <span className="font-medium">/{slug}</span> straight away; a
            page already open in a browser shows them after a refresh.
          </p>
        </div>
      </div>

      {/* Video — an uploaded .mp4. A YouTube link is set on the form below. */}
      <div className="mt-6 border-t border-blush-100 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-medium text-cocoa">Product video</p>
          <span className="text-[11px] text-fog">MP4 / WebM, up to 50 MB</span>
        </div>

        {video?.type === "youtube" ? (
          <p className="mb-3 rounded-xl bg-blush-50 px-4 py-2.5 text-[12px] text-cocoa">
            A YouTube link is set in the form below — the book page shows it with a &ldquo;Watch
            video&rdquo; button on the photo. Uploading a file here replaces it.
          </p>
        ) : video?.type === "file" ? (
          <video
            src={video.url}
            controls
            className="mb-3 aspect-video w-full max-w-md rounded-2xl bg-black"
          />
        ) : (
          <p className="mb-3 text-[11.5px] text-fog">
            No video uploaded — or paste a YouTube link in the form below.
          </p>
        )}

        <div className="flex items-center gap-2.5">
          <label className="cursor-pointer rounded-full bg-rose-600 px-4 py-1.5 text-[12px] text-white hover:bg-rose-700">
            {video?.type === "file" ? "Replace video" : "Upload .mp4"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                uploadVideo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {video?.type === "file" && (
            <button
              type="button"
              onClick={() =>
                run("video", () => clientApi(`/admin/products/${productId}/video`, { method: "DELETE" }))
              }
              className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100"
            >
              Remove
            </button>
          )}
          {busy === "video" && <Spinner className="h-4 w-4" />}
        </div>
      </div>
    </section>
  );
}
