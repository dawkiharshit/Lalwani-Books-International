"use client";

import { useEffect, useState } from "react";
import { clientApi } from "@/lib/api";
import type { ProductCard } from "@/lib/types";

/** What /search/suggest returns: a few best matches of each kind. */
export interface SuggestResult {
  query: string;
  books: ProductCard[];
  authors: { name: string; slug: string; photo: string | null; books: number }[];
  categories: { name: string; slug: string; books: number }[];
  isbn: { isbn: string; name: string; slug: string; author: string | null }[];
}

/** Suggestions start at two characters. */
export const MIN_QUERY = 2;
const DELAY = 200;

/** Recent answers, so going back over what was just typed shows results at once. */
const memo = new Map<string, SuggestResult>();
function remember(q: string, r: SuggestResult) {
  memo.set(q, r);
  if (memo.size > 40) memo.delete(memo.keys().next().value as string);
}

/**
 * Live suggestions for a search box: waits for a short pause in typing, then
 * asks once (an earlier, slower answer can never overwrite a newer one).
 */
export function useSearchSuggest(query: string) {
  const q = query.trim().toLowerCase();
  const [found, setFound] = useState<SuggestResult | null>(null);

  useEffect(() => {
    if (q.length < MIN_QUERY || memo.has(q)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      clientApi<{ data: SuggestResult }>(`/search/suggest?q=${encodeURIComponent(q)}`, {
        token: null,
        cartToken: null,
        signal: controller.signal,
      })
        .then((res) => {
          remember(q, res.data);
          setFound({ ...res.data, query: q });
        })
        .catch(() => {});
    }, DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const results = q.length < MIN_QUERY ? null : (memo.get(q) ?? (found?.query === q ? found : null));
  return { results, searching: q.length >= MIN_QUERY && !results };
}

/** True when there is at least one suggestion to show. */
export function hasSuggestions(r: SuggestResult | null): r is SuggestResult {
  return Boolean(r && (r.books.length || r.authors.length || r.categories.length || r.isbn.length));
}
