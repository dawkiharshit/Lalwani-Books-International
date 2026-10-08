"use client";

import { useEffect, useState } from "react";
import { API_BASE, clientApi } from "@/lib/api";

/** Google's four-colour G, drawn rather than fetched. */
const GoogleG = () => (
  <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden>
    <path
      fill="#4285F4"
      d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.9c-.5 2.8-2.1 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.5-9.5 6.5-16.5z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.9 0 10.9-2 14.6-5.3l-7.1-5.6c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.8C8 41.3 15.4 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.8H4.3A22 22 0 0 0 2 24c0 3.5.8 6.9 2.3 9.9l7.3-5.8z"
    />
    <path
      fill="#EA4335"
      d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.3 29.9 2 24 2 15.4 2 8 6.7 4.3 13.9l7.3 5.8c1.7-5.2 6.6-8.9 12.4-8.9z"
    />
  </svg>
);

/**
 * "Continue with Google".
 *
 * Hidden entirely until the shop owner has entered the credentials — an
 * always-visible button that only ever errors is worse than no button.
 */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    clientApi<{ data: { enabled: boolean } }>("/auth/google/status", {
      token: null,
      cartToken: null,
    })
      .then((res) => setEnabled(res.data.enabled))
      .catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-blush-150" />
        <span className="text-[10.5px] font-accent uppercase tracking-[0.18em] text-fog">or</span>
        <span className="h-px flex-1 bg-blush-150" />
      </div>

      {/* A full page load, not fetch — the OAuth dance needs the browser. */}
      <a
        href={`${API_BASE}/auth/google/redirect`}
        className="flex w-full items-center justify-center gap-2.5 rounded-full border border-blush-200 bg-white py-3 text-[13px] font-medium text-cocoa transition-colors hover:bg-blush-50 hover:text-ink"
      >
        <GoogleG />
        {label}
      </a>
    </>
  );
}
