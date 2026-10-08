/**
 * Brand social icons as one matching set: every network is the same circle,
 * in its own brand colour, with a soft raised finish — a light from the top
 * left, a fine inner rim, a gentle shade at the bottom and a neutral drop
 * shadow. They lift slightly on hover and press in on click.
 */

export type SocialNetwork = "facebook" | "instagram" | "youtube" | "x" | "telegram";

const LABEL: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X (Twitter)",
  telegram: "Telegram",
};

/** The brand fill under the shared lighting. */
const FILL: Record<SocialNetwork, string> = {
  facebook: "linear-gradient(160deg,#2f8bff 0%,#1877f2 50%,#0d63d6 100%)",
  instagram:
    "radial-gradient(circle at 30% 110%,#ffdb73 0%,#fd9a3d 22%,#f2385e 48%,#c22b9a 70%,#6a3fd6 100%)",
  youtube: "linear-gradient(160deg,#ff3d3d 0%,#ff0000 50%,#d40000 100%)",
  x: "linear-gradient(160deg,#3d3d3d 0%,#1a1a1a 50%,#000000 100%)",
  telegram: "linear-gradient(160deg,#4cc4f5 0%,#27a7e7 50%,#1a8fd1 100%)",
};

/** A soft light from the top left, laid over every fill. */
const LIGHT = "radial-gradient(circle at 32% 24%,rgba(255,255,255,0.42) 0%,rgba(255,255,255,0.12) 34%,rgba(255,255,255,0) 60%)";

/** White marks, each drawn to the same optical size in a 24-unit box. */
function Glyph({ network, className }: { network: SocialNetwork; className: string }) {
  switch (network) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M13.4 21v-7.7h2.6l.4-3h-3V8.4c0-.87.25-1.46 1.5-1.46H16.5V4.24A21 21 0 0 0 14.2 4.1c-2.28 0-3.84 1.39-3.84 3.94v2.26H7.8v3h2.56V21h3.04Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
          <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="4.6" />
          <circle cx="12" cy="12" r="3.7" />
          <circle cx="16.75" cy="7.25" r="1.05" fill="currentColor" stroke="none" />
        </svg>
      );
    case "youtube":
      // The YouTube mark itself: a white rounded screen with a red play arrow.
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden>
          <rect x="3.4" y="6.4" width="17.2" height="11.2" rx="3.3" fill="currentColor" />
          <path d="M10.3 9.3v5.4c0 .4.44.65.8.44l4.4-2.7a.5.5 0 0 0 0-.86l-4.4-2.7a.5.5 0 0 0-.8.42Z" fill="#e60000" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          <path d="M16.9 4.8h2.5l-5.46 6.24 6.42 8.16h-5.03l-3.94-5.15-4.5 5.15H4.36l5.84-6.68L4.04 4.8h5.15l3.56 4.7 4.15-4.7Zm-.88 12.97h1.39L8.47 6.2H6.98l9.04 11.57Z" />
        </svg>
      );
    case "telegram":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
          {/* Nudged right and down: the plane is drawn left of centre. */}
          <path transform="translate(0.9 0.6)" d="M18.4 6.1 16.1 17.2c-.17.78-.63.97-1.29.6l-3.56-2.62-1.72 1.65c-.19.19-.35.35-.71.35l.25-3.62 6.58-5.95c.29-.25-.06-.39-.45-.14L7.08 12.6l-3.5-1.1c-.76-.24-.78-.76.16-1.12l13.68-5.27c.63-.24 1.19.15.98 1Z" />
        </svg>
      );
  }
}

export function SocialIcon3D({
  network,
  href,
  size = "md",
}: {
  network: SocialNetwork;
  href: string;
  /** sm for the thin top bar, md for the footer. */
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-[30px] w-[30px]" : "h-10 w-10";
  const glyph = size === "sm" ? "h-[18px] w-[18px]" : "h-6 w-6";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={LABEL[network]}
      title={LABEL[network]}
      // Light top rim, soft shade at the bottom, a faint inner ring and a soft
      // shadow underneath (sized for the light footer); a deeper one while
      // lifted on hover. Kept in classes (not inline style) so the hover state
      // can override the resting one.
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_3px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(255,255,255,0.08),0_5px_12px_-5px_rgba(0,0,0,0.35)] transition-[translate,box-shadow,filter] duration-200 ease-out hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_3px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(255,255,255,0.08),0_10px_20px_-8px_rgba(0,0,0,0.4)] active:translate-y-0 active:brightness-95 ${box}`}
      style={{ backgroundImage: `${LIGHT}, ${FILL[network]}` }}
    >
      <Glyph network={network} className={`drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)] ${glyph}`} />
    </a>
  );
}
