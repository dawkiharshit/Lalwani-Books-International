"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui";
import { GoogleSignIn, googleErrorMessage } from "@/components/GoogleSignIn";
import { startNavigation } from "@/lib/loading-bus";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The backend bounces failed Google attempts back here as ?google_error=…
  const [error, setError] = useState(() => googleErrorMessage(params.get("google_error")));
  const [busy, setBusy] = useState(false);

  /**
   * Reached from the admin guard (`/login?next=/admin`) rather than by a
   * shopper. Password reset, registration and Google sign-in are all hidden
   * there: none leads anywhere useful for a staff account, and "Create an
   * account" on an admin sign-in reads as an invitation it is not. Staff sign
   * in with the credentials they were issued, and nothing else.
   *
   * Matched exactly, not by prefix — "/adminfoo" is a different route, and a
   * protocol-relative "//admin" is not this app's admin at all.
   */
  // Only a path on this site: a link could otherwise send someone who has
  // just signed in to another site (see safeNext).
  const next = safeNext(params.get("next"), "");
  const adminLogin = next === "/admin" || next.startsWith("/admin/");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email, password);
      // Staff signing in here are also signed in to the admin panel, which keeps
      // its own session (src/admin) so the two never overwrite each other.
      if (user.is_admin) {
        try {
          const token = localStorage.getItem("lalwani_token");
          if (token) {
            localStorage.setItem("lalwani_admin_token", token);
            localStorage.setItem("lalwani_admin_user", JSON.stringify(user));
          }
        } catch {
          /* storage blocked — the panel will ask them to sign in */
        }
      }
      // One form for both. Admins land in the panel, shoppers in their account,
      // and an explicit ?next (set by a guarded page) beats both.
      const destination = next || (user.is_admin ? "/admin" : "/account");
      startNavigation(destination);
      router.push(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="px-8 pb-8 pt-3 sm:px-10 sm:pb-10 sm:pt-4">
      <h1 className="text-center font-serif text-[1.9rem] text-ink">Sign In</h1>
      <p className="mt-1 text-center text-[12.5px] text-fog">
        Welcome back to Lalwani Books International
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-[11px] font-medium text-cocoa">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base"
          />
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label htmlFor="password" className="block text-[11px] font-medium text-cocoa">
              Password
            </label>
            {!adminLogin && (
              <Link
                href="/forgot-password"
                className="text-[11px] text-maroon-700 underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
      >
        {busy && <Spinner className="h-4 w-4" />} Sign In
      </button>

      {/* Hiding this also drops the "or" divider — that rule lives inside the
          component, so there is no orphaned separator left behind. */}
      {!adminLogin && <GoogleSignIn />}

      {!adminLogin && (
        <p className="mt-5 text-center text-[12px] text-cocoa">
          New here?{" "}
          {/* Carries ?next on, so a shopper sent here from checkout who signs
              up instead lands back at checkout, not on a cold account page. */}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="font-medium text-maroon-700 underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
