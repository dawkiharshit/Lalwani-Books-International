"use client";

import Link from "next/link";
import { useState } from "react";

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

/**
 * The footer link columns, in parchment on the green footer.
 *
 * On a phone the footer is the longest thing on the page, so each column
 * collapses to its title and opens on tap. From `sm` up there is room for all
 * three side by side: the toggles step out of the way, and each title gets a
 * short mustard rule beneath it.
 */
export function FooterColumns({ columns }: { columns: FooterColumn[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="grid gap-x-6 divide-y divide-parchment/10 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-7 sm:divide-y-0">
      {columns.map((col) => {
        const isOpen = open === col.title;

        return (
          <nav key={col.title} aria-label={col.title} className="py-1 sm:py-0">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : col.title)}
              aria-expanded={isOpen}
              /* From sm up the title is a heading again, not a control. */
              className="flex w-full items-center justify-between py-3 text-left text-[15px] font-semibold text-parchment sm:pointer-events-none sm:mb-7 sm:py-0"
            >
              <span className="relative">
                {col.title}
                <span aria-hidden className="absolute -bottom-2.5 left-0 hidden h-[3px] w-7 rounded-full bg-mustard sm:block" />
              </span>
              <span
                aria-hidden
                className={`text-[10px] text-parchment/60 transition-transform duration-200 sm:hidden ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>

            <ul className={`space-y-3 pb-4 sm:block sm:pb-0 ${isOpen ? "block" : "hidden"}`}>
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="inline-block text-[13px] text-parchment/70 transition-[color,translate] duration-200 hover:translate-x-1 hover:text-rose-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        );
      })}
    </div>
  );
}
