"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
}

/** Roughly how tall the list can get; used to decide whether to drop up. */
const MAX_LIST_HEIGHT = 256;
const GAP = 8;

/**
 * A themed replacement for `<select>`.
 *
 * The native control draws its open list with the operating system, not CSS —
 * that is where the blue highlight came from, and no stylesheet can reach it.
 * The only way to make the list match the shop is to draw it ourselves.
 *
 * The list is rendered into a portal on `document.body` rather than next to the
 * trigger. Inside the admin orders table the trigger sits in a card with
 * `overflow-x-auto`, which clipped an absolutely-positioned list to a single
 * visible row. A native select never had that problem because the OS drew it
 * outside the page; a portal buys back the same freedom.
 *
 * It behaves like the native control where that matters: arrow keys move the
 * highlight, Home/End jump, Enter and Space commit, Escape and an outside click
 * cancel, typing a letter jumps to the next option starting with it, and the
 * trigger keeps focus throughout so the keyboard never gets stranded.
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  buttonClassName = "",
  variant = "pill",
  disabled = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel?: string;
  /** Wrapper classes — use this for width and layout (e.g. "ml-auto w-48"). */
  className?: string;
  /** Overrides the trigger's own look when a caller needs a different shape. */
  buttonClassName?: string;
  /** "pill" for toolbars, "field" to sit level with inputs in a form. */
  variant?: "pill" | "field";
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<React.CSSProperties | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const current = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  /** Pin the list to the trigger in viewport coordinates. */
  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const dropUp = below < MAX_LIST_HEIGHT && r.top > below;

    // Anchor to whichever edge keeps the list on screen. A status dropdown in
    // the last table column would otherwise run off the right.
    const anchorRight = r.left + 240 > window.innerWidth;

    setBox({
      position: "fixed",
      minWidth: r.width,
      maxHeight: Math.min(MAX_LIST_HEIGHT, (dropUp ? r.top : below) - GAP * 2),
      ...(anchorRight
        ? { right: Math.max(GAP, window.innerWidth - r.right) }
        : { left: Math.max(GAP, r.left) }),
      ...(dropUp
        ? { bottom: window.innerHeight - r.top + GAP }
        : { top: r.bottom + GAP }),
    });
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    place();
    setOpen(true);
  }, [disabled, place, selectedIndex]);

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (option) onChange(option.value);
      setOpen(false);
    },
    [onChange, options]
  );

  // Measure before paint so the list never flashes in the wrong place.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Follow the trigger while anything scrolls or the window resizes. Capture
  // phase, because the scroll may be an inner container rather than the page.
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  // Outside click. The list lives in a portal, so it is not inside the trigger's
  // wrapper — both have to be checked or selecting an option would close first.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!trigger.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row in view when the list is longer than its box.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: "nearest",
    });
  }, [open, active]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        // Let focus leave, but do not leave a list hanging open behind it.
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => (i + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i - 1 + options.length) % options.length);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      default: {
        // Type-ahead: "p" then "r" within a second looks for "pr".
        if (e.key.length !== 1) return;
        const now = Date.now();
        typed.current.text = now - typed.current.at > 1000 ? e.key : typed.current.text + e.key;
        typed.current.at = now;
        const q = typed.current.text.toLowerCase();
        const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(q));
        if (hit >= 0) setActive(hit);
      }
    }
  }

  const list =
    open && box ? (
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={`${listId}-${active}`}
        tabIndex={-1}
        style={box}
        className="z-[100] overflow-auto rounded-2xl border border-blush-150 bg-white p-1.5 shadow-lift [animation:shopmenu_.14s_ease-out]"
      >
        {options.map((o, i) => {
          const isSelected = o.value === value;
          return (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={isSelected}
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(i)}
              className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-2 text-[12.5px] transition-colors ${
                i === active ? "bg-blush-100 text-ink" : "text-cocoa"
              } ${isSelected ? "font-medium text-rose-700" : ""}`}
            >
              {o.label}
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={trigger}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={
          buttonClassName ||
          (variant === "field"
            ? `input-base flex cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
                open ? "border-rose-400" : ""
              }`
            : `flex w-full cursor-pointer items-center justify-between gap-2 rounded-full border bg-white px-3.5 py-1.5 text-left text-[12px] text-cocoa outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                open ? "border-rose-400" : "border-blush-200 hover:border-rose-300"
              }`)
        }
      >
        <span className="truncate">{current?.label ?? ""}</span>
        <span
          aria-hidden
          className={`shrink-0 text-[9px] text-rose-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {list && createPortal(list, document.body)}
    </div>
  );
}
