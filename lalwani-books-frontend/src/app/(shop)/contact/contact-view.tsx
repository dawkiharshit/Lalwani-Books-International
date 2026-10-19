"use client";

import { PageBanner } from "@/components/PageBanner";
import Link from "next/link";
import { useState } from "react";
import { clientApi } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { money } from "@/lib/format";
import { WHATSAPP_DISPLAY, whatsappLink } from "@/lib/contact";
import type { StoreSettings } from "@/lib/settings";
import { Doodle, DottedPaper, FoldedPage, Sparkle } from "@/components/home/doodles";
import {
  ArrowRight,
  BookStackIcon,
  CheckIcon,
  ClockIcon,
  FacebookIcon,
  InstagramMark,
  MailIcon,
  MapPinIcon,
  MessageIcon,
  PhoneIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  TelegramIcon,
  TruckIcon,
  UserIcon,
  WhatsAppIcon,
  XIcon,
  YoutubeIcon,
} from "@/components/icons";

/**
 * The questions beside the form — admin → Contact Page. Used for any
 * question the settings do not carry at all; one an admin has cleared comes
 * back empty and is left out.
 */
const DEFAULT_FAQS = [
  ["How much does delivery cost?", "Delivery is free on orders over {free_shipping} — below that it is a flat {flat_shipping}. We ship across India."],
  ["Can I return a book?", "Yes — if a book arrives damaged, misprinted or is not what you ordered. Request a return from your order page and see our returns policy for the details."],
  ["Do you take bulk or institutional orders?", "Yes. Schools, colleges, libraries and businesses can send us their list using this form (choose “Bulk / institutional order”) and we will reply with availability and pricing."],
  ["Can you find a book that is not listed?", "Often, yes. Send us the title, author and ISBN if you have it, and we will check with our publishers and distributors."],
];

/** What the message is about; the label is what is saved with it. */
const SUBJECTS = [
  { label: "Order or delivery", Icon: TruckIcon },
  { label: "Finding a book", Icon: SearchIcon },
  { label: "Returns & exchanges", Icon: RefreshIcon },
  { label: "Bulk / institutional order", Icon: BookStackIcon },
  { label: "Something else", Icon: MessageIcon },
];

/**
 * A shortcut tile under the form: icon, title and one line. A row on a phone
 * (the tiles stack) and on a wide screen; between those, three tiles share a
 * narrower card, so the icon sits above the words instead of squeezing them.
 */
const TILE =
  "group flex h-full items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-blush-200 transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-soft hover:ring-rose-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:flex-col sm:items-start sm:p-3.5 xl:flex-row xl:items-center xl:p-3";
/** The arrow that slides in on hover — only where the tile is a row. */
const TILE_ARROW = "h-4 w-4 shrink-0 text-rose-500 opacity-0 transition-opacity group-hover:opacity-100 sm:hidden xl:block";

/**
 * The contact page itself, drawn with the shop's saved details from the
 * server (page.tsx), so the first paint already shows the real address and
 * phone — nothing swaps in afterwards, and search engines read the real ones.
 */
