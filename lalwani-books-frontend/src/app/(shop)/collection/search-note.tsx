"use client";

import { useEffect } from "react";
import { noteSearch } from "@/lib/search-log";

/**
 * On a search's results page: tells admin → Search insights about the search,
 * and about each book opened from its results (the grid marked
 * data-search-results). Renders nothing.
 */
export function SearchNote({ q }: { q: string }) {
  useEffect(() => {
    noteSearch(q, "results");

    function opened(e: MouseEvent) {
      const link = (e.target as Element | null)?.closest?.("[data-search-results] a[href^='/product/']");
      let slug = link?.getAttribute("href")?.slice("/product/".length).split(/[?#/]/)[0] ?? "";
      try {
        slug = decodeURIComponent(slug);
      } catch {
        /* keep it as written */
      }
      if (slug) noteSearch(q, "open", slug);
    }
    // auxclick: a middle click opens the book in a new tab.
    document.addEventListener("click", opened, true);
    document.addEventListener("auxclick", opened, true);
    return () => {
      document.removeEventListener("click", opened, true);
      document.removeEventListener("auxclick", opened, true);
    };
  }, [q]);

  return null;
}
