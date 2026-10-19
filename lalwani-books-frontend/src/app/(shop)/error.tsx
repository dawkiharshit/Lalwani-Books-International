"use client";

import Link from "next/link";

/**
 * When a shop page can't load — the API down or too slow — the header and
 * footer stay and this offers another try, in place of the browser's bare
 * "Application error" screen. (A missing book or post is a 404 instead; see
 * not-found.tsx.) The error itself is never shown: in production it is only
 * an id that matches the server's log.
 */
export default function ShopError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="container-shop py-24 text-center">
      <h1 className="font-serif text-[1.6rem] text-ink">This page didn&rsquo;t load</h1>
      <p className="mt-2 text-[14px] text-fog">Please try again in a moment.</p>
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700"
        >
          Try again
        </button>
        <Link href="/" className="text-[13px] font-semibold text-rose-600 hover:underline">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
