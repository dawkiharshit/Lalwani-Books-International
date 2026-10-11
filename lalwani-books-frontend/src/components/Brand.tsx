/**
 * Store logo. An uploaded logo (admin → Branding → site_logo) always wins;
 * with none configured the built-in Lalwani Books International logo renders,
 * so a fresh install is already branded rather than showing a bare wordmark.
 *
 * `mark` asks for the LBi emblem alone, for the round avatar slots where the
 * full logo would be cropped. It always uses the built-in emblem.
 *
 * A plain <img>, not next/image: a shop logo can be any shape (wide wordmark
 * or a square emblem), and next/image's required intrinsic width was collapsing
 * square logos to zero width in the header. A fixed height with width:auto lets
 * the browser size the width from the real aspect ratio, so any logo renders.
 * The built-in files also state their ratio, so their space is held before the
 * file arrives and nothing shifts while the page loads.
 */

/**
 * The built-in artwork, traced from the supplied logo: the navy open-book LBi
 * emblem above "LALWANI BOOKS / INTERNATIONAL". One cached file serves every
 * page, instead of a copy of the drawing inside each page's HTML.
 */
export const BUILT_IN_LOGO = "/images/brand/logo.svg";
export const BUILT_IN_MARK = "/images/brand/mark.svg";
/** Width / height of logo.svg (its viewBox is 1277 × 792). */
export const LOGO_RATIO = "1277 / 792";

/** Settings values that mean "the built-in logo" rather than an uploaded one. */
export function isBuiltInLogo(logo?: string | null): boolean {
  return !logo || logo === BUILT_IN_LOGO || logo === "/images/brand/logo.png";
}

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
  const builtIn = mark || isBuiltInLogo(logo);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mark ? BUILT_IN_MARK : builtIn ? BUILT_IN_LOGO : (logo as string)}
      alt={name}
      className={`w-auto max-w-none object-contain ${heightClass ?? ""} ${className}`}
      style={{
        ...(heightClass ? {} : { height }),
        ...(builtIn ? { aspectRatio: mark ? "1" : LOGO_RATIO } : {}),
      }}
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
