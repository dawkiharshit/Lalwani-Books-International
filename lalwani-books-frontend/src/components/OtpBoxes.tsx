"use client";

import { useRef } from "react";

export const OTP_LENGTH = 6;

/**
 * The six boxes a one-time code is typed into, as on the email-confirmation
 * and password-reset pages: a pasted (or phone-autofilled) code fills the row
 * from wherever it lands, Backspace and the arrow keys move between boxes, and
 * the full code is handed to `onComplete` as soon as the last digit is in.
 */
export function OtpBoxes({
  digits,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  autoFocus = false,
  boxRef,
}: {
  digits: string[];
  onChange: (digits: string[]) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** Draws the boxes in the error colour (a wrong code). */
  invalid?: boolean;
  autoFocus?: boolean;
  /** Receives the first box, so the page can put focus back on it. */
  boxRef?: (el: HTMLInputElement | null) => void;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  function put(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      onChange(digits.map((d, i) => (i === index ? "" : d)));
      return;
    }
    const next = [...digits];
    for (let i = 0; i < clean.length && index + i < OTP_LENGTH; i++) next[index + i] = clean[i];
    onChange(next);
    boxes.current[Math.min(index + clean.length, OTP_LENGTH - 1)]?.focus();
    if (next.every(Boolean)) onComplete?.(next.join(""));
  }

  function onKey(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  return (
    <div role="group" aria-label={`${OTP_LENGTH}-digit code`} className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
            if (i === 0) boxRef?.(el);
          }}
          value={d}
          onChange={(e) => put(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={OTP_LENGTH}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          autoFocus={autoFocus && i === 0}
          className={`h-[3.25rem] w-11 rounded-xl border bg-white text-center font-serif text-[1.4rem] text-ink outline-none transition-colors disabled:opacity-60 sm:h-14 sm:w-12 ${
            invalid ? "border-red-300 focus:border-red-400" : "border-blush-200 focus:border-rose-400"
          }`}
        />
      ))}
    </div>
  );
}
