"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, clientApi } from "@/lib/api";
import { Spinner } from "@/components/ui";

/**
 * Step one of a password reset: ask for the address, then send the person on
 * to type the code. Nothing here ever says whether the address is registered.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await clientApi("/auth/forgot-password", {
        method: "POST",
        body: { email },
        token: null,
        cartToken: null,
      });
      // The address rides along so the next screen does not ask twice.
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <form onSubmit={submit} className="px-7 py-9 sm:px-10">
        <p className="text-center text-[11px] font-accent uppercase tracking-[0.3em] text-rose-500">
          Forgot password
        </p>
        <h1 className="mt-2 text-center font-serif text-[1.7rem] text-ink">
          Let&rsquo;s get you back in
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-[13px] leading-relaxed text-cocoa">
          Enter the email on your account and we&rsquo;ll send a 6-digit code.
        </p>

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>
        )}

        <label className="mt-6 block text-[11px] font-medium text-cocoa">Email</label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-base mt-1"
          placeholder="you@example.com"
        />

        <button
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />} Send Code
        </button>

        <p className="mt-5 text-center text-[12px] text-fog">
          Remembered it?{" "}
          <Link href="/login" className="text-rose-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