export function ContactView({ settings }: { settings: StoreSettings }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

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

  // The same greeting as the floating WhatsApp button.
  const hello = `Hello ${settings.site_name || "Lalwani Books International"}! I have a question.`;

  return (
    <>
      <PageBanner title="Contact Us" crumbs={[{ label: "Contact" }]} />

      {/*
        Three placements rather than source order, so the rail sits above the
        form on a phone — the direct lines used to be the first thing under the
        hero and burying them below a six-field form would have been a
        downgrade — while the desktop layout keeps the form in the wide column.
        On a computer every card stretches to its row, so the two columns
        start and end on the same lines.
      */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
        <aside className="relative isolate overflow-hidden rounded-[var(--radius-card)] bg-pine-900 p-6 text-white sm:p-7 lg:col-start-2 lg:row-start-1 lg:flex lg:flex-col">
          {/* The same deep navy, gold glow and dotted paper as the Books for
              Institutions panel. Decorative only. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,rgba(232,176,75,0.18),transparent_65%),radial-gradient(70%_60%_at_0%_100%,rgba(141,177,220,0.16),transparent_65%)]" />
            <DottedPaper dot="rgba(232,238,246,0.10)" />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mustard">Reach us directly</p>
          <h2 className="mt-2 text-[1.3rem] font-semibold leading-snug text-white">
            {s("contact_studio") || settings.site_name || "Lalwani Books International"}
          </h2>

          <ul className="mt-5 divide-y divide-white/12 border-y border-white/12">
            {settings.support_email && (
              <li>
                <a href={`mailto:${settings.support_email}`} className="group flex items-center gap-3.5 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-rose-400 ring-1 ring-white/15 transition-colors group-hover:bg-white group-hover:text-maroon-800">
                    <MailIcon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10.5px] font-accent uppercase tracking-[0.16em] text-white/75">Email</span>
                    <span className="block truncate text-[13px] text-white">{settings.support_email}</span>
                  </span>
                </a>
              </li>
            )}

            {settings.support_phone && (
              <li>
                <a href={`tel:${settings.support_phone.replace(/\s/g, "")}`} className="group flex items-center gap-3.5 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-rose-400 ring-1 ring-white/15 transition-colors group-hover:bg-white group-hover:text-maroon-800">
                    <PhoneIcon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10.5px] font-accent uppercase tracking-[0.16em] text-white/75">Call</span>
                    <span className="block truncate text-[13px] text-white">{settings.support_phone}</span>
                  </span>
                </a>
              </li>
            )}
          </ul>

          {s("contact_address") && (
            <p className="mt-5 flex gap-3 text-[12.5px] leading-relaxed text-white/80">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-mustard" />
              <span className="whitespace-pre-line">{s("contact_address")}</span>
            </p>
          )}

          {s("contact_hours") && (
            <p className="mt-3 flex items-center gap-3 text-[12.5px] text-white/80">
              <ClockIcon className="h-4 w-4 shrink-0 text-mustard" />
              {s("contact_hours")}
            </p>
          )}

          {s("contact_map_url") && (
            <a
              href={s("contact_map_url")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white hover:text-maroon-800"
            >
              Open in Maps <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}

          {socials.length > 0 && (
            <>
              {/* Keeps the social links at the foot of the panel when it is
                  stretched to the height of the form beside it. */}
              <div aria-hidden className="hidden lg:block lg:flex-1" />
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/12 pt-5">
                <span className="mr-1 text-[11px] font-accent uppercase tracking-[0.16em] text-white/75">Follow us</span>
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
            </>
          )}
        </aside>

        <section
          aria-labelledby="contact-form-heading"
          className="card flex flex-col overflow-hidden lg:col-start-1 lg:row-span-2 lg:row-start-1"
        >
          {/* Heading band: pale blue with dotted paper and a couple of the home
              page's line drawings, so the form opens like the rest of the shop. */}
          <div className="relative overflow-hidden border-b border-blush-200 bg-blush-100 px-6 py-6 sm:px-8 sm:py-7">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(55%_120%_at_100%_0%,rgba(232,176,75,0.20),transparent_70%)]" />
              <DottedPaper dot="rgba(4,43,82,0.10)" />
              <Doodle className="right-8 top-4 hidden w-14 rotate-6 sm:block" viewBox="0 0 80 100">
                <FoldedPage stroke="#042b52" opacity={0.22} />
              </Doodle>
              <Sparkle className="right-28 top-6 hidden w-4 sm:block" delay="-2s" fill="#e8b04b" opacity={0.9} />
              <Sparkle className="bottom-5 right-20 hidden w-3 sm:block" delay="-4s" fill="#042b52" opacity={0.35} />
            </div>

            <div className="relative flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-[0_12px_24px_-12px_rgba(4,43,82,0.8)]">
                <MessageIcon className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 sm:pr-24">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-500">Write to us</p>
                <h2 id="contact-form-heading" className="mt-1 font-serif text-[1.45rem] leading-tight text-ink sm:text-[1.7rem]">
                  Send us a message
                </h2>
                <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-cocoa">
                  An order, a book you can&rsquo;t find, a return or a bulk order — tell us what you need and
                  we&rsquo;ll get back to you by email.
                </p>
                {s("contact_hours") && (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-medium text-ink ring-1 ring-blush-200">
                    <ClockIcon className="h-3.5 w-3.5 text-rose-500" />
                    {s("contact_hours")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {state === "done" ? (
            <div role="status" className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center sm:px-8">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-[0_12px_24px_-12px_rgba(22,101,52,0.9)]">
                <CheckIcon className="h-7 w-7" strokeWidth={2.6} />
              </span>
              <p className="mt-4 font-serif text-[1.5rem] text-ink">Message received</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-cocoa">
                Thank you, {form.name.split(" ")[0]} — we&apos;ll reply to {form.email} as soon as we can.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/collection"
                  className="rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700"
                >
                  Browse books
                </Link>
                <button
                  type="button"
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
            // On a computer the message box takes whatever height is left, so
            // the card fills its column without a gap under the button.
            <form
              onSubmit={submit}
              className="grid flex-1 content-start gap-5 px-6 py-6 sm:grid-cols-2 sm:px-8 sm:py-7 lg:grid-rows-[auto_auto_1fr]"
            >
              <div>
                <label htmlFor="contact-name" className="mb-1.5 block text-[11.5px] font-medium text-cocoa">Name</label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
                  <input
                    id="contact-name"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-base pl-10"
                    placeholder="Your name"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="contact-email" className="mb-1.5 block text-[11.5px] font-medium text-cocoa">Email</label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fog" />
                  <input
                    id="contact-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-base pl-10"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <p id="contact-topic" className="mb-2 block text-[11.5px] font-medium text-cocoa">
                  What is this about?
                </p>
                <div role="group" aria-labelledby="contact-topic" className="flex flex-wrap gap-2">
                  {/* Outlined rather than filled when unpicked: as pale blush
                      fills they read as five disabled buttons instead of a
                      choice set. The picked one turns navy with a tick. */}
                  {SUBJECTS.map(({ label, Icon }) => {
                    const on = form.subject === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setForm({ ...form, subject: on ? "" : label })}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] transition-colors ${
                          on
                            ? "border-rose-600 bg-rose-600 text-white shadow-[0_8px_18px_-10px_rgba(4,43,82,0.9)]"
                            : "border-blush-200 bg-white text-cocoa hover:border-rose-400 hover:text-ink"
                        }`}
                      >
                        {on ? (
                          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                        ) : (
                          <Icon className="h-3.5 w-3.5 text-rose-500" strokeWidth={1.9} />
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2 lg:flex lg:flex-col">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <label htmlFor="contact-message" className="text-[11.5px] font-medium text-cocoa">Message</label>
                  <span className="text-[10.5px] tabular-nums text-fog">{form.message.length}/2000</span>
                </div>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  maxLength={2000}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="input-base min-h-[8.5rem] resize-y lg:flex-auto"
                  placeholder="Tell us how we can help — for a book, its title, author or ISBN helps…"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600 sm:col-span-2">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 sm:col-span-2">
                <button
                  type="submit"
                  disabled={state === "busy"}
                  className="group inline-flex items-center gap-2 rounded-full bg-rose-600 px-7 py-3 text-[13px] font-semibold text-white shadow-[0_12px_24px_-12px_rgba(4,43,82,0.8)] transition-colors hover:bg-rose-700 disabled:opacity-60"
                >
                  {state === "busy" && <Spinner className="h-4 w-4" />}
                  Send message
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
                <p className="flex items-center gap-2 text-[11.5px] text-fog">
                  <ShieldIcon className="h-4 w-4 shrink-0 text-rose-500" />
                  We use your details only to reply to you.
                </p>
              </div>
            </form>
          )}

          {/* Faster routes for the commonest questions. */}
          <div className="border-t border-blush-200 bg-blush-50 px-6 py-5 sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fog">Need a quicker answer?</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              <li>
                <a href={whatsappLink(hello)} target="_blank" rel="noopener noreferrer nofollow" className={TILE}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#178F45] text-white">
                    <WhatsAppIcon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">Chat on WhatsApp</span>
                    <span className="block truncate text-[11.5px] text-fog">{WHATSAPP_DISPLAY}</span>
                  </span>
                  <ArrowRight className={TILE_ARROW} />
                </a>
              </li>
              <li>
                <Link href="/track-order" className={TILE}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
                    <TruckIcon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">Track your order</span>
                    <span className="block truncate text-[11.5px] text-fog">Order number + email</span>
                  </span>
                  <ArrowRight className={TILE_ARROW} />
                </Link>
              </li>
              <li>
                <Link href="/institutions" className={TILE}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mustard text-rose-800">
                    <BookStackIcon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">Bulk orders</span>
                    <span className="block truncate text-[11.5px] text-fog">Schools &amp; libraries</span>
                  </span>
                  <ArrowRight className={TILE_ARROW} />
                </Link>
              </li>
            </ul>
          </div>
        </section>

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
