"use client";

import { useState } from "react";
import { ApiError, clientApi } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

const TYPES = [
  { value: "school", label: "School" },
  { value: "university", label: "University / College" },
  { value: "library", label: "Library" },
  { value: "corporate", label: "Corporate" },
  { value: "other", label: "Other" },
];

const QUANTITIES = [
  { value: "", label: "Not sure yet" },
  { value: "under-50", label: "Under 50 books" },
  { value: "50-200", label: "50 – 200 books" },
  { value: "200-1000", label: "200 – 1,000 books" },
  { value: "1000-plus", label: "More than 1,000 books" },
];

const EMPTY = { name: "", organisation: "", type: "", email: "", phone: "", city: "", quantity: "", requirements: "", website: "" };

/**
 * The quote request: who is asking, for which organisation, and what they
 * need. Sent to /institution-enquiries, which files it in admin → Messages.
 * "website" is a hidden trap field that only bots fill in.
 */
export function QuoteForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k: string) => errors[k]?.[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const res = await clientApi<{ message: string }>("/institution-enquiries", {
        method: "POST",
        body: { ...form, quantity: form.quantity || undefined },
        token: null,
      });
      setDone(res.message);
      setForm(EMPTY);
    } catch (e) {
      // Field problems are shown under each field; the banner just points to
      // them, instead of the server's "…required. (and 4 more errors)".
      if (e instanceof ApiError && e.errors) {
        setErrors(e.errors);
        setError("Please check the fields marked below.");
      } else {
        setError(e instanceof Error ? e.message : "Could not send your request. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof typeof EMPTY, label: string, type = "text", required = true, autoComplete?: string) => (
    <div>
      <label htmlFor={`q-${k}`} className="mb-1 block text-[11.5px] font-medium text-cocoa">
        {label}
        {!required && <span className="text-fog"> (optional)</span>}
      </label>
      <input
        id={`q-${k}`}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={form[k]}
        onChange={set(k)}
        aria-invalid={err(k) ? true : undefined}
        aria-describedby={err(k) ? `q-${k}-error` : undefined}
        className="input-base"
      />
      {err(k) && (
        <p id={`q-${k}-error`} className="mt-1 text-[11.5px] text-red-600">
          {err(k)}
        </p>
      )}
    </div>
  );

  return (
    <section id="quote" className="card scroll-mt-28 p-6 sm:p-8" aria-labelledby="quote-heading">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-500">Request a quote</p>
      <h2 id="quote-heading" className="mt-2 text-[1.5rem] font-semibold leading-tight text-ink">Tell us what you need</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-fog">
        Share a few details and your list. We&rsquo;ll get back to you with a quote within 24 hours.
      </p>

      {done ? (
        <div role="status" className="mt-6 rounded-2xl bg-green-50 px-5 py-6 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-white">
            <CheckIcon className="h-5 w-5" strokeWidth={3} />
          </span>
          <p className="mt-3 text-[14px] font-semibold text-green-800">Request sent</p>
          <p className="mt-1 text-[13px] text-green-800">{done}</p>
          <button type="button" onClick={() => setDone("")} className="mt-4 text-[12.5px] font-semibold text-rose-600 hover:underline">
            Send another request
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-[12.5px] text-red-600">
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {field("name", "Your name", "text", true, "name")}
            {field("organisation", "Organisation name", "text", true, "organization")}
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-[11.5px] font-medium text-cocoa">Organisation type</legend>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => {
                const on = form.type === t.value;
                return (
                  <label
                    key={t.value}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-rose-500/50 ${
                      on ? "border-rose-600 bg-rose-600 text-white" : "border-blush-200 bg-white text-cocoa hover:border-rose-400 hover:text-ink"
                    }`}
                  >
                    <input type="radio" name="type" value={t.value} checked={on} onChange={set("type")} className="sr-only" />
                    {t.label}
                  </label>
                );
              })}
            </div>
            {err("type") && <p className="mt-1 text-[11.5px] text-red-600">{err("type")}</p>}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {field("email", "Email", "email", true, "email")}
            {field("phone", "Phone", "tel", true, "tel")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field("city", "City", "text", false, "address-level2")}
            <div>
              <label htmlFor="q-quantity" className="mb-1 block text-[11.5px] font-medium text-cocoa">
                Approximate quantity <span className="text-fog">(optional)</span>
              </label>
              <select id="q-quantity" value={form.quantity} onChange={set("quantity")} className="input-base">
                {QUANTITIES.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
              {err("quantity") && <p className="mt-1 text-[11.5px] text-red-600">{err("quantity")}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="q-requirements" className="mb-1 block text-[11.5px] font-medium text-cocoa">
              What do you need? <span className="text-fog">(optional)</span>
            </label>
            <textarea
              id="q-requirements"
              rows={5}
              maxLength={3000}
              value={form.requirements}
              onChange={set("requirements")}
              placeholder="Titles, subjects, classes or a reading list — with quantities if you know them."
              className="input-base resize-y"
            />
            {err("requirements") && <p className="mt-1 text-[11.5px] text-red-600">{err("requirements")}</p>}
          </div>

          {/* Trap for bots: hidden from people and from screen readers. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="q-website">Website</label>
            <input id="q-website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3.5 text-[13px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />} Request a quote
          </button>
          <p className="text-center text-[11px] text-fog">We use these details only to prepare and send your quote.</p>
        </form>
      )}
    </section>
  );
}
