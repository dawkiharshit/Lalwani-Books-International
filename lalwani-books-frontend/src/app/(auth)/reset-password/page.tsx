"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, clientApi } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { PageLoader } from "@/components/loading/BookLoader";

const LENGTH = 6;

/**
 * Step two: the code from the email plus a new password, on one screen. Doing
 * it in one step means nobody is left holding a verified code with nowhere to
 * type the password.
 */
function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function put(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, i) => (i === index ? "" : x)));
      return;
    }
    setDigits((d) => {
      const next = [...d];
      for (let i = 0; i < clean.length && index + i < LENGTH; i++) next[index + i] = clean[i];
      boxes.current[Math.min(index + clean.length, LENGTH - 1)]?.focus();
      return next;
    });
  }

  function onKey(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await clientApi("/auth/reset-password", {
        method: "POST",
        body: {
          email,
          code: digits.join(""),
          password,
          password_confirmation: confirm,
        },
        token: null,
        cartToken: null,
      });
      setDone(true);
      setTimeout(() => router.replace("/login"), 1600);
    } catch (err) {
      if (err instanceof ApiError) {
        // The server reports a bad code under "code", everything else under
        // its own field.
        setError(err.errors?.code?.[0] ?? err.errors?.password?.[0] ?? err.message);
      } else {
        setError("Could not reset the password. Try again.");
      }
      setDigits(Array(LENGTH).fill(""));
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResending(true);
    setError("");
    setNotice("");
    try {
      await clientApi("/auth/forgot-password", {
        method: "POST",
        body: { email },
        token: null,
        cartToken: null,
      });
      setNotice("If that email is registered, a new code is on its way.");
      setCooldown(60);
    } catch {
      setError("Could not send a new code.");
    } finally {
      setResending(false);
    }
  }

  if (done) {
    return (
      <div className="px-8 py-12 text-center">
        <h1 className="font-serif text-[1.6rem] text-ink">Password updated</h1>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-cocoa">
          Taking you to sign in. Any other device that was signed in has been signed out.
        </p>
      </div>
    );
  }

  const ready = email && digits.every(Boolean) && password.length >= 8 && confirm.length >= 8;

  return (
    <form onSubmit={submit} className="px-7 py-9 sm:px-10">
      <p className="text-center text-[11px] font-accent uppercase tracking-[0.3em] text-rose-500">
        Check your inbox
      </p>
      <h1 className="mt-2 text-center font-serif text-[1.7rem] text-ink">Enter your code</h1>
      <p className="mx-auto mt-3 max-w-sm text-center text-[13px] leading-relaxed text-cocoa">
        {email ? (
          <>
            If <span className="text-ink">{email}</span> is registered, a 6-digit code is on its
            way. It works for 10 minutes.
          </>
        ) : (
          "Enter the email on your account, the code we sent, and a new password."
        )}
      </p>

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>
      )}
      {notice && (
        <p className="mt-5 rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">
          {notice}
        </p>
      )}

      {!params.get("email") && (
        <>
          <label htmlFor="reset-email" className="mt-6 block text-[11px] font-medium text-cocoa">Email</label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base mt-1"
          />
        </>
      )}

      <div className="mt-6 flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            value={d}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
            onFocus={(e) => e.target.select()}
            disabled={busy}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={LENGTH}
            aria-label={`Digit ${i + 1}`}
            autoFocus={i === 0}
            className="h-[3.25rem] w-11 rounded-xl border border-blush-200 bg-white text-center font-serif text-[1.4rem] text-ink outline-none transition-colors focus:border-rose-400 disabled:opacity-60 sm:h-14 sm:w-12"
          />
        ))}
      </div>

      <label htmlFor="reset-new-password" className="mt-6 block text-[11px] font-medium text-cocoa">New password</label>
      <input
        id="reset-new-password"
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="input-base mt-1"
        placeholder="At least 8 characters"
        autoComplete="new-password"
      />

      <label htmlFor="reset-confirm-password" className="mt-4 block text-[11px] font-medium text-cocoa">Confirm password</label>
      <input
        id="reset-confirm-password"
        type="password"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="input-base mt-1"
        autoComplete="new-password"
      />

      <button
        disabled={busy || !ready}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
      >
        {busy && <Spinner className="h-4 w-4" />} Set New Password
      </button>

      <p className="mt-5 text-center text-[12px] text-fog">
        Nothing arrived?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={resending || cooldown > 0 || !email}
          className="text-rose-600 hover:underline disabled:text-fog disabled:no-underline"
        >
          {cooldown > 0 ? `Send again in ${cooldown}s` : resending ? "Sending…" : "Send a new code"}
        </button>
      </p>

      <p className="mt-4 text-center text-[12px] text-fog">
        <Link href="/login" className="hover:text-rose-600">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Suspense
        fallback={
          <PageLoader />
        }
      >
        <ResetForm />
      </Suspense>
    </div>
  );
}
