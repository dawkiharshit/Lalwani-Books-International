"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError, clientApi } from "@/lib/api";
import type { User } from "@/lib/types";
import { PageLoader } from "@/components/loading/BookLoader";

/**
 * Landing point after Google. The URL carries a one-time handle, never the
 * API token — this page trades it for the real one and signs the person in.
 */
function GoogleReturn() {
  const params = useSearchParams();
  const router = useRouter();
  const { signIn } = useAuth();
  const handoff = params.get("handoff");
  const [exchangeError, setExchangeError] = useState("");
  // React runs effects twice in dev; the handle only works once.
  const claimed = useRef(false);

  useEffect(() => {
    if (!handoff || claimed.current) return;
    claimed.current = true;

    clientApi<{ token: string; user: User }>("/auth/google/exchange", {
      method: "POST",
      body: { handoff },
      token: null,
      cartToken: null,
    })
      .then((res) => {
        signIn(res.user, res.token);
        router.replace(res.user.is_admin ? "/admin" : "/account");
      })
      .catch((err) =>
        setExchangeError(
          err instanceof ApiError ? err.message : "Google sign-in could not be completed."
        )
      );
  }, [handoff, router, signIn]);

  // A missing handoff is knowable during render, so it is derived rather than
  // pushed into state from the effect — which is what react-hooks/
  // set-state-in-effect was flagging. Only the async failure needs state.
  const error = handoff ? exchangeError : "That sign-in link is incomplete. Please try again.";

  if (error) {
    return (
      <div className="px-8 py-12 text-center">
        <h1 className="font-serif text-[1.5rem] text-ink">Sign-in did not finish</h1>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-cocoa">{error}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <PageLoader label="Signing you in…" className="px-8 py-20" />
  );
}

export default function GoogleAuthPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Suspense
        fallback={
          <PageLoader />
        }
      >
        <GoogleReturn />
      </Suspense>
    </div>
  );
}
