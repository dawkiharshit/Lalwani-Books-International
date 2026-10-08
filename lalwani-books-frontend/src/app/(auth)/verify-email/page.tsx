"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ApiError, clientApi } from "@/lib/api";
import { Spinner } from "@/components/ui";
import type { User } from "@/lib/types";
import { PageLoader } from "@/components/loading/BookLoader";

const LENGTH = 6;

function VerifyEmail() {
  const { user, ready, setUser } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(() =>
    params.get("mail") === "unavailable"
      ? "We could not email your code — the shop has no working email setup yet. Ask the store owner to finish it, then send a new code."
      : ""
  );
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login?next=/verify-email");
    else if (user.email_verified) router.replace("/account");
  }, [ready, user, router]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const res = await clientApi<{ user: User }>("/auth/otp/verify", {
          method: "POST",
          body: { code },
        });
        setUser(res.user);
        router.replace("/account");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not check that code.");
        setDigits(Array(LENGTH).fill(""));
        boxes.current[0]?.focus();
      } finally {
        setBusy(false);
      }
    },
    [router, setUser]
  );

  function put(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((x, i) => (i === index ? "" : x)));
      return;
    }

    // A pasted code fills the whole row from wherever it landed.
    setDigits((d) => {
      const next = [...d];
      for (let i = 0; i < clean.length && index + i < LENGTH; i++) {
        next[index + i] = clean[i];
      }
      const filled = index + clean.length;
      boxes.current[Math.min(filled, LENGTH - 1)]?.focus();
      if (next.every(Boolean)) submit(next.join(""));
      return next;
    });
  }

  function onKey(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      boxes.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) boxes.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  async function resend() {
    setResending(true);
    setError("");
    setNotice("");
    try {
      const res = await clientApi<{ message: string }>("/auth/otp/send", { method: "POST" });
      setNotice(res.message);
      setCooldown(60);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        // The server says how long to wait; fall back to the full minute.
        if (err.status === 429) {
          const secs = /(\d+)\s*second/.exec(err.message);
          setCooldown(secs ? Number(secs[1]) : 60);
        }
      } else {
        setError("Could not send a new code.");
      }
    } finally {
      setResending(false);
    }
  }

  if (!ready || !user) {
    return (
      <PageLoader className="py-24" />
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="px-7 py-9 text-center sm:px-10">
        <p className="text-[11px] font-accent uppercase tracking-[0.3em] text-rose-500">One last step</p>
        <h1 className="mt-2 font-serif text-[1.7rem] text-ink">Confirm your email</h1>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-cocoa">
          We sent a {LENGTH}-digit code to <span className="text-ink">{user.email}</span>. It works
          for 10 minutes.
        </p>

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>
        )}
        {notice && (
          <p className="mt-5 rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">
            {notice}
          </p>
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

        <button
          type="button"
          onClick={() => submit(digits.join(""))}
          disabled={busy || digits.some((d) => !d)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-7 py-3 text-[13px] text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />} Confirm Email
        </button>

        <p className="mt-5 text-[12px] text-fog">
          Nothing arrived?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={resending || cooldown > 0}
            className="text-rose-600 hover:underline disabled:text-fog disabled:no-underline"
          >
            {cooldown > 0 ? `Send again in ${cooldown}s` : resending ? "Sending…" : "Send a new code"}
          </button>
        </p>

        <p className="mt-6 border-t border-blush-100 pt-5 text-[11.5px] leading-relaxed text-fog">
          Check the spam folder before asking for another code. You can{" "}
          <Link href="/collection" className="text-rose-600 hover:underline">
            keep browsing
          </Link>{" "}
          in the meantime — your account already works.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
