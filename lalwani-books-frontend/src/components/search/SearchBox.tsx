"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigation } from "@/lib/loading-bus";
import { useSearchSuggest } from "@/lib/search";
import { SearchCombobox, type PopularLink } from "./SearchCombobox";

/** A self-contained search box (the home page's big one): its own text, suggestions and search. */
export function SearchBox({ popular = [], variant = "hero" }: { popular?: PopularLink[]; variant?: "pill" | "hero" }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { results, searching } = useSearchSuggest(query);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const href = q ? `/collection?search=${encodeURIComponent(q)}` : "/collection";
    startNavigation(href);
    router.push(href);
  }

  return (
    <SearchCombobox
      value={query}
      onChange={setQuery}
      onSubmit={submit}
      onPick={() => setQuery("")}
      results={results}
      searching={searching}
      popular={popular}
      variant={variant}
    />
  );
}
