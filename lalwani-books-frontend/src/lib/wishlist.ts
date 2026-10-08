import { useSyncExternalStore } from "react";

/**
 * Guest wishlist — kept in the browser, no account needed.
 *
 * Product ids live in localStorage so a shopper can save products without
 * signing in. Every change fires a "wishlist:change" event so the heart buttons
 * and the wishlist page stay in sync within the tab; the native "storage" event
 * keeps other tabs in step.
 */
const KEY = "lalwani_wishlist";

function read(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function write(ids: number[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* private mode / storage disabled — the heart just won't persist */
  }
  // storage events don't fire in the tab that made the change, so announce it.
  window.dispatchEvent(new Event("wishlist:change"));
}

export function getWishlist(): number[] {
  return read();
}

export function isWishlisted(id: number): boolean {
  return read().includes(id);
}

/** Add or remove; returns the new state (true = now saved). */
export function toggleWishlist(id: number): boolean {
  const ids = read();
  const i = ids.indexOf(id);
  if (i >= 0) {
    ids.splice(i, 1);
    write(ids);
    return false;
  }
  ids.push(id);
  write(ids);
  return true;
}

/** Run `cb` whenever the wishlist changes, in this tab or another. */
export function subscribeWishlist(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("wishlist:change", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("wishlist:change", cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * How many products are saved, kept live — for the header's heart badge.
 * Reads 0 on the server and during hydration (localStorage isn't there yet),
 * then the real count, so the markup never mismatches.
 */
export function useWishlistCount(): number {
  return useSyncExternalStore(subscribeWishlist, () => read().length, () => 0);
}
