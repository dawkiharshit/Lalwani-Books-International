"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/**
 * A card link that leans toward the mouse: a few degrees of 3D tilt
 * (--rx / --ry) and the spot a soft light should sit (--mx / --my), for the
 * card's own CSS to use. Mouse only — touch screens keep a still card — and
 * never when the visitor has asked for reduced motion.
 */
export function TiltCard({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const still = useRef(true);

  useEffect(() => {
    still.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function move(e: PointerEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el || still.current || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - y) * 8).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((x - 0.5) * 10).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  }

  function leave() {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  }

  return (
    <Link ref={ref} href={href} onPointerMove={move} onPointerLeave={leave} className={className} style={style}>
      {children}
    </Link>
  );
}
