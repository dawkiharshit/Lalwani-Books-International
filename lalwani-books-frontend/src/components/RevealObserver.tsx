"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal], [data-reveal-stagger]";

/**
 * Inline script for <head>: hides reveal targets before first paint, so they
 * fade in rather than flashing visible → hidden → visible. Skipped under
 * reduced motion. If the observer below never starts (a script error, a
 * blocked bundle), the fallback timer shows everything after 3 seconds.
 */
export const REVEAL_BOOT = `(function(){try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;var d=document.documentElement;d.classList.add("reveal-ready");setTimeout(function(){if(!window.__revealOn)d.classList.remove("reveal-ready")},3000)}catch(e){}})();`;

/**
 * Adds `is-visible` to each `data-reveal` / `data-reveal-stagger` element as
 * it scrolls into view (see globals.css). Watches the DOM too, so content
 * that arrives on a client-side navigation is picked up without a reload.
 */
export function RevealObserver() {
  useEffect(() => {
    (window as unknown as { __revealOn?: boolean }).__revealOn = true;
    const root = document.documentElement;
    if (!root.classList.contains("reveal-ready")) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    const watch = (scope: ParentNode) =>
      scope.querySelectorAll(SELECTOR).forEach((el) => {
        if (!el.classList.contains("is-visible")) io.observe(el);
      });
    watch(document);

    /*
     * Belt and braces: a plain position check on scroll and resize. The
     * observer is the main mechanism, but browsers pause it in background
     * tabs and some embedded views, and content must never stay invisible.
     * Anything at or above the bottom of the viewport is shown.
     */
    let pending: ReturnType<typeof setTimeout> | null = null;
    const sweep = () => {
      pending = null;
      const limit = window.innerHeight * 0.95;
      document.querySelectorAll(SELECTOR).forEach((el) => {
        if (!el.classList.contains("is-visible") && el.getBoundingClientRect().top < limit) {
          el.classList.add("is-visible");
          io.unobserve(el);
        }
      });
    };
    const schedule = () => {
      pending ??= setTimeout(sweep, 120);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();

    const mo = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches(SELECTOR)) io.observe(n);
          watch(n);
        });
      }
      schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (pending) clearTimeout(pending);
    };
  }, []);

  return null;
}
