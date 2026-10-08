"use client";

import { PageBanner } from "@/components/PageBanner";
import Link from "next/link";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { money } from "@/lib/format";
import { DEFAULT_SETTINGS, fetchSettingsClient, type StoreSettings } from "@/lib/settings";
import {
  FacebookIcon,
  InstagramMark,
  MailIcon,
  PhoneIcon,
  TelegramIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/icons";

/**
 * The questions beside the form — admin → Contact Page. Used until the saved
 * settings arrive, and for any question the settings do not carry at all; one
 * an admin has cleared comes back empty and is left out.
 */
const DEFAULT_FAQS = [
  ["How much does delivery cost?", "Delivery is free on orders over {free_shipping} — below that it is a flat {flat_shipping}. We ship across India."],
  ["Can I return a book?", "Yes — if a book arrives damaged, misprinted or is not what you ordered. Request a return from your order page and see our returns policy for the details."],
  ["Do you take bulk or institutional orders?", "Yes. Schools, colleges, libraries and businesses can send us their list using this form (choose “Bulk / institutional order”) and we will reply with availability and pricing."],
  ["Can you find a book that is not listed?", "Often, yes. Send us the title, author and ISBN if you have it, and we will check with our publishers and distributors."],
];

const SUBJECTS = [
  "Order or delivery",
  "Finding a book",
  "Returns & exchanges",
  "Bulk / institutional order",
  "Something else",
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    fetchSettingsClient().then(setSettings);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      await clientApi("/contact", {
        method: "POST",
        body: { ...form, subject: form.subject || undefined },
        token: null,
      });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message.");
      setState("idle");
    }
  }

  const s = (key: string) => (settings[key] as string) ?? "";
  // The same networks as the footer and admin → Contact Page.
  const socials = [
    { label: "Instagram", href: s("social_instagram"), Icon: InstagramMark },
    { label: "Facebook", href: s("social_facebook"), Icon: FacebookIcon },
    { label: "YouTube", href: s("social_youtube"), Icon: YoutubeIcon },
    { label: "X (Twitter)", href: s("social_x"), Icon: XIcon },
    { label: "Telegram", href: s("social_telegram"), Icon: TelegramIcon },
  ].filter((x) => x.href && !/^https?:\/\/(www\.)?[a-z]+\.com\/?$/i.test(x.href));

  // {free_shipping} and {flat_shipping} become the live amounts, so an answer
  // about delivery never goes stale when the rates change.
  const fill = (text: string) =>
    text
      .replaceAll("{free_shipping}", money(settings.free_shipping_threshold))
      .replaceAll("{flat_shipping}", money(settings.flat_shipping));
  const faqs = DEFAULT_FAQS.map(([question, answer], i) => {
    const q = settings[`contact_faq_${i + 1}_question`];
    const a = settings[`contact_faq_${i + 1}_answer`];
    return {
      q: fill(String(q ?? question).trim()),
      a: fill(String(a ?? answer).trim()),
    };
  }).filter((f) => f.q && f.a);

  return (
    <>
      <PageBanner title="Contact Us" crumbs={[{ label: "Contact" }]} />

      {/*
        Three placements rather than source order, so the rail sits above the
        form on a phone — the direct lines used to be the first thing under the
        hero and burying them below a six-field form would have been a
        downgrade — while the desktop layout keeps the form in the wide column.
      */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <aside className="maroon-card relative isolate overflow-hidden p-6 sm:p-7 lg:col-start-2 lg:row-start-1">
          <h2 className="text-[1.3rem] font-semibold text-white">
            {s("contact_studio") || "Reach us directly"}
          </h2>

          <ul className="mt-5 divide-y divide-white/12 border-y border-white/12">
            {settings.support_email && (
            <li>
              <a
                href={`mailto:${settings.support_email}`}
                className="group flex items-center gap-3.5 py-3.5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-rose-400 ring-1 ring-white/15 transition-colors group-hover:bg-white group-hover:text-maroon-800">
                  <MailIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10.5px] font-accent uppercase tracking-[0.16em] text-white/75">
                    Email
                  </span>
                  <span className="block truncate text-[13px] text-white">
                    {settings.support_email}
                  </span>
                </span>
              </a>
            </li>
            )}

            {settings.support_phone && (
            <li>
              <a
                href={`tel:${settings.support_phone.replace(/\s/g, "")}`}
                className="group flex items-center gap-3.5 py-3.5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-rose-400 ring-1 ring-white/15 transition-colors group-hover:bg-white group-hover:text-maroon-800">
                  <PhoneIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10.5px] font-accent uppercase tracking-[0.16em] text-white/75">
                    Call
                  </span>
                  <span className="block truncate text-[13px] text-white">
                    {settings.support_phone}
                  </span>
                </span>
              </a>
            </li>
            )}

          </ul>

          {s("contact_address") && (
            <p className="mt-5 whitespace-pre-line text-[12.5px] leading-relaxed text-white/75">
              {s("contact_address")}
            </p>
          )}

          {s("contact_hours") && (
            <p className="mt-4 flex items-center gap-2.5 text-[12.5px] text-white/75">
              {/* Honey rather than the emerald it was: green carried no meaning
                  the sentence beside it does not already state, and it was the
                  one off-palette colour on the page. */}
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              {s("contact_hours")}
            </p>
          )}

          {s("contact_map_url") && (
            <a
              href={s("contact_map_url")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-[12px] text-white/75 underline underline-offset-4 transition-colors hover:text-white"
            >
              Open in Maps &rarr;
            </a>
          )}

          {socials.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/12 pt-5">
              {socials.map((x) => (
                <a
                  key={x.label}
                  href={x.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={x.label}
                  title={x.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white hover:text-maroon-800"
                >
                  <x.Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          )}
        </aside>

        {state === "done" ? (
          <div className="card px-8 py-16 text-center lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <span className="glyph mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blush-100 text-[22px] text-rose-500">
              ✦
            </span>
            <p className="mt-4 font-serif text-[1.6rem] text-ink">Message received</p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-cocoa">
              Thank you, {form.name.split(" ")[0]} — we&apos;ll reply to {form.email} as soon as we
              can.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/collection"
                className="rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700"
              >
                Browse books
              </Link>
              <button
                onClick={() => {
                  setForm({ name: "", email: "", subject: "", message: "" });
                  setState("idle");
                }}
                className="rounded-full border border-blush-200 px-6 py-2.5 text-[13px] text-cocoa transition-colors hover:bg-blush-100"
              >
                Send another
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="card grid gap-5 p-7 sm:grid-cols-2 sm:p-8 lg:col-start-1 lg:row-span-2 lg:row-start-1"
          >
            <div className="sm:col-span-2">
              <h2 className="font-serif text-[1.3rem] text-ink">Send a message</h2>
              <p className="mt-1 text-[12.5px] text-cocoa">
                Tell us what you need and we&apos;ll get back to you.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-cocoa">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-base"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-cocoa">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-base"
                placeholder="you@example.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[11px] font-medium text-cocoa">
                What is this about?
              </label>
              <div className="flex flex-wrap gap-2">
                {/* Outlined rather than filled when unpicked: as pale blush
                    fills they read as five disabled buttons instead of a
                    choice set, and nothing distinguished "not chosen" from
                    "cannot be chosen". */}
                {SUBJECTS.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    aria-pressed={form.subject === sub}
                    onClick={() => setForm({ ...form, subject: form.subject === sub ? "" : sub })}
                    className={`rounded-full border px-3.5 py-1.5 text-[12px] transition-colors ${
                      form.subject === sub
                        ? "border-rose-600 bg-rose-600 text-white"
                        : "border-blush-200 bg-white text-cocoa hover:border-rose-400 hover:text-ink"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-medium text-cocoa">Message</label>
              <textarea
                required
                rows={6}
                maxLength={2000}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="input-base resize-y"
                placeholder="Tell us how we can help…"
              />
              <p className="mt-1 text-right text-[10.5px] text-fog">{form.message.length}/2000</p>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 sm:col-span-2">
                {error}
              </p>
            )}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={state === "busy"}
                className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
              >
                {state === "busy" && <Spinner className="h-4 w-4" />} Send Message
              </button>
            </div>
          </form>
        )}

        <div id="faq" className="card p-6 lg:col-start-2 lg:row-start-2">
          <h2 className="font-serif text-[1.2rem] text-ink">Frequently Asked</h2>
          <div className="mt-3 divide-y divide-blush-100">
            {faqs.map((f) => (
              <details key={f.q} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12.5px] font-medium text-ink transition-colors group-open:text-rose-600">
                  {f.q}
                  {/* A ringed marker rather than a bare "+" glyph: at 13px and
                      fog grey it was easy to miss that these rows opened at
                      all, and nothing gave the pointer a target. */}
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-blush-200 text-[13px] leading-none text-fog transition-all group-open:rotate-45 group-open:border-rose-400 group-open:text-rose-600 group-hover:border-rose-300"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[12px] leading-relaxed text-cocoa">{f.a}</p>
              </details>
            ))}
          </div>

          <p
            id="shipping"
            className="mt-4 rounded-xl bg-blush-50 p-3.5 text-[11.5px] leading-relaxed text-cocoa"
          >
            <span className="font-semibold text-ink">Shipping:</span> free over{" "}
            {money(settings.free_shipping_threshold)}, otherwise {money(settings.flat_shipping)}{" "}
            flat.
            <span id="returns" className="mt-1 block">
              <span className="font-semibold text-ink">Returns:</span> damaged, misprinted or wrong
              books — see our <Link href="/pages/terms" className="text-rose-600 underline">returns policy</Link>.
            </span>
          </p>

          <Link
            href="/pages/faq"
            className="mt-3 inline-block text-[12px] text-rose-600 hover:underline"
          >
            Read the full FAQ &rarr;
          </Link>
        </div>
      </div>
    </>
  );
}
