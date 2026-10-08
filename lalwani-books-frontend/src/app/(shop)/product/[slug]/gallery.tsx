"use client";

import { useEffect, useState } from "react";
import Image from "@/components/Image";
import type { GalleryImage } from "@/lib/types";
import { PlayIcon, CloseIcon } from "@/components/icons";
import { overlayCloseButton } from "@/components/ui";

type Video = { type: "youtube" | "file"; url: string } | null;

/**
 * Product photo viewer — Amazon-style. Thumbnails run down the left (below the
 * image on a phone); the video, when there is one, sits among them as a thumb
 * with a play badge and opens in an overlay on top of the product.
 */
export function ProductGallery({
  name,
  image,
  gallery,
  video,
}: {
  name: string;
  image: string;
  gallery: GalleryImage[];
  video?: Video;
}) {
  const shots = [
    { id: 0, url: image, alt: `${name} — Lalwani Books International` },
    ...gallery.filter((g) => g.url !== image),
  ];
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ytId = video?.type === "youtube" ? youtubeId(video.url) : null;
  const hasVideo = !!video && (video.type === "file" || !!ytId);
  const portrait = video?.type === "youtube" && /\/shorts\//.test(video.url);

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  const showRail = shots.length > 1 || hasVideo;

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {showRail && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
          {hasVideo && (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play product video"
              className="relative h-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-blush-200 transition-all hover:ring-rose-400"
              style={{ width: 52 }}
            >
              <Image src={image} alt="" fill sizes="52px" className="object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-ink/35">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-rose-600">
                  <PlayIcon className="h-3 w-3" />
                </span>
              </span>
            </button>
          )}
          {shots.map((s, i) => (
            <button
              key={s.url}
              onClick={() => setActive(i)}
              aria-label={`View photo ${i + 1}`}
              className={`relative h-16 shrink-0 overflow-hidden rounded-lg transition-all ${
                i === active ? "ring-2 ring-rose-500" : "opacity-70 hover:opacity-100"
              }`}
              style={{ width: 52 }}
            >
              <Image src={s.url} alt="" fill sizes="52px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="relative aspect-[3/4] w-full flex-1 overflow-hidden rounded-[1.25rem]">
        <Image
          key={shots[active]?.url}
          src={shots[active]?.url ?? image}
          alt={shots[active]?.alt ?? name}
          fill
          priority
          sizes="(max-width: 768px) 92vw, 440px"
          className="object-cover"
        />
      </div>

      {playing && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPlaying(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-sm"
        >
          {/* The close button is a flex row above the frame rather than an
              absolutely-placed one hanging off its top edge: on a short or
              landscape viewport the old -top-11 put it above the fold, with
              nothing to dismiss the video but Escape. */}
          <div
            className="flex max-h-full max-w-full flex-col items-end gap-2.5 [animation:shopmenu_.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPlaying(false)}
              aria-label="Close video"
              className={overlayCloseButton}
            >
              <CloseIcon className="h-[18px] w-[18px]" />
            </button>

            {ytId ? (
              <div
                /* Width carries the height cap (16/9 x 78dvh = 138dvh,
                   9/16 x 78dvh = 43dvh) so the frame keeps its exact ratio
                   instead of being squashed by a max-height. */
                className={`relative min-h-0 overflow-hidden rounded-2xl bg-black shadow-lift ${
                  portrait
                    ? "aspect-[9/16] w-[min(340px,82vw,43dvh)]"
                    : "aspect-video w-[min(760px,92vw,138dvh)]"
                }`}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                  title="Product video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            ) : (
              video && (
                <video
                  src={video.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[78dvh] w-auto max-w-full rounded-2xl bg-black shadow-lift"
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Pull the 11-character id out of any common YouTube URL shape. */
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/
  );
  return m ? m[1] : null;
}
