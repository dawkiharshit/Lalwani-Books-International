"use client";

import { useEffect, useState } from "react";
import { PlayIcon, CloseIcon } from "./icons";
import { overlayCloseButton } from "./ui";

/**
 * A small "Watch video" badge that sits on the product image (Amazon-style).
 * Tapping it plays the video in an overlay on top of the product — a YouTube
 * embed or an uploaded .mp4, sized to its shape. Renders nothing without a
 * video.
 */
export function ProductVideoButton({
  video,
}: {
  video?: { type: "youtube" | "file"; url: string } | null;
}) {
  const [open, setOpen] = useState(false);

  const ytId = video?.type === "youtube" ? youtubeId(video.url) : null;
  const valid = !!video && (video.type === "file" || !!ytId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!valid || !video) return null;

  // Vertical Shorts get a tall frame; everything else 16:9.
  const portrait = video.type === "youtube" && /\/shorts\//.test(video.url);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Play product video"
        className="group absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full bg-white/90 py-1.5 pl-1.5 pr-3.5 text-[11.5px] font-semibold text-ink shadow-lift backdrop-blur transition-transform hover:scale-[1.04]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-white transition-transform group-hover:scale-110">
          <PlayIcon className="h-3.5 w-3.5" />
        </span>
        Watch video
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
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
              onClick={() => setOpen(false)}
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
              <video
                src={video.url}
                controls
                autoPlay
                playsInline
                className="max-h-[78dvh] w-auto max-w-full rounded-2xl bg-black shadow-lift"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Pull the 11-character id out of any common YouTube URL shape. */
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/
  );
  return m ? m[1] : null;
}
