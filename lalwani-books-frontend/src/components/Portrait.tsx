import Image from "@/components/Image";
import { initialsOf } from "@/lib/format";

/**
 * A reader's round picture — the one they uploaded (My account → Profile
 * photo, or admin → Testimonials), or their initials on a tinted circle
 * while there is none.
 */
export function Portrait({ name, photo, className = "h-11 w-11" }: { name: string; photo?: string | null; className?: string }) {
  if (photo) {
    return (
      <span className={`relative shrink-0 overflow-hidden rounded-full bg-blush-100 ring-2 ring-white ${className}`}>
        <PhotoFill src={photo} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-blush-100 text-[13px] font-semibold text-rose-700 ring-2 ring-white ${className}`}
    >
      {initialsOf(name) || "?"}
    </span>
  );
}

/**
 * A profile picture filling its round frame. Our own uploads ("/storage/…")
 * go through the image optimiser; a Google sign-in's picture is an outside
 * link the optimiser is not allowed to fetch, so it is shown as it is, and
 * without sending which page it was viewed on.
 */
export function PhotoFill({ src }: { src: string }) {
  if (/^https?:\/\//i.test(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- an outside profile picture; one small image
      <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
    );
  }
  return <Image src={src} alt="" fill fixed sizes="80px" className="object-cover" />;
}
