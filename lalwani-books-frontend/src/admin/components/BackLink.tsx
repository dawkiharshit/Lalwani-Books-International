import Link from "next/link";
import { ArrowRight } from "./icons";

/**
 * "Back to …" link that replaced the breadcrumb trail on drill-down pages.
 *
 * A fixed href rather than router.back(): history can point anywhere — a search
 * engine, a shared link, another site — and a back control that sometimes exits
 * the shop is worse than none. This always lands somewhere in the store.
 */
export function BackLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex w-fit items-center gap-2 text-[12.5px] text-cocoa transition-colors hover:text-maroon-800 ${className}`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blush-100 transition-colors group-hover:bg-blush-150">
        <ArrowRight className="h-3.5 w-3.5 rotate-180" />
      </span>
      {label}
    </Link>
  );
}
