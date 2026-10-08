import type { CSSProperties, ReactNode } from "react";

/**
 * The thin line drawings and soft textures shared by the decorated bands on
 * the home page — the hero and the readers' band. Every piece is placed with
 * the positioning classes it is handed, so each band keeps the drawings out of
 * its own content whatever shape it takes (wide on desktop, tall on phones).
 * All of it is decorative: the bands hide the whole layer from assistive
 * technology and from pointer events, and the global reduced-motion rule
 * stops the drifting.
 */

/**
 * A small drawing that bobs gently. The float animation owns the span's
 * transform, so any tilt goes on a <g> inside the drawing.
 */
export function Doodle({ className, delay, viewBox, children }: { className: string; delay?: string; viewBox: string; children: ReactNode }) {
  return (
    <span className={"float-y absolute " + className} style={delay ? { animationDelay: delay } : undefined}>
      <svg viewBox={viewBox} className="h-auto w-full overflow-visible" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

/** An open book — two pages with a few lines of text. Draw inside a 160×100 Doodle. */
export function OpenBook({ stroke, opacity }: { stroke: string; opacity: number }) {
  return (
    <>
      <path
        d="M8 20 C30 6 56 8 80 22 L80 92 C56 78 30 76 8 90 Z M80 22 C104 8 130 6 152 20 L152 90 C130 76 104 78 80 92"
        stroke={stroke}
        strokeOpacity={opacity}
        strokeWidth="2"
      />
      <path
        d="M24 40 C40 32 56 32 68 40 M24 56 C40 48 56 48 68 56 M92 40 C104 32 120 32 136 40 M92 56 C104 48 120 48 136 56"
        stroke={stroke}
        strokeOpacity={opacity * 0.6}
        strokeWidth="1.5"
      />
    </>
  );
}

/** A sheet with a folded corner and three lines of writing. Draw inside an 80×100 Doodle. */
export function FoldedPage({ stroke, opacity }: { stroke: string; opacity: number }) {
  return (
    <>
      <path d="M10 6 H52 L70 24 V94 H10 Z M52 6 V24 H70" stroke={stroke} strokeOpacity={opacity} strokeWidth="2" />
      <path d="M22 44 H58 M22 58 H58 M22 72 H46" stroke={stroke} strokeOpacity={opacity * 0.65} strokeWidth="1.5" />
    </>
  );
}

/** A four-point sparkle. */
export function Sparkle({ className, delay, fill, opacity }: { className: string; delay?: string; fill: string; opacity: number }) {
  return (
    <Doodle className={className} delay={delay} viewBox="0 0 24 24">
      <path d="M12 2 Q12 12 22 12 Q12 12 12 22 Q12 12 2 12 Q12 12 12 2 Z" fill={fill} fillOpacity={opacity} />
    </Doodle>
  );
}

/** A five-point star, outline only. */
export function Star({ className, delay, stroke, opacity }: { className: string; delay?: string; stroke: string; opacity: number }) {
  return (
    <Doodle className={className} delay={delay} viewBox="0 0 24 24">
      <path d="M12 2.5 14.9 8.6 21.5 9.4 16.6 14 17.9 20.6 12 17.3 6.1 20.6 7.4 14 2.5 9.4 9.1 8.6Z" stroke={stroke} strokeOpacity={opacity} strokeWidth="1.6" />
    </Doodle>
  );
}

/** Two rings, the inner one dashed. Still, since it sits in a corner. */
export function Ring({ className, stroke, opacity }: { className: string; stroke: string; opacity: number }) {
  return (
    <span className={"absolute " + className}>
      <svg viewBox="0 0 320 320" className="h-full w-full" fill="none">
        <circle cx="160" cy="160" r="150" stroke={stroke} strokeOpacity={opacity} strokeWidth="1.5" />
        <circle cx="160" cy="160" r="118" stroke={stroke} strokeOpacity={opacity * 0.65} strokeWidth="1" strokeDasharray="5 11" />
      </svg>
    </span>
  );
}

/** A gentle S-curve, like a ribbon laid along an edge. Still. */
export function Ribbon({ className, stroke, opacity }: { className: string; stroke: string; opacity: number }) {
  return (
    <span className={"absolute " + className}>
      <svg viewBox="0 0 340 80" className="h-auto w-full" fill="none" strokeLinecap="round">
        <path d="M4 44 C60 6 120 80 180 44 S300 6 336 44" stroke={stroke} strokeOpacity={opacity} strokeWidth="1.6" />
      </svg>
    </span>
  );
}

/**
 * Dotted paper over the whole band, cleared across the middle so the copy
 * sits on plain ground. `dot` is the dot colour, normally a translucent rgba.
 */
export function DottedPaper({ dot }: { dot: string }) {
  const mask = "radial-gradient(70% 75% at 50% 50%, transparent 30%, #000 90%)";
  const style: CSSProperties = {
    backgroundImage: `radial-gradient(${dot} 1px, transparent 1.3px)`,
    backgroundSize: "22px 22px",
    maskImage: mask,
    WebkitMaskImage: mask,
  };
  return <div className="absolute inset-0 opacity-80" style={style} />;
}
