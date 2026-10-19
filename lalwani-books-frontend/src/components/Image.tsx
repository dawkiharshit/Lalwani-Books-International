"use client";

import { useState, type ReactNode } from "react";
import NextImage, { type ImageLoader, type ImageProps } from "next/image";

/**
 * next/image, but Unsplash photos are resized by Unsplash's own CDN instead
 * of by our Node server.
 *
 * Every image on the storefront went through /_next/image: the Hostinger
 * Node process downloaded each photo and re-encoded it once per width with
 * sharp, on shared CPU, before a visitor could see it — and that cache is
 * thrown away on every redeploy. Unsplash already serves any size and format
 * from its edge via URL parameters, so for those photos the round trip
 * through our server bought nothing. Uploaded photos (/storage/…) and the
 * bundled ones in /public still use the built-in optimizer.
 *
 * A global `loaderFile` can't do this: setting one turns /_next/image off
 * entirely, and the uploads need it. And a loader is a function, which a
 * Server Component can't pass to next/image, so it lives in this client
 * wrapper and callers keep passing plain props.
 */
const unsplashLoader: ImageLoader = ({ src, width, quality }) => {
  const url = new URL(src);
  const p = url.searchParams;
  // Keep a fixed-ratio crop when the URL asks for one: scale its height with
  // the new width rather than squashing the photo.
  const oldW = Number(p.get("w"));
  const oldH = Number(p.get("h"));
  if (oldW > 0 && oldH > 0) p.set("h", String(Math.round((oldH * width) / oldW)));
  p.set("w", String(width));
  p.set("q", String(quality ?? 75));
  // WebP/AVIF for browsers that take it, chosen at Unsplash's edge.
  p.set("auto", "format");
  return url.toString();
};

function isUnsplash(src: ImageProps["src"]): boolean {
  return typeof src === "string" && src.startsWith("https://images.unsplash.com/");
}

/**
 * A fill picture drawn at the one size its `sizes` names ("48px"), as a fixed
 * width instead. next/image lists all nine widths in a fill picture's srcset —
 * some 900 bytes of HTML each, and the home page has over a hundred such
 * pictures — where a fixed size needs one file per screen density: given as a
 * width it lists two (1x and 2x). The style keeps it filling its frame.
 */
function asFixed(props: ImageProps): ImageProps {
  const px = typeof props.sizes === "string" ? Number(/^\s*(\d+)px\s*$/.exec(props.sizes)?.[1]) : NaN;
  if (!props.fill || !px) return props;
  const fixed: ImageProps = {
    ...props,
    width: px,
    height: px,
    style: { position: "absolute", inset: 0, width: "100%", height: "100%", ...props.style },
  };
  delete fixed.fill;
  delete fixed.sizes;
  return fixed;
}

/**
 * `fallback` is drawn instead when the picture can't be loaded — say an
 * uploaded photo whose file is gone from the server — so the page shows, for
 * instance, an author's initials rather than a broken-image icon.
 *
 * `fixed`, for small pictures of one size (avatars, author circles): see asFixed.
 */
export default function Image({
  fallback,
  fixed = false,
  ...props
}: ImageProps & { fallback?: ReactNode; fixed?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<ImageProps["src"] | null>(null);
  if (fallback !== undefined && failedSrc === props.src) return <>{fallback}</>;

  const onError: ImageProps["onError"] =
    fallback === undefined
      ? props.onError
      : (e) => {
          setFailedSrc(props.src);
          props.onError?.(e);
        };
  const shaped = fixed ? asFixed(props) : props;
  if (isUnsplash(props.src) && !props.unoptimized && !props.loader) {
    return <NextImage {...shaped} onError={onError} loader={unsplashLoader} />;
  }
  return <NextImage {...shaped} onError={onError} />;
}
