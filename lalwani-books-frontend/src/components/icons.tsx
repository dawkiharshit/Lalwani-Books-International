interface IconProps {
  className?: string;
  strokeWidth?: number;
}

function base(className = "h-4 w-4", strokeWidth = 1.6) {
  return {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
}

export const ArrowRight = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M4 12h15m0 0-6-6m6 6-6 6" /></svg>
);
export const SearchIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const MenuIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const CloseIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="m6 6 12 12M18 6 6 18" /></svg>
);
export const PlayIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M9 6.5v11l9-5.5z" />
  </svg>
);
export const EyeIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.75" />
  </svg>
);
export const InvoiceIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M6 3h9l3 3v15l-3-2-3 2-3-2-3 2V3z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
);
export const PauseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M8.5 6h2.2v12H8.5zm4.8 0h2.2v12h-2.2z" />
  </svg>
);
export const PlusIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M12 5v14M5 12h14" /></svg>
);
export const MinusIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M5 12h14" /></svg>
);
export const BagIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M6 8h12l1 12a1.6 1.6 0 0 1-1.6 1.7H6.6A1.6 1.6 0 0 1 5 20z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </svg>
);
export const HeartIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M12 20s-7-4.5-9-9a4.9 4.9 0 0 1 9-3.4A4.9 4.9 0 0 1 21 11c-2 4.5-9 9-9 9Z" />
  </svg>
);
export const HeartSolid = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 20s-7-4.5-9-9a4.9 4.9 0 0 1 9-3.4A4.9 4.9 0 0 1 21 11c-2 4.5-9 9-9 9Z" />
  </svg>
);
export const UserIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" />
  </svg>
);
export const GemIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M7 4h10l4 5-9 11L3 9z" /><path d="M3 9h18M9.5 9 12 20l2.5-11" />
  </svg>
);
export const ClockIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></svg>
);
export const CraftIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M12 3c-4 3.5-6 6.8-6 10a6 6 0 0 0 12 0c0-3.2-2-6.5-6-10Z" /><path d="M12 21v-6" />
  </svg>
);
export const GiftIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <rect x="4" y="9" width="16" height="12" rx="1.5" /><path d="M4 13h16M12 9v12" />
    <path d="M12 9c-1.8 0-4.5-.7-4.5-3A2.2 2.2 0 0 1 12 5.4 2.2 2.2 0 0 1 16.5 6c0 2.3-2.7 3-4.5 3Z" />
  </svg>
);
export const LeafIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M5 19C5 9 12 4 20 4c0 8-4 15-14 15Z" /><path d="M5 19c2.5-5.5 6.5-9.5 11-11.5" />
  </svg>
);
export const ShieldIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M12 3 5 6v5c0 5 3.2 8.4 7 10 3.8-1.6 7-5 7-10V6z" /><path d="m9 12 2 2 4-4.5" />
  </svg>
);
export const TruckIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" />
  </svg>
);
export const RefreshIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M4 12a8 8 0 0 1 14-5.3L20 8M20 12a8 8 0 0 1-14 5.3L4 16" /><path d="M20 4v4h-4M4 20v-4h4" />
  </svg>
);
export const QuoteIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M5 6h5v6H7a3 3 0 0 0 3 3v3a6 6 0 0 1-6-6zM14 6h5v6h-3a3 3 0 0 0 3 3v3a6 6 0 0 1-6-6z" />
  </svg>
);
export const StarSolid = ({ className }: IconProps) => (
  <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
    <path d="m10 1.8 2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z" />
  </svg>
);
export const SparkleIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
);
export const CheckIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="m5 13 4.5 4.5L19 7" /></svg>
);
export const InstagramIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const MailIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="m3.5 7 7.4 5.3a2 2 0 0 0 2.2 0L20.5 7" />
  </svg>
);
export const PhoneIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M6.6 3.5h2.6l1.4 3.6-2 1.3a11 11 0 0 0 5 5l1.3-2 3.6 1.4v2.6a2.1 2.1 0 0 1-2.3 2.1A16.4 16.4 0 0 1 4.5 5.8a2.1 2.1 0 0 1 2.1-2.3Z" />
  </svg>
);
export const WhatsAppIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M3.5 20.5l1.3-4.2A8.2 8.2 0 1 1 8 19.4l-4.5 1.1Z" />
    <path d="M8.9 8.2c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .6.5l.7 1.6c.1.2.1.4 0 .6l-.4.5c-.1.2-.3.3-.1.6a6 6 0 0 0 2.7 2.3c.3.1.4 0 .6-.1l.6-.7c.2-.2.3-.2.6-.1l1.6.8c.2.1.4.2.4.4a2 2 0 0 1-1.4 1.6c-.5.1-1.2.2-3.4-.8a8 8 0 0 1-3.3-3.5c-.6-1.2-.5-2.1-.3-2.6l.4-.6Z" />
  </svg>
);

