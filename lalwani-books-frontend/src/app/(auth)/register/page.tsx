"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { OTP_LENGTH, OtpBoxes } from "@/components/OtpBoxes";
import { startNavigation } from "@/lib/loading-bus";

/** Mirrors the backend rules so the obvious mistakes never cost a round trip. */
const MIN_PASSWORD = 8;

/**
 * Sign-up in two steps, like "forgot password": the form, then the 6-digit
 * code emailed to the address. The account is only created once the code is
 * entered, already confirmed, and the customer is signed in.
 */
function RegisterForm() {
  const { register, verifyRegistration, resendRegistration } = useAuth();
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

  // Step two: the address the code went to, the code, and the resend timer.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const firstBox = useRef<HTMLInputElement | null>(null);
  const emailField = useRef<HTMLInputElement | null>(null);

  // Tick the resend countdown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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
      const { email, retryAfter } = await register({ ...form, phone: form.phone.trim() || undefined });
      setSentTo(email);
      setDigits(Array(OTP_LENGTH).fill(""));
      setNotice("");
      setCooldown(retryAfter);
    } catch (e) {
      // Field problems are shown under each field; the banner just points to them.
      if (e instanceof ApiError && e.errors) {
        setFieldErrors(e.errors);
        setError("Please check the fields marked below.");
      } else {
        setError(e instanceof Error ? e.message : "Could not create your account.");
      }
    } finally {
      setBusy(false);
    }
  }

  const confirm = useCallback(
    async (code: string) => {
      if (!sentTo) return;
      setBusy(true);
      setError("");
      setNotice("");
      try {
        await verifyRegistration(sentTo, code);
        const next = safeNext(params.get("next"), "/account");
        startNavigation(next);
        router.push(next);
      } catch (e) {
        setError(e instanceof ApiError ? (e.errors?.code?.[0] ?? e.message) : "Could not check that code.");
        setDigits(Array(OTP_LENGTH).fill(""));
        setBusy(false);
        firstBox.current?.focus();
      }
    },
    [sentTo, verifyRegistration, params, router]
  );

  async function resend() {
    if (!sentTo) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      const { message, retryAfter } = await resendRegistration(sentTo);
      setNotice(message);
      setCooldown(retryAfter);
      setDigits(Array(OTP_LENGTH).fill(""));
      firstBox.current?.focus();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        // The server says how long to wait; fall back to the full minute.
        if (e.status === 429) {
          const secs = /(\d+)\s*second/.exec(e.message);
          setCooldown(secs ? Number(secs[1]) : 60);
        }
      } else {
        setError("Could not send a new code.");
      }
    } finally {
      setResending(false);
    }
  }

  /** Back to the form (to fix the address), keeping everything typed. */
  function changeEmail() {
    setSentTo(null);
    setError("");
    setNotice("");
    setDigits(Array(OTP_LENGTH).fill(""));
    setTimeout(() => emailField.current?.focus(), 0);
  }

  if (sentTo) {
    return (
      <div className="px-8 pb-8 pt-3 text-center sm:px-10 sm:pb-10 sm:pt-4">
        <p className="text-[11px] font-accent uppercase tracking-[0.3em] text-rose-500">Step 2 of 2</p>
        <h1 className="mt-2 font-serif text-[1.9rem] text-ink">Check your email</h1>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-cocoa">
          We sent a {OTP_LENGTH}-digit code to <span className="break-all font-medium text-ink">{sentTo}</span>. Enter it
          to create your account. It works for 10 minutes.
        </p>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-5 rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">
            {notice}
          </p>
        )}

        <div className="mt-6">
          <OtpBoxes
            digits={digits}
            onChange={setDigits}
            onComplete={confirm}
            disabled={busy}
            invalid={Boolean(error)}
            autoFocus
            boxRef={(el) => {
              firstBox.current = el;
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => confirm(digits.join(""))}
          disabled={busy || digits.some((d) => !d)}
          className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />} Verify &amp; Create Account
        </button>

        <p className="mt-5 text-[12px] text-fog">
          Nothing arrived?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={resending || cooldown > 0}
            className="cursor-pointer text-rose-600 hover:underline disabled:cursor-default disabled:text-fog disabled:no-underline"
          >
            {cooldown > 0 ? `Send again in ${cooldown}s` : resending ? "Sending…" : "Send a new code"}
          </button>
        </p>
        <p className="mt-2 text-[12px] text-fog">
          Wrong email?{" "}
          <button type="button" onClick={changeEmail} className="cursor-pointer text-rose-600 hover:underline">
            Change it
          </button>
        </p>

        <p className="mt-6 border-t border-blush-100 pt-5 text-[11.5px] leading-relaxed text-fog">
          Check your spam folder before asking for another code. Your account is created only after the
          code is entered.
        </p>
      </div>
    );
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
        ref={k === "email" ? emailField : undefined}
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
      <p className="text-center text-[11px] font-accent uppercase tracking-[0.3em] text-rose-500">Step 1 of 2</p>
      <h1 className="mt-2 text-center font-serif text-[1.9rem] text-ink">Create Account</h1>
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
        {busy && <Spinner className="h-4 w-4" />} Continue
      </button>
      <p className="mt-2 text-center text-[11px] text-fog">
        Next, we&rsquo;ll email you a {OTP_LENGTH}-digit code to confirm your address.
      </p>

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
