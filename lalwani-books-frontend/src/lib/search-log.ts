import { API_BASE } from "@/lib/api";

/**
 * How a search ended (the API's SearchLog): on the results page, by choosing
 * a suggestion, or typed and left. "open" is a book opened from the results.
 */
export type SearchEnding = "results" | "pick" | "typed" | "open";

const KEY = "lalwani_searches";
const WINDOW = 30 * 60 * 1000;

/** Marks a key as told in this tab; false when it already was within half an hour. */
function firstTime(key: string): boolean {
  try {
    const now = Date.now();
    const told: Record<string, number> = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    for (const k of Object.keys(told)) if (now - told[k] > WINDOW) delete told[k];
    if (told[key]) return false;
    told[key] = now;
    sessionStorage.setItem(KEY, JSON.stringify(told));
  } catch {
    /* Storage blocked: tell anyway — the server counts a search once in ten minutes. */
  }
  return true;
}

/**
 * Tells admin → Search insights what a shopper searched for: the words and
 * how the search ended — never who searched (no token, no cookies). A search
 * counts once per tab in half an hour, however it ended and however often
 * the page is reloaded; a book opened from it later is still told. Sent so
 * it survives the page changing, and nothing waits for the answer.
 */
export function noteSearch(q: string, via: SearchEnding, book?: string) {
  const words = q.trim().replace(/\s+/g, " ").toLowerCase();
  if (words.length < 2 || typeof window === "undefined") return;

  if (via === "open") {
    if (!book || !firstTime(`b|${words}|${book}`)) return;
  } else if (!firstTime(`s|${words}`)) {
    // Already counted as a search: only a book chosen from it is news.
    if (!book || !firstTime(`b|${words}|${book}`)) return;
    via = "open";
  } else if (book) {
    firstTime(`b|${words}|${book}`);
  }

  const body = new URLSearchParams({ q: words.slice(0, 200), via });
  if (book) body.set("book", book);
  fetch(`${API_BASE}/searches`, { method: "POST", body, keepalive: true, credentials: "omit", mode: "no-cors" }).catch(() => {});
}
