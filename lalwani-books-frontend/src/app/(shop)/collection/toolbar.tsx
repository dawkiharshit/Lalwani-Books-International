"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Category } from "@/lib/types";
import { FilterSidebar, type FilterOption } from "./filter-sidebar";

/**
 * On a phone, the button above the grid that opens the Filters card —
 * sorting, category, author, publication and price — as a sheet. On a wide
 * screen the card sits beside the grid, so there is nothing to show here.
 * (No result count: the owner asked for it to be hidden.)
 */
export function CollectionToolbar({
  categories,
  authors,
  publishers,
  priceFloor,
  priceCeil,
  defaultSort,
}: {
  categories: Category[];
  authors: FilterOption[];
  publishers: FilterOption[];
  priceFloor: number;
  priceCeil: number;
  defaultSort?: string;
}) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // While the sheet is open: lock the page behind it, close it on Escape, and
  // close it if the window widens to the size where the card sits beside the grid.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const activeCount = [
    params.get("category"),
    params.get("author"),
    params.get("publisher"),
    params.get("search"),
    params.get("min_price") || params.get("max_price"),
  ].filter(Boolean).length;

  return (
    <>
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-full bg-maroon-800 px-4 py-2 text-[12.5px] text-white"
        >
          Filters &amp; sort
          {activeCount > 0 && (
            <span className="rounded-full bg-white/25 px-1.5 text-[10px]">{activeCount}</span>
          )}
        </button>
      </div>

      {/*
        Phone: the same card as a sheet slid in from the left, with a × to close
        it. Rendered into <body>: the page's fade-in wrapper is a stacking
        context, and inside it the sheet sat under the sticky header, which hid
        the top of the card.
      */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex bg-maroon-900/50 backdrop-blur-sm lg:hidden" onClick={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              className="filter-sheet h-full w-[86%] max-w-sm bg-white shadow-lift"
              onClick={(e) => e.stopPropagation()}
            >
              <FilterSidebar
                categories={categories}
                authors={authors}
                publishers={publishers}
                priceFloor={priceFloor}
                priceCeil={priceCeil}
                defaultSort={defaultSort}
                onApply={close}
                onClose={close}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
