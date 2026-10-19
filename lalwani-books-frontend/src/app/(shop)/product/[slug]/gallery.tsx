"use client";

import { useState, type ReactNode } from "react";
import Image from "@/components/Image";
import type { GalleryImage } from "@/lib/types";
import { PlayIcon } from "@/components/icons";
import { youtubeEmbed, youtubeId, youtubeThumb } from "@/lib/youtube";

type Video = { type: "youtube" | "file"; url: string } | null;

/**
 * Product photo viewer — Amazon-style. Thumbnails run down the left (below the
 * picture on a phone). The video, when there is one, is the last thumb: it
 * plays right where the picture is, and a photo thumb brings the photo back.
 * Nothing from YouTube loads until the video thumb is pressed.
 */
export function ProductGallery({
  name,
  image,
  gallery,
  video,
  cover,
}: {
  name: string;
  /** The main photo; without one, `cover` (the drawn cover) stands in. */
  image: string | null;
  gallery: GalleryImage[];
  video?: Video;
  cover?: ReactNode;
}) {
  const shots = [
    ...(image ? [{ id: 0, url: image, alt: `${name} — Lalwani Books International` }] : []),
    ...gallery.filter((g) => g.url !== image),
  ];
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  const ytId = video?.type === "youtube" ? youtubeId(video.url) : null;
  const hasVideo = !!video && (video.type === "file" || !!ytId);
  const showRail = shots.length > 1 || hasVideo;
  const current = shots[active];
  const thumb = "relative h-16 shrink-0 overflow-hidden rounded-lg transition-all";
  const chosen = (on: boolean) => (on ? "ring-2 ring-rose-500" : "opacity-70 hover:opacity-100");

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      {showRail && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
          {shots.map((s, i) => (
            <button
              key={s.url}
              type="button"
              onClick={() => {
                setActive(i);
                setPlaying(false);
              }}
              aria-label={`View photo ${i + 1}`}
              aria-pressed={!playing && i === active}
              className={`${thumb} ${chosen(!playing && i === active)}`}
              style={{ width: 52 }}
            >
              <Image src={s.url} alt="" fill fixed sizes="52px" className="object-cover" />
            </button>
          ))}
          {/* No photo: the drawn cover gets a thumb too, to come back from the video. */}
          {shots.length === 0 && hasVideo && cover && (
            <button
              type="button"
              onClick={() => setPlaying(false)}
              aria-label="View cover"
              aria-pressed={!playing}
              className={`${thumb} ${chosen(!playing)}`}
              style={{ width: 52 }}
            >
              {cover}
            </button>
          )}
          {hasVideo && (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play product video"
              aria-pressed={playing}
              className={`${thumb} bg-ink ${playing ? "ring-2 ring-rose-500" : "ring-1 ring-blush-200 hover:ring-rose-400"}`}
              style={{ width: 52 }}
            >
              {/* YouTube's own preview of the video, so the thumb reads as a video. */}
              {(ytId || image) && (
                <Image src={ytId ? youtubeThumb(ytId) : (image as string)} alt="" fill fixed sizes="52px" className="object-cover" />
              )}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/45">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-rose-600">
                  <PlayIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-white">Video</span>
              </span>
            </button>
          )}
        </div>
      )}

      {/* The picture — or, once its thumb is pressed, the video in its place. */}
      <div className={`relative aspect-[3/4] w-full flex-1 overflow-hidden rounded-[1.25rem] ${playing ? "bg-black" : ""}`}>
        {playing && hasVideo ? (
          ytId ? (
            <iframe
              src={youtubeEmbed(ytId)}
              title={`${name} — video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <video src={video?.url} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />
          )
        ) : current ? (
          <Image
            key={current.url}
            src={current.url}
            alt={current.alt ?? name}
            fill
            priority
            sizes="(max-width: 768px) 92vw, 440px"
            className="object-cover"
          />
        ) : (
          cover
        )}
      </div>
    </div>
  );
}
