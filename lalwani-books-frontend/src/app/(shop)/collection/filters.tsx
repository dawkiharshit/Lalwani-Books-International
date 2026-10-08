"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function Pagination({
  meta,
}: {
  meta: { current_page: number; last_page: number; total: number };
}) {
  const params = useSearchParams();
  const pathname = usePathname();

  if (meta.last_page <= 1) return null;

  const pageLink = (page: number) => {
    const next = new URLSearchParams(params.toString());
    if (page <= 1) next.delete("page");
    else next.set("page", String(page));
    const s = next.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const current = meta.current_page;
  const pages = Array.from({ length: meta.last_page }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-2 pt-1" aria-label="Pagination">
      {current > 1 && (
        <Link
          href={pageLink(current - 1)}
          rel="prev"
          className="flex h-9 items-center rounded-full bg-white px-4 text-[12.5px] text-cocoa shadow-soft transition-colors hover:bg-blush-100"
        >
          &larr; Prev
        </Link>
      )}
      {pages.map((page) => (
        <Link
          key={page}
          href={pageLink(page)}
          aria-current={page === current ? "page" : undefined}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] transition-colors ${
            page === current
              ? "bg-maroon-800 text-white shadow-soft"
              : "bg-white text-cocoa shadow-soft hover:bg-blush-100"
          }`}
        >
          {page}
        </Link>
      ))}
      {current < meta.last_page && (
        <Link
          href={pageLink(current + 1)}
          rel="next"
          className="flex h-9 items-center rounded-full bg-white px-4 text-[12.5px] text-cocoa shadow-soft transition-colors hover:bg-blush-100"
        >
          Next &rarr;
        </Link>
      )}
    </nav>
  );
}
