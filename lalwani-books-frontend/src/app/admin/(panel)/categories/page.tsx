"use client";

import { useSyncExternalStore } from "react";
import { CategoriesPanel } from "./categories-panel";
import { AuthorsPanel } from "./authors-panel";
import { PublishersPanel } from "./publishers-panel";

type Tab = "categories" | "authors" | "publications";

const TAB_EVENT = "lalwani-admin-tab";

/** The open tab lives in the address (?tab=authors, ?tab=publications), so links can open it directly. */
function readTab(): Tab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "authors" || tab === "publications" ? tab : "categories";
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(TAB_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(TAB_EVENT, onChange);
  };
}

/**
 * Categories, authors and publications on one screen: all three are things a
 * book is filed under, and each has to exist before a book can be given it.
 * The switch at the top picks which list is shown.
 */
export default function AdminCategoriesAndAuthors() {
  // Read through useSyncExternalStore so the server render (categories) and
  // the first client render agree, then the address wins.
  const tab = useSyncExternalStore(subscribe, readTab, () => "categories" as Tab);

  function pick(next: Tab) {
    const url = new URL(window.location.href);
    if (next !== "categories") url.searchParams.set("tab", next);
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url.toString());
    window.dispatchEvent(new Event(TAB_EVENT));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex w-fit rounded-full bg-blush-150 p-1" role="tablist" aria-label="Add a category, an author or a publisher">
        {(
          [
            ["categories", "Categories"],
            ["authors", "Authors"],
            ["publications", "Publications"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => pick(key)}
            className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-colors ${
              tab === key ? "bg-white text-ink shadow-soft" : "text-fog hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "categories" ? <CategoriesPanel /> : tab === "authors" ? <AuthorsPanel /> : <PublishersPanel />}
    </div>
  );
}
