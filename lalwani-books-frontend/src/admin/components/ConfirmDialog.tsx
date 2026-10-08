"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "./ui";

/**
 * The confirm card used before an action that logs someone out or throws work
 * away. Signing out of the admin panel mid-edit is not something to do on a
 * stray click, and the sidebar button sits directly under "My Profile".
 *
 * Built as a shared component rather than another inline overlay: the returns
 * screen already hand-rolls one, and a second copy would be a second place to
 * forget Escape, the focus move and the dialog roles.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "maroon",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for destructive confirms; `maroon` for ordinary ones. */
  tone?: "maroon" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Whatever was focused when the dialog opened, so closing puts the caret
  // back on the button that opened it rather than at the top of the page.
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    openerRef.current = document.activeElement;
    confirmRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      // Guard the cast: the opener may have unmounted while the dialog was up.
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-maroon-900/50 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="font-serif text-[1.25rem] text-ink">
          {title}
        </h2>
        <div className="mt-2 text-[12.5px] leading-relaxed text-cocoa">{body}</div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer rounded-full border border-blush-200 px-5 py-2 text-[12.5px] text-cocoa hover:bg-blush-100"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex cursor-pointer items-center gap-2 rounded-full px-5 py-2 text-[12.5px] text-white disabled:opacity-60 ${
              tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-maroon-800 hover:bg-maroon-900"
            }`}
          >
            {busy && <Spinner className="h-3.5 w-3.5" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
