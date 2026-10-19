import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "./icons";

/**
 * One mobile-drawer row: icon, then label, on a single baseline.
 *
 * A rounded pill rather than bare text, to match how the rest of the site
 * treats anything tappable. The padding is also what gives the row a real
 * touch target — as plain text the hit area was only the glyph height.
 */
export const drawerLink =
  "flex items-center gap-3 rounded-full px-3 py-3 transition-colors hover:bg-blush-100 hover:text-ink";
export const drawerIcon = "h-[17px] w-[17px] shrink-0 text-fog";
/** The row for the page you are already on. */
export const drawerLinkActive = "bg-blush-100 font-medium text-maroon-800";

type PillVariant = "rose" | "white" | "outline-light" | "blush" | "maroon";

const pillStyles: Record<PillVariant, string> = {
  rose: "bg-rose-600 text-white hover:bg-rose-700",
  white: "bg-white text-maroon-800 hover:bg-blush-100",
  "outline-light": "border border-white/40 text-white hover:bg-white/10",
  blush: "bg-blush-100 text-ink hover:bg-blush-150",
  maroon: "bg-maroon-800 text-white hover:bg-maroon-900",
};

const arrowStyles: Record<PillVariant, string> = {
  rose: "bg-white/20 text-white",
  white: "bg-maroon-800 text-white",
  "outline-light": "bg-white/15 text-white",
  blush: "bg-white text-ink",
  maroon: "bg-white/20 text-white",
};

interface PillProps {
  variant?: PillVariant;
  arrow?: boolean;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

function pillClass(variant: PillVariant, size: "sm" | "md", className: string) {
  const sizing =
    size === "sm" ? "px-4 py-1.5 text-[11px] gap-2" : "px-5 py-2.5 text-[13px] gap-2.5";
  return `inline-flex items-center justify-center rounded-full font-medium tracking-wide transition-colors cursor-pointer ${sizing} ${pillStyles[variant]} ${className}`;
}

export function PillLink({
  href,
  variant = "rose",
  arrow = false,
  size = "md",
  className = "",
  children,
}: PillProps & { href: string }) {
  return (
    <Link href={href} className={pillClass(variant, size, className)}>
      <span>{children}</span>
      {arrow && (
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full ${arrowStyles[variant]}`}
        >
          <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </span>
      )}
    </Link>
  );
}

export function PillButton({
  variant = "rose",
  arrow = false,
  size = "md",
  className = "",
  children,
  ...rest
}: PillProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={pillClass(variant, size, className)}>
      <span>{children}</span>
      {arrow && (
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full ${arrowStyles[variant]}`}
        >
          <ArrowRight className="h-3 w-3" strokeWidth={2} />
        </span>
      )}
    </button>
  );
}

/**
 * A rating in whole stars. All five are one element (.star-row in
 * globals.css), not five: a page of book cards drew a few hundred star
 * elements before. `size` "sm" is 12px stars, "md" 14px; `className` is for
 * spacing around the row.
 */
export function Stars({
  rating,
  size = "sm",
  className = "",
  showValue = false,
}: {
  rating: number;
  size?: "sm" | "md";
  className?: string;
  showValue?: boolean;
}) {
  const stars = (
    <span
      role="img"
      aria-label={`Rated ${rating} out of 5`}
      className={`star-row${size === "md" ? " star-row--md" : ""}${showValue || !className ? "" : ` ${className}`}`}
      style={{ "--stars": Math.min(5, Math.max(0, Math.round(rating))) } as CSSProperties}
    />
  );
  if (!showValue) return stars;
  return (
    <span className={`inline-flex items-center${className ? ` ${className}` : ""}`}>
      {stars}
      <span className="ml-1 text-[11px] text-fog">({rating.toFixed(1)})</span>
    </span>
  );
}

export function IconBadge({
  children,
  className = "",
  tone = "blush",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "blush" | "white" | "deep";
}) {
  const tones = {
    blush: "bg-blush-100 text-rose-600",
    white: "bg-white/85 text-rose-600",
    deep: "bg-white/12 text-white",
  };
  return (
    <span
      className={`flex items-center justify-center rounded-full ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Dismiss chip for the full-screen video overlay, shared by the gallery and
 * the badge on the product image so the two cannot drift.
 *
 * Dark with a white mark, not the other way round. The overlay is a blurred
 * wash of a cream page, and a white button on it read as a faint disc — easy
 * to miss and easy to mistake for part of the player. The white hairline keeps
 * this one legible against the black video frame as well.
 */
export const overlayCloseButton =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/85 text-white shadow-lift ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function SectionHeading({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`font-serif text-[1.75rem] leading-tight text-ink ${className}`}>
      {children}
    </h2>
  );
}

/**
 * The sale flash that sits over a hero photograph, and its twin in the admin
 * preview — one component so the two can never drift apart.
 *
 * Measured, not eyeballed: white on maroon-700 (#15335a, deep navy) is 12.7:1,
 * plenty for the 11px accent face at 0.16em tracking. The type is a step
 * larger and a touch less tracked, and the hairline ring keeps the pill's own
 * edge from melting into a dark photograph.
 */
export function OfferBadge({
  children,
  /** "sm" is the admin list chip; "md" is the size the storefront ships. */
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizing =
    size === "sm"
      ? "px-3 py-1 text-[10.5px] tracking-[0.12em]"
      : "px-4 py-1.5 text-[12px] tracking-[0.14em] sm:text-[13px]";

  return (
    <span
      className={`inline-flex items-center rounded-full bg-maroon-700 font-semibold font-accent uppercase leading-none text-white ring-1 ring-white/25 ${sizing} ${className}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
