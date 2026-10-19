"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MicIcon } from "@/components/icons";

// The recorder is fetched only when it is about to be used (pointed at,
// tabbed to or tapped), so no page carries it.
const loadPanel = () => import("./VoiceQueryPanel");
const VoiceQueryPanel = dynamic(loadPanel, { ssr: false });

/**
 * The round mic button on every shop page, at the bottom right just above the
 * WhatsApp button — the same size, centred on it, the same 12px apart as
 * WhatsApp is from the scroll arrow below it. It opens "Ask us by voice"
 * (VoiceQueryPanel); what customers record is played back in admin → Voice
 * Queries.
 */
export function VoiceQueryButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
        aria-label="Ask us by voice"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="float-pop float-ping [--ping-delay:1.2s] group fixed bottom-[8.5rem] right-2.5 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_10px_24px_-8px_rgba(4,43,82,0.5)] transition-[background-color,scale] duration-200 hover:scale-105 hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:bottom-[9.25rem] sm:right-[18px] sm:h-14 sm:w-14 print:hidden"
      >
        {/* What it does, beside it — on a computer when pointed at or tabbed to. */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-full mr-3 hidden translate-x-1 whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-ink opacity-0 shadow-lift ring-1 ring-blush-200 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block"
        >
          Ask us by voice
        </span>
        <MicIcon className="h-6 w-6 sm:h-[26px] sm:w-[26px]" strokeWidth={1.9} />
      </button>
      {open && <VoiceQueryPanel onClose={() => setOpen(false)} />}
    </>
  );
}