/** Decorative bottle outline — for section backdrops. */
export const BottleMark = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth ?? 0.7)} viewBox="0 0 24 24">
    <path d="M10.2 2.6h3.6v2.6h-3.6z" />
    <path d="M9.4 5.2h5.2a3 3 0 0 1 3 3v10.4a2.8 2.8 0 0 1-2.8 2.8H9.2a2.8 2.8 0 0 1-2.8-2.8V8.2a3 3 0 0 1 3-3Z" />
    <path d="M8.4 11.4h7.2" />
    <path d="M12 14.2v3.6M10.4 16h3.2" />
    <path d="M15.2 3.9h2.2a1.6 1.6 0 0 1 1.6 1.6v1.1" />
  </svg>
);

/** Brand marks — filled glyphs, so they read at small sizes. */
export const FacebookIcon = ({ className }: IconProps) => (
  <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
  </svg>
);
export const PinterestIcon = ({ className }: IconProps) => (
  <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.65 19.31c-.09-.78-.17-1.98.03-2.83.19-.8 1.2-5.09 1.2-5.09s-.31-.61-.31-1.52c0-1.42.83-2.48 1.85-2.48.87 0 1.3.66 1.3 1.44 0 .88-.56 2.19-.85 3.41-.24 1.02.51 1.85 1.52 1.85 1.82 0 3.22-1.92 3.22-4.7 0-2.46-1.76-4.18-4.29-4.18-2.92 0-4.64 2.19-4.64 4.46 0 .88.34 1.83.76 2.35.09.1.1.19.07.29l-.28 1.14c-.05.18-.15.22-.34.13-1.27-.59-2.06-2.44-2.06-3.93 0-3.2 2.32-6.13 6.7-6.13 3.51 0 6.25 2.5 6.25 5.85 0 3.49-2.2 6.3-5.26 6.3-1.03 0-1.99-.54-2.32-1.17l-.63 2.4c-.23.88-.85 1.98-1.26 2.65A10 10 0 1 0 12 2Z" />
  </svg>
);
/** Filled Instagram mark for brand rows (the outline one suits overlays). */
export const InstagramMark = ({ className }: IconProps) => (
  <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.26.07 1.64.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.26.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.26-.07-1.64-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 3.72a6.12 6.12 0 1 0 0 12.24 6.12 6.12 0 0 0 0-12.24Zm0 10.1a3.98 3.98 0 1 1 0-7.96 3.98 3.98 0 0 1 0 7.96Zm7.79-10.34a1.43 1.43 0 1 1-2.86 0 1.43 1.43 0 0 1 2.86 0Z" />
  </svg>
);
export const YoutubeIcon = ({ className }: IconProps) => (
  <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.5 3.56 12 3.56 12 3.56s-7.5 0-9.39.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12c1.89.52 9.39.52 9.39.52s7.5 0 9.39-.52a3 3 0 0 0 2.11-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.24 3.6L9.6 15.6Z" />
  </svg>
);
export const XIcon = ({ className }: IconProps) => (
  <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.9 2.3h3.3l-7.2 8.24L23.7 21.7h-6.63l-5.2-6.79-5.94 6.79H2.63l7.7-8.8L1.5 2.3h6.8l4.7 6.21L18.9 2.3Zm-1.16 17.4h1.83L6.34 4.2H4.38l13.36 15.5Z" />
  </svg>
);
export const TelegramIcon = ({ className }: IconProps) => (
  <svg className={className ?? "h-4 w-4"} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21.94 4.3 18.7 19.46c-.24 1.08-.88 1.34-1.79.84l-4.94-3.64-2.38 2.3c-.27.26-.49.48-1 .48l.35-5.02 9.13-8.25c.4-.35-.09-.55-.62-.2L6.16 13.2 1.28 11.68c-1.06-.33-1.08-1.06.22-1.57L20.6 2.74c.88-.33 1.65.2 1.34 1.56Z" />
  </svg>
);

