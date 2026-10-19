"use client";

import { useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { CheckIcon, CloseIcon, FileTextIcon } from "@/components/icons";

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

/** The same limits the API keeps (App\Support\QuoteFiles). */
const MAX_FILES = 3;
const MAX_MB = 3;

/** A file size as people read it. */
const size = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * The quote request: who is asking, for which organisation, what they need,
 * and their reading list as a CSV or PDF if they have one. Sent to
 * /institution-enquiries, which files it in admin → Messages with the files
 * beside it. "website" is a hidden trap field that only bots fill in.
 */
export function QuoteForm() {
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const picker = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k: string) => errors[k]?.[0];

  /**
   * Sent as a form upload, not as JSON, because the list can come with it.
   * No sign-in token goes with it: a quote request is anonymous.
   */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(form)) {
        if (value) body.append(key, value);
      }
      files.forEach((f) => body.append("files[]", f));

      const res = await fetch(`${API_BASE}/institution-enquiries`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Field problems are shown under each field; the banner just points to
        // them, instead of the server's "…required. (and 4 more errors)".
        if (data?.errors) {
          setErrors(data.errors);
          setError("Please check the fields marked below.");
        } else {
          setError(
            res.status === 429
              ? "That’s a lot of requests in a short time — please try again in a few minutes."
              : data?.message || "Could not send your request. Please try again."
          );
        }
        return;
      }

      setDone(String(data.message || "Thank you. We have your request."));
      setForm(EMPTY);
      setFiles([]);
    } catch {
      setError("Could not send your request. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  /** CSV or PDF only, and only as many as the API will keep. */
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const wrong = picked.find((f) => !/\.(csv|pdf)$/i.test(f.name));
    const big = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (wrong) return setErrors((p) => ({ ...p, files: [`${wrong.name} is not a CSV or PDF file.`] }));
    if (big) return setErrors((p) => ({ ...p, files: [`${big.name} is larger than ${MAX_MB} MB.`] }));
    if (files.length + picked.length > MAX_FILES) {
      return setErrors((p) => ({ ...p, files: [`Attach up to ${MAX_FILES} files.`] }));
    }
    setErrors((p) => ({ ...p, files: [] }));
    setFiles((p) => [...p, ...picked]);
  }

  const fileError = errors.files?.[0] || errors["files.0"]?.[0];

  const field = (k: keyof typeof EMPTY, label: string, type = "text", autoComplete?: string) => (
    <div>
      <label htmlFor={`q-${k}`} className="mb-1 block text-[11.5px] font-medium text-cocoa">
        {label}
      </label>
      <input
        id={`q-${k}`}
        type={type}
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
        Fill in as much or as little as you like. Leave an email or a phone number and we&rsquo;ll
        get back to you with a quote within 24 hours.
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
            {field("name", "Your name", "text", "name")}
            {field("organisation", "Organisation name", "text", "organization")}
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
            {field("email", "Email", "email", "email")}
            {field("phone", "Phone", "tel", "tel")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field("city", "City", "text", "address-level2")}
            <div>
              <label htmlFor="q-quantity" className="mb-1 block text-[11.5px] font-medium text-cocoa">
                Approximate quantity
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
              What do you need?
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

          <div>
            <p className="mb-1 block text-[11.5px] font-medium text-cocoa">
              Your list
            </p>
            <button
              type="button"
              onClick={() => picker.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-blush-300 bg-blush-50 px-4 py-3 text-left transition-colors hover:border-rose-400 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 ring-1 ring-blush-200">
                <FileTextIcon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-ink">Attach a CSV or PDF</span>
                <span className="block text-[11.5px] text-fog">
                  Your titles and quantities — up to {MAX_FILES} files, {MAX_MB} MB each
                </span>
              </span>
            </button>
            <input
              ref={picker}
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              multiple
              onChange={pick}
              className="sr-only"
              aria-label="Attach a CSV or PDF list"
            />

            {files.length > 0 && (
              <ul className="mt-2 space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-blush-200"
                  >
                    <FileTextIcon className="h-4 w-4 shrink-0 text-rose-500" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{f.name}</span>
                    <span className="shrink-0 text-[11px] text-fog">{size(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((p) => p.filter((_, n) => n !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fog transition-colors hover:bg-blush-100 hover:text-ink"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {fileError && <p className="mt-1 text-[11.5px] text-red-600">{fileError}</p>}
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
