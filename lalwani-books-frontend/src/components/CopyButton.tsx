"use client";

import { useState } from "react";
import { CheckIcon } from "./icons";

/** A small "Copy" button for a short value (an ISBN): it says "Copied" for a moment. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // No clipboard access (an older browser, a page not on https, or a
      // window without focus): copy through a hidden text box instead.
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      box.remove();
    }
    if (!ok) return; // the value is still on screen to select by hand
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={label}
      className="inline-flex h-6 items-center gap-1 rounded-full border border-blush-200 px-2 text-[11px] font-medium text-rose-600 transition-colors hover:border-rose-600 hover:bg-rose-600 hover:text-white"
    >
      {copied ? (
        <>
          <CheckIcon className="h-3 w-3" strokeWidth={2.6} /> Copied
        </>
      ) : (
        "Copy"
      )}
    </button>
  );
}