/* Category marks for the Shop menu. Same stroke language as the set above. */

/** Serum drop — Skin. */
export const DropletIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M12 3.2c3.4 3.7 5.2 6.6 5.2 9.1a5.2 5.2 0 0 1-10.4 0c0-2.5 1.8-5.4 5.2-9.1Z" />
    <path d="M9.6 13.6a2.6 2.6 0 0 0 2.2 2.6" />
  </svg>
);

/** Flowing strand over a comb — Hair. */
export const HairIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M7 3.5c-2.4 2.6-3.2 6-2.4 9.3.5 2.1 1.7 4 3.4 5.4" />
    <path d="M17 3.5c2.4 2.6 3.2 6 2.4 9.3-.5 2.1-1.7 4-3.4 5.4" />
    <path d="M12 3v11" />
    <path d="M8.5 20.5h7M10 18v2.5M12 18v2.5M14 18v2.5" />
  </svg>
);

/** Lipstick bullet — Makeup. */
export const LipstickIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M9.5 9.5V5.2c0-.6.5-1.1 1.1-1.1h2.3c.7 0 1.6.6 1.6 1.6v3.8" />
    <rect x="8.8" y="9.5" width="6.4" height="4" rx="1" />
    <path d="M9.4 13.5h5.2v5.6a1.4 1.4 0 0 1-1.4 1.4h-2.4a1.4 1.4 0 0 1-1.4-1.4Z" />
  </svg>
);

/** Soap bar and lather — Bath & Body. */
export const SoapIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <rect x="3.5" y="12" width="13" height="8" rx="2.2" />
    <path d="M3.5 15.2h13" />
    <circle cx="18" cy="6.2" r="2.1" />
    <circle cx="13.6" cy="4.6" r="1.3" />
    <circle cx="17.4" cy="10.4" r="1" />
  </svg>
);

/** Disclosure chevron — sidebar groups, accordions. */
export const ChevronIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth ?? 2.2)}><path d="m6 9 6 6 6-6" /></svg>
);

/* ---------------------------------------------------------------------------
 * Navigation icons — the storefront drawer and the admin sidebar.
 * Same 24x24 stroked outline as the set above, so they sit at the same weight
 * next to a 12.5-15px label.
 * ------------------------------------------------------------------------- */

export const HomeIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="m3.5 10.5 8.5-6.5 8.5 6.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" />
  </svg>
);

/** Storefront awning — "Shop", kept distinct from the cart and bag marks. */
export const ShopIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M3 9.5 4.8 4h14.4L21 9.5" /><path d="M4.5 9.5V20h15V9.5" /><path d="M9.5 20v-6h5v6" />
  </svg>
);

export const InfoIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <circle cx="12" cy="12" r="8.5" /><path d="M12 11.2v5" /><path d="M12 7.8h.01" />
  </svg>
);

/** A written page — "Blog" on the storefront, the blog list in the admin. */
export const FileTextIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M6.5 3.5h7L18 8v11a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M13 3.5V8h4.5" /><path d="M8.5 13h7M8.5 16.5h4.5" />
  </svg>
);

export const UserPlusIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <circle cx="10" cy="8" r="3.8" /><path d="M3.5 20.5c1.2-3.5 3.8-5.2 6.5-5.2 1 0 1.9.2 2.7.6" />
    <path d="M17.5 14.5v6M14.5 17.5h6" />
  </svg>
);

