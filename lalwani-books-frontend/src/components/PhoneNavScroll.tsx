"use client";

import { useEffect } from "react";

/** Below the desktop breakpoint — the same query as Tailwind's `max-lg:`. */
const PHONE = "(width < 64rem)";

/**
 * On phones and tablets, a page change opens the new page at its very top.
 *
 * The site scrolls smoothly (`scroll-behavior: smooth` on <html>, globals.css)
 * and since Next.js 16 the router no longer switches that off while it jumps
 * to the top of a new page — unless <html> carries data-scroll-behavior="smooth".
 * Without it the jump became a slow glide, which the router then redirected to
 * the page's first element: that lands under the sticky phone header, so a
 * page opened part of the way down. With the attribute the router jumps to the
 * top at once. In-page smooth scrolling (back-to-top, anchors) is unchanged.
 * (The other half: html's scroll-padding-top, kept at the header's height by
 * Header.tsx, so the router also sees content hidden under the header.)
 *
 * Set only below desktop width — the owner asked for the fix in the mobile
 * view only. Runs after hydration, which is before any in-app navigation.
 */
export function PhoneNavScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const phone = window.matchMedia(PHONE);
    const sync = () => {
      if (phone.matches) html.dataset.scrollBehavior = "smooth";
      else delete html.dataset.scrollBehavior;
    };
    sync();
    phone.addEventListener("change", sync);
    return () => {
      phone.removeEventListener("change", sync);
      delete html.dataset.scrollBehavior;
    };
  }, []);

  return null;
}
