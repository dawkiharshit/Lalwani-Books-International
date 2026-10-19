import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { clientApi } from "@/lib/api";
import type { ProductCard } from "@/lib/types";

/**
 * Books a shopper has opened, newest first — kept in this browser only (like
 * the guest wishlist), for the home page's "Recently Viewed" row and the
 * "Recently Viewed" menu in the header. Only ids are kept; what is shown is
 * asked of the shop, so prices and stock are today's. Changes fire
 * "recently-viewed:change" in this tab; the "storage" event covers other tabs.
 */
const KEY = "lalwani_recently_viewed";
const EVENT = "recently-viewed:change";

/** Enough for a full row; older ones drop off. */
export const RECENT_LIMIT = 12;

/** The stored text itself — stable between calls, so it is a safe useSyncExternalStore snapshot. */
export function recentSnapshot(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseRecent(raw: string): number[] {
  try {
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((x): x is number => Number.isInteger(x) && x > 0).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function write(ids: number[]) {
  try {
    if (ids.length) window.localStorage.setItem(KEY, JSON.stringify(ids));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* Private mode or storage switched off: the row simply stays hidden. */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** A book was opened: it moves to the front. */
export function rememberViewed(id: number) {
  const ids = parseRecent(recentSnapshot()).filter((x) => x !== id);
  write([id, ...ids].slice(0, RECENT_LIMIT));
}

/** Drops books the shop no longer sells, keeping the order. */
export function keepRecent(available: number[]) {
  const ids = parseRecent(recentSnapshot());
  const kept = ids.filter((id) => available.includes(id));
  if (kept.length !== ids.length) write(kept);
}

export function clearRecentlyViewed() {
  write([]);
}

export function subscribeRecentlyViewed(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The ids, newest first — empty on the server and until the page has loaded. */
export function useRecentIds(): number[] {
  const raw = useSyncExternalStore(subscribeRecentlyViewed, recentSnapshot, () => "");
  return useMemo(() => parseRecent(raw), [raw]);
}

/*
 * Books already asked for in this page visit, by id, so the header menu, the
 * phone menu and the home row share one request, and a newly opened book is
 * the only one fetched. Ids the shop no longer returns are remembered as gone.
 */
const known = new Map<number, ProductCard>();
const gone = new Set<number>();
const LOADED = "recently-viewed:loaded";

/**
 * The books, newest first. `null` while some are still being fetched; nothing
 * is fetched until `enabled` (a menu waits until it is opened).
 */
export function useRecentBooks(enabled = true): { ids: number[]; books: ProductCard[] | null } {
  const ids = useRecentIds();
  const missing = ids.filter((id) => !known.has(id) && !gone.has(id));
  const wanted = missing.join(",");
  const [, rerender] = useState(0);

  // Another component's request filling the cache shows here too.
  useEffect(() => {
    const onLoaded = () => rerender((n) => n + 1);
    window.addEventListener(LOADED, onLoaded);
    return () => window.removeEventListener(LOADED, onLoaded);
  }, []);

  useEffect(() => {
    if (!enabled || !wanted) return;
    clientApi<{ data: ProductCard[] }>(`/products?ids=${wanted}&per_page=${RECENT_LIMIT}`, { token: null, cartToken: null })
      .then((res) => {
        res.data.forEach((p) => known.set(p.id, p));
        wanted
          .split(",")
          .map(Number)
          .forEach((id) => {
            if (!known.has(id)) gone.add(id);
          });
        keepRecent(parseRecent(recentSnapshot()).filter((id) => !gone.has(id)));
        window.dispatchEvent(new Event(LOADED));
      })
      .catch(() => {
        /* A nicety: if the shop can't be reached, nothing more shows. */
      });
  }, [enabled, wanted]);

  const books = ids.map((id) => known.get(id)).filter((p): p is ProductCard => Boolean(p));
  return { ids, books: missing.length && enabled ? (books.length ? books : null) : books };
}