export const DashboardIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M3.8 18a8.5 8.5 0 1 1 16.4 0" /><path d="m12 18 3.6-4.8" /><path d="M12 6.5v1.5M5.6 11.3l1.3.7M18.4 11.3l-1.3.7" />
  </svg>
);

/** Package — "Products". */
export const BoxIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M12 3.2 20.3 7.6v8.8L12 20.8 3.7 16.4V7.6Z" /><path d="m3.7 7.6 8.3 4.4 8.3-4.4" /><path d="M12 12v8.8" />
  </svg>
);

export const GridIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
  </svg>
);

/** Till receipt — "Orders". */
export const ReceiptIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5Z" /><path d="M9.5 8.5h5M9.5 12.5h5" />
  </svg>
);

/** Trolley — "Abandoned Carts", distinct from the shopping BagIcon. */
export const CartIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M2.8 4h2.1l2.6 11h9.6l2-7.6H6.3" /><circle cx="9.5" cy="19" r="1.7" /><circle cx="16.8" cy="19" r="1.7" />
  </svg>
);

export const TagIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M3.5 11.6V4.9a1.4 1.4 0 0 1 1.4-1.4h6.7l8.1 8.1a1.6 1.6 0 0 1 0 2.2l-6.3 6.3a1.6 1.6 0 0 1-2.2 0Z" />
    <circle cx="8" cy="8" r="1.4" />
  </svg>
);

/** Outline star — "Reviews". StarSolid is the filled rating mark. */
export const StarIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />
  </svg>
);

export const ImageIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="8.6" cy="10" r="1.6" />
    <path d="m3.8 17.4 5-4.4 4.3 3.8 3-2.4 4.9 4.2" />
  </svg>
);

/** Overlapping rounds — "Collection Circles". */
export const CirclesIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <circle cx="9" cy="12" r="5.8" /><circle cx="15" cy="12" r="5.8" />
  </svg>
);

/** Megaphone — "Promo Band". */
export const MegaphoneIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M4 10.2v3.6a1.6 1.6 0 0 0 1.6 1.6H8l8.5 4.4V4.2L8 8.6H5.6A1.6 1.6 0 0 0 4 10.2Z" />
    <path d="M20 10.2v3.6M8 15.4v3a1.6 1.6 0 0 0 1.6 1.6h1.2" />
  </svg>
);

/** Bar chart — "Stats Counter". */
export const ChartIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M4 20h16" /><path d="M7.5 20v-5.5M12 20V7.5M16.5 20v-9" />
  </svg>
);

/** Two sheets — "Pages". */
export const PagesIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <rect x="3.5" y="6.5" width="12" height="14" rx="2" /><path d="M7.5 3.5h9A2.5 2.5 0 0 1 19 6v11" />
  </svg>
);

export const GearIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <circle cx="12" cy="12" r="3.3" />
    <path d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2 5.4 5.4" />
  </svg>
);

/** Painter's palette — "Branding". */
export const PaletteIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M12 3.2c-5 0-8.8 3.9-8.8 8.8s3.9 8.8 8.8 8.8c1.1 0 1.9-.9 1.9-1.9 0-.5-.2-1-.5-1.3-.3-.3-.5-.7-.5-1.2 0-1 .8-1.9 1.9-1.9h1.7c2.8 0 5-2.3 5-5 0-3.9-4.3-6.3-9.5-6.3Z" />
    <circle cx="7.8" cy="11.5" r="1" /><circle cx="11.5" cy="7.8" r="1" /><circle cx="15.8" cy="10" r="1" />
  </svg>
);

/** Bank card — "Payments". */
export const CardIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.6h19" /><path d="M6 15h3.5" />
  </svg>
);

/** Map pin — "Delivery", so it reads apart from the shipping truck. */
export const MapPinIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M12 21s6.8-5.9 6.8-10.8a6.8 6.8 0 1 0-13.6 0C5.2 15.1 12 21 12 21Z" /><circle cx="12" cy="10" r="2.6" />
  </svg>
);

