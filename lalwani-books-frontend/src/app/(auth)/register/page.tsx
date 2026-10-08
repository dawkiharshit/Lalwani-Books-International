"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { startNavigation } from "@/lib/loading-bus";

/** Mirrors the backend rules so the obvious mistakes never cost a round trip. */
const MIN_PASSWORD = 8;

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    password_confirmation: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const err = (k: string) => fieldErrors[k]?.[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    // Checked here as well as server-side: the mismatch is the one error worth
    // catching before the request, because the server reports it against
    // `password` and the user is looking at the confirm field.
    if (form.password !== form.password_confirmation) {
      setFieldErrors({ password_confirmation: ["Both passwords must match."] });
      return;
    }

    setBusy(true);
    try {
      const { otpSent } = await register({ ...form, phone: form.phone.trim() || undefined });
      // Registration signs them in and emails a code, so send them straight to
      // the step that is actually next rather than to a cold account page.
      // When the code could not be mailed, say so there rather than leaving
      // them watching an inbox nothing was sent to.
      const next = safeNext(params.get("next"), "/verify-email");
      const destination = otpSent || next !== "/verify-email" ? next : "/verify-email?mail=unavailable";
      startNavigation(destination);
      router.push(destination);
    } catch (e) {
      if (e instanceof ApiError && e.errors) setFieldErrors(e.errors);
      setError(e instanceof Error ? e.message : "Could not create your account.");
      setBusy(false);
    }
  }

  const field = (
    k: keyof typeof form,
    label: string,
    type: string,
    autoComplete: string,
    required = true
  ) => (
    <div>
      <label htmlFor={k} className="mb-1 block text-[11px] font-medium text-cocoa">
        {label}
        {!required && <span className="text-fog"> (optional)</span>}
      </label>
      <input
        id={k}
        name={k}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={form[k]}
        onChange={set(k)}
        aria-invalid={err(k) ? true : undefined}
        aria-describedby={err(k) ? `${k}-error` : undefined}
        className="input-base"
        {...(type === "password" ? { minLength: MIN_PASSWORD } : {})}
      />
      {err(k) && (
        <p id={`${k}-error`} className="mt-1 text-[11px] text-red-600">
          {err(k)}
        </p>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="px-8 pb-8 pt-3 sm:px-10 sm:pb-10 sm:pt-4" noValidate>
      <h1 className="text-center font-serif text-[1.9rem] text-ink">Create Account</h1>
      <p className="mt-1 text-center text-[12.5px] text-fog">
        Save your details, track orders and keep a wishlist.
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          {error}
        </p>
      )}

      <div className="mt-5 space-y-3.5">
        {field("name", "Full name", "text", "name")}
        {field("email", "Email", "email", "email")}
        {field("phone", "Phone", "tel", "tel", false)}
        {field("password", "Password", "password", "new-password")}
        {field("password_confirmation", "Confirm password", "password", "new-password")}
        <p className="text-[11px] text-fog">At least {MIN_PASSWORD} characters.</p>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
      >
        {busy && <Spinner className="h-4 w-4" />} Create Account
      </button>

      <GoogleSignIn label="Sign up with Google" />

      <p className="mt-5 text-center text-[12px] text-cocoa">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-maroon-700 underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
