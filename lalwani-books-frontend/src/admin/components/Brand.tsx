import { LalwaniLogo, LalwaniMark } from "./LalwaniLogo";

/**
 * Store logo. An uploaded logo (admin → Branding → site_logo) always wins;
 * with none configured the built-in Lalwani Books International logo renders,
 * so a fresh install is already branded rather than showing a bare wordmark.
 *
 * `mark` asks for the LBi emblem alone, for the round avatar slots where a
 * wide logo would be cropped. It always uses the built-in emblem.
 *
 * A plain <img>, not next/image: a shop logo can be any shape (wide wordmark
 * or a square emblem), and next/image's required intrinsic width was collapsing
 * square logos to zero width in the header. A fixed height with width:auto lets
 * the browser size the width from the real aspect ratio, so any logo renders.
 */

export function Brand({
  logo,
  name = "Lalwani Books International",
  className = "",
  height = 40,
  heightClass,
  mark = false,
}: {
  logo?: string | null;
  name?: string;
  className?: string;
  height?: number;
  /** Tailwind height classes for a responsive logo (e.g. "h-[72px] lg:h-[96px]"). */
  heightClass?: string;
  wordmarkClass?: string;
  /** Emblem only, for round avatar slots. */
  mark?: boolean;
}) {
  if (mark || !logo) {
    // Branching on the element rather than on a component variable keeps
    // both prop types exact.
    const shared = {
      title: name,
      className: `w-auto ${heightClass ?? ""} ${className}`,
      style: heightClass ? undefined : { height },
    };
    return mark ? (
      <LalwaniMark {...shared} />
    ) : (
      <LalwaniLogo {...shared} />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={name}
      className={`w-auto max-w-none object-contain ${heightClass ?? ""} ${className}`}
      style={heightClass ? undefined : { height }}
    />
  );
}

/** Kept for callers that want plain type, e.g. dense admin chrome. */
export function BrandWordmark({
  name = "Lalwani Books International",
  className = "font-serif text-[1.6rem] tracking-wide text-ink",
}: {
  name?: string;
  className?: string;
}) {
  return <span className={className}>{name}</span>;
}