/** @ — the SMTP screen, where MailIcon already marks the inbox. */
export const AtIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <circle cx="12" cy="12" r="3.6" /><path d="M15.6 8.4v4.9a2.7 2.7 0 0 0 5.4 0V12a9 9 0 1 0-3.7 7.3" />
  </svg>
);

/** Key — "Google Sign-in", i.e. who may sign in, not the Google brand. */
export const KeyIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <circle cx="8" cy="15.2" r="3.8" /><path d="m10.7 12.5 8-8" /><path d="m16.6 6.6 2.2 2.2M14.8 8.4l2.2 2.2" />
  </svg>
);

/** Speech bubble — "Testimonials"; QuoteIcon is the filled pull-quote mark. */
export const MessageIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M20.5 11.6c0 3.9-3.8 7.1-8.5 7.1-1 0-1.9-.1-2.8-.4L4.5 20l1.4-3.3a6.8 6.8 0 0 1-2.4-5.1c0-3.9 3.8-7.1 8.5-7.1s8.5 3.2 8.5 7.1Z" />
  </svg>
);

/** Arrow leaving the box — "View Site" opens the storefront. */
export const ExternalIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M13.5 4H20v6.5" /><path d="M20 4l-8.5 8.5" />
    <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </svg>
);

export const LogoutIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}>
    <path d="M9.5 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h3.5" />
    <path d="m15.5 8 4 4-4 4M19.5 12h-10" />
  </svg>
);
export const BookIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2Z" /><path d="M8 7h7M8 11h5" /></svg>
);
export const BookOpenIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M2 5c3-1.3 6.5-1.3 10 1v14c-3.5-2.3-7-2.3-10-1V5Z" /><path d="M22 5c-3-1.3-6.5-1.3-10 1v14c3.5-2.3 7-2.3 10-1V5Z" /></svg>
);
export const UsersIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2" /></svg>
);
export const SmileIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5c1.8 2 5.2 2 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></svg>
);

/* ---------------------------------------------------------------------------
 * The About page figures band: a book stack, a quill, a shelf and a van —
 * drawn a little fuller than the nav icons so they read at 28px on dark green.
 * ------------------------------------------------------------------------- */
export const BookStackIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><rect x="3" y="4" width="15" height="4.6" rx="1.3" /><rect x="6" y="9.7" width="15" height="4.6" rx="1.3" /><rect x="4" y="15.4" width="15" height="4.6" rx="1.3" /></svg>
);
export const QuillIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M20.5 3.5c-6.2.4-10.8 3.6-13 9.3L4 20.5l7.7-3.5c5.7-2.2 8.9-6.8 8.8-13.5Z" /><path d="M8.5 15.5l6.5-6.5" /></svg>
);
export const ShelfIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M3 20.5h18" /><rect x="4" y="9" width="3.2" height="11.5" rx=".7" /><rect x="8.4" y="6" width="3.2" height="14.5" rx=".7" /><rect x="12.8" y="8" width="3.2" height="12.5" rx=".7" /><path d="M17 20.5l2.2-10 3 .7-2.1 9.3Z" /></svg>
);
export const DeliveryVanIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M3 16V7.5A1.5 1.5 0 0 1 4.5 6H14v10" /><path d="M14 9h3.6a1.5 1.5 0 0 1 1.2.6l2 2.7c.2.2.2.5.2.8V16h-2.2" /><path d="M3 16h2.2M8.8 16h6.4" /><circle cx="7" cy="16.5" r="1.8" /><circle cx="17" cy="16.5" r="1.8" /></svg>
);
/** A pencil — "Edit profile". */
export const PencilIcon = ({ className, strokeWidth }: IconProps) => (
  <svg {...base(className, strokeWidth)}><path d="M14.5 5.5l4 4" /><path d="M4 20l1.2-4.6L16.6 4a1.9 1.9 0 0 1 2.7 0l.7.7a1.9 1.9 0 0 1 0 2.7L8.6 18.8Z" /></svg>
);
