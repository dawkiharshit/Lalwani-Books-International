"use client";

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

export default function Image(props: ImageProps) {
  if (isUnsplash(props.src) && !props.unoptimized && !props.loader) {
    return <NextImage {...props} loader={unsplashLoader} />;
  }
  return <NextImage {...props} />;
}
