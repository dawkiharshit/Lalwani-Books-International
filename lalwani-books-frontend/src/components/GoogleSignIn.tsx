"use client";

import { useEffect, useState } from "react";
import { API_BASE, clientApi } from "@/lib/api";

/** Reasons the backend bounces back to /login?google_error=… */
const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not set up yet.",
  cancelled: "Google sign-in was cancelled.",
  bad_state: "That sign-in link expired. Please try again.",
  no_code: "Google did not send a sign-in code. Please try again.",
  exchange_failed: "Could not complete Google sign-in. Please try again.",
};

export function googleErrorMessage(code: string | null) {
  if (!code) return "";
  return ERRORS[code] ?? "Google sign-in failed. Please try again.";
}

/**
 * Starts the Google flow. Renders nothing until the backend confirms the
 * credentials are saved, so the button never appears as a dead end.
 *
 * A full page navigation, not fetch: /auth/google/redirect answers with a 302
 * to Google, and XHR would follow it in the background instead of taking the
 * browser there.
 */
export function GoogleSignIn({ label = "Continue with Google" }: { label?: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clientApi<{ data: { enabled: boolean } }>("/auth/google/status")
      .then((r) => !cancelled && setEnabled(Boolean(r.data?.enabled)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <div className="my-5 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-blush-200" />
        <span className="text-[11px] font-accent uppercase tracking-[0.2em] text-fog">or</span>
        <span className="h-px flex-1 bg-blush-200" />
      </div>

      <button
        type="button"
        onClick={() => {
          // Not an internal route, so the lint rule does not apply: API_BASE is
          // the Laravel origin, and this endpoint answers with a 302 to Google.
          // router.push() would try to resolve it as a Next.js page.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = `${API_BASE}/auth/google/redirect`;
        }}
        className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-blush-200 bg-white py-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-blush-50"
      >
        <GoogleMark />
        {label}
      </button>
    </>
  );
}

/* Google's four-colour mark. Their brand terms require the official colours on
   a white or light button, so these hex values are fixed, not theme tokens. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}
