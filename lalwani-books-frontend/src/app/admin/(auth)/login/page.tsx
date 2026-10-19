"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/admin/context/AuthContext";
import { Spinner } from "@/admin/components/ui";

/**
 * Staff sign-in. This app is the admin panel only, so there is nothing else
 * to offer here: no registration, no emailed password reset and no Google
 * sign-in. Staff use the credentials they were issued, and change the
 * password from the panel (Account → Change Password).
 */
function LoginForm() {
  const { login, logout } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Only a path inside the panel is honoured, so ?next cannot send anyone off-site.
  const next = params.get("next") ?? "";
  const target = next === "/admin" || next.startsWith("/admin/") ? next : "/admin";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email, password);
      // The owner, or a staff member the owner added in admin → Staff.
      if (!user.is_admin && !user.staff) {
        // A customer account must not stay signed in to the panel.
        await logout();
        setError("This account does not have admin access.");
        setBusy(false);
        return;
      }
      router.push(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="px-8 pb-8 pt-3 sm:px-10 sm:pb-10 sm:pt-4">
      <h1 className="text-center font-serif text-[1.9rem] text-ink">Sign In</h1>
      <p className="mt-1 text-center text-[12.5px] text-fog">Admin panel</p>

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
          <label htmlFor="password" className="mb-1 block text-[11px] font-medium text-cocoa">
            Password
          </label>
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
