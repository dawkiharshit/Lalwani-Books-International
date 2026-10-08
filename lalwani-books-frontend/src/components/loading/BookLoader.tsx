/**
 * The shop's loading mark: a little shelf of book spines in the footer's
 * colours, hopping one after another. Pure markup and CSS (.book-loader in
 * globals.css), so it renders on the server, in loading.tsx files and inside
 * client components alike, and holds still for anyone who has asked for
 * reduced motion.
 */

const SPINES = [
  { color: "#f65d4e", height: 34, width: 12 },
  { color: "#e8b04b", height: 44, width: 14 },
  { color: "#2f7f7a", height: 38, width: 12 },
  { color: "#8a5a78", height: 46, width: 13 },
  { color: "#4b6a88", height: 36, width: 12 },
];

const SCALE = { sm: 0.55, md: 0.85, lg: 1.15 } as const;

export function BookLoader({ size = "md", className = "" }: { size?: keyof typeof SCALE; className?: string }) {
  const k = SCALE[size];
  return (
    <span aria-hidden className={`book-loader ${className}`}>
      <span className="book-loader__shelf" style={{ gap: Math.round(4 * k) }}>
        {SPINES.map((s, i) => (
          <span
            key={i}
            className="book-loader__spine"
            style={{
              height: Math.round(s.height * k),
              width: Math.round(s.width * k),
              backgroundColor: s.color,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </span>
      <span className="book-loader__board" />
    </span>
  );
}

/**
 * A loading state for a whole page or panel: the shelf with a line under it.
 * Announced to screen readers once, politely.
 */
export function PageLoader({
  label = "Loading…",
  size = "md",
  className = "py-20",
}: {
  label?: string;
  size?: keyof typeof SCALE;
  /** Spacing and framing, e.g. "card py-16". */
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 text-fog ${className}`}>
      <BookLoader size={size} />
      <p className="text-[13px] font-medium">{label}</p>
    </div>
  );
}
