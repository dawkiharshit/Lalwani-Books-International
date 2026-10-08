"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Sends the visitor on to the home page as soon as the page has loaded. */
export function GoHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="container-shop py-24 text-center">
      <p className="text-[14px] text-fog">That page isn&rsquo;t here — taking you to the home page…</p>
      <Link href="/" className="mt-4 inline-block text-[13px] font-semibold text-rose-600 hover:underline">
        Go to the home page
      </Link>
    </div>
  );
}
