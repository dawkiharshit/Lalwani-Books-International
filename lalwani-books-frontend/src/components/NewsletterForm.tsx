"use client";

import { useState } from "react";
import { ApiError, clientApi } from "@/lib/api";
import { Spinner } from "./ui";

/**
 * Footer newsletter signup. Feeds admin → Messages & Subscribers, which
 * otherwise only filled when the (optional) popup was switched on.
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setMessage("");
    try {
      const res = await clientApi<{ message?: string }>("/newsletter/subscribe", {
        method: "POST",
        body: { email: email.trim() },
        token: null,
      });
      setState("done");
      setMessage(res?.message || "Thanks — you're on the list.");
      setEmail("");
    } catch (err) {
      setState("error");
      setMessage(err instanceof ApiError ? err.message : "Could not subscribe right now. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <div className="flex items-center gap-2 rounded-full bg-parchment/10 p-1.5 ring-1 ring-parchment/20 focus-within:ring-rose-400">
        <label htmlFor="footer-newsletter" className="sr-only">
          Email address
        </label>
        <input
          id="footer-newsletter"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          autoComplete="email"
          className="min-w-0 flex-1 bg-transparent px-3 text-[14px] text-parchment outline-none placeholder:text-parchment/50 sm:px-4"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="flex shrink-0 items-center gap-2 rounded-full bg-rose-600 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-70 sm:px-5"
        >
          {state === "busy" && <Spinner className="h-4 w-4" />}
          Subscribe
        </button>
      </div>
      {message && (
        <p role="status" className={`mt-2 px-4 text-[12.5px] ${state === "error" ? "text-rose-300" : "text-emerald-300"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
