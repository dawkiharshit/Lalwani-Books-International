"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, clientApi } from "@/admin/lib/api";
import type { Category } from "@/admin/lib/types";
import { Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";
import { DEAL_THEMES, type DealTheme } from "@/lib/deal-themes";

export interface DealFormValues {
  eyebrow: string;
  heading: string;
  highlight: string;
  description: string;
  ends_label: string;
  /** A datetime-local value; "" with `dated` off means every week to Sunday midnight. */
  ends_at: string;
  dated: boolean;
  button_text: string;
  button_url: string;
  /** "" = every reduced book in the shop. */
  category_id: string;
  theme: DealTheme;
  sort_order: string;
  is_active: boolean;
}

export const EMPTY_DEAL: DealFormValues = {
  eyebrow: "",
  heading: "",
  highlight: "",
  description: "",
  ends_label: "Ends Sunday midnight",
  ends_at: "",
  dated: false,
  button_text: "",
  button_url: "",
  category_id: "",
  theme: "coral",
  sort_order: "",
  is_active: true,
};

/** An ISO time as a datetime-local input value, in this browser's time zone. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Stands in for the real saving in the preview — the site fills in the best one on the deal's shelf. */
const SAMPLE_SAVING = "25";

function previewHeading(heading: string, highlight: string) {
  const fill = (text: string) => text.split("{discount}").join(SAMPLE_SAVING);
  const at = heading.indexOf("{discount}");
  if (at >= 0) return { lead: fill(heading.slice(0, at)), marked: fill(heading.slice(at)), tail: "" };
  const words = highlight.trim();
  const i = words ? heading.toLowerCase().indexOf(words.toLowerCase()) : -1;
  if (i < 0) return { lead: heading, marked: "", tail: "" };
  return { lead: heading.slice(0, i), marked: heading.slice(i, i + words.length), tail: heading.slice(i + words.length) };
}

/**
 * Create/edit form for one deal, on its own page. The preview beside the
 * colour choice is drawn with the storefront's own colourways, so what is
 * picked here is what the home page shows.
 */
export function DealForm({ initial, dealId }: { initial: DealFormValues; dealId?: number }) {
  const router = useRouter();
  const [form, setForm] = useState<DealFormValues>(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: Category[] }>("/categories", { token: null, cartToken: null })
      .then((res) => setCategories(res.data))
      .catch(() => setError("Could not load the shelves. Check that the API is running."));
  }, []);

  function set<K extends keyof DealFormValues>(key: K, value: DealFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.heading.trim()) return setError("Give the deal a heading.");
    if (form.dated && !form.ends_at) return setError("Pick the date and time the deal ends, or choose “Every week”.");
    if (form.button_text.trim() && !form.button_url.trim()) return setError("Add the page the button opens, or clear the button text.");

    setBusy(true);
    try {
      const payload = {
        eyebrow: form.eyebrow.trim(),
        heading: form.heading.trim(),
        highlight: form.highlight.trim(),
        description: form.description.trim(),
        ends_label: form.ends_label.trim(),
        ends_at: form.dated && form.ends_at ? new Date(form.ends_at).toISOString() : null,
        button_text: form.button_text.trim(),
        button_url: form.button_url.trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        theme: form.theme,
        is_active: form.is_active,
        sort_order: form.sort_order === "" ? null : Number(form.sort_order),
      };
      await clientApi(dealId ? `/admin/deals/${dealId}` : "/admin/deals", { method: dealId ? "PUT" : "POST", body: payload });
      router.push("/admin/deals");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
      setBusy(false);
    }
  }

  const theme = DEAL_THEMES[form.theme];
  const { lead, marked, tail } = previewHeading(form.heading || "Save up to {discount}% on books", form.highlight);
  const field = "mb-1 block text-[11px] font-medium text-cocoa";
  const hint = "mt-1 text-[11px] leading-relaxed text-fog";

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <section className="card grid gap-5 p-7 sm:grid-cols-2">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">The offer</p>
        <div>
          <label className={field}>Small line above the heading</label>
          <input value={form.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} className="input-base" placeholder="This week only" maxLength={60} />
        </div>
        <div>
          <label className={field}>Words to underline</label>
          <input value={form.highlight} onChange={(e) => set("highlight", e.target.value)} className="input-base" placeholder="Optional" maxLength={80} />
          <p className={hint}>Only used when the heading has no {"{discount}"} — words from the heading, exactly as written.</p>
        </div>
        <div className="sm:col-span-2">
          <label className={field}>Heading</label>
          <input value={form.heading} onChange={(e) => set("heading", e.target.value)} className="input-base" placeholder="Save up to {discount}% on books" maxLength={160} required />
          <p className={hint}>
            Write {"{discount}"} where the saving should appear — the site puts in the best saving among this deal&rsquo;s books
            and underlines from there to the end.
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className={field}>Text under the heading</label>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="input-base" rows={2} maxLength={300} placeholder="Hand-picked titles at reduced prices…" />
        </div>
      </section>

      <section className="card grid gap-5 p-7 sm:grid-cols-2">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">Books and countdown</p>
        <div className="sm:col-span-2">
          <label className={field}>Which books</label>
          <Select
            value={form.category_id}
            onChange={(v) => set("category_id", v)}
            options={[{ value: "", label: "Every reduced book in the shop" }, ...categories.map((c) => ({ value: String(c.id), label: `${c.name} only` }))]}
            ariaLabel="Which books"
            variant="field"
          />
          <p className={hint}>
            The panel lists this shelf&rsquo;s three biggest savings. Books count as reduced when their Compare-at price is higher
            than their price; a deal whose shelf has none is skipped on the site until it has.
          </p>
        </div>
        <div>
          <label className={field}>Countdown runs to</label>
          <Select
            value={form.dated ? "date" : "weekly"}
            onChange={(v) => set("dated", v === "date")}
            options={[
              { value: "weekly", label: "Sunday midnight, every week" },
              { value: "date", label: "A date I choose" },
            ]}
            ariaLabel="Countdown runs to"
            variant="field"
          />
        </div>
        <div>
          <label className={field}>Countdown label</label>
          <input value={form.ends_label} onChange={(e) => set("ends_label", e.target.value)} className="input-base" placeholder="Ends Sunday midnight" maxLength={60} />
        </div>
        {form.dated && (
          <div className="sm:col-span-2">
            <label className={field}>Deal ends at</label>
            <input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} className="input-base max-w-xs" />
            <p className={hint}>The deal leaves the home page by itself once this time has passed.</p>
          </div>
        )}
      </section>

      <section className="card grid gap-5 p-7 sm:grid-cols-2">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog sm:col-span-2">Button (optional)</p>
        <div>
          <label className={field}>Button text</label>
          <input value={form.button_text} onChange={(e) => set("button_text", e.target.value)} className="input-base" placeholder="Shop fiction" maxLength={40} />
        </div>
        <div>
          <label className={field}>Button link</label>
          <input value={form.button_url} onChange={(e) => set("button_url", e.target.value)} className="input-base" placeholder="/collection?category=fiction" maxLength={300} />
          <p className={hint}>A page on this site starting with /, or a web address starting with https://.</p>
        </div>
      </section>

      <section className="card grid gap-6 p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">Colour</p>
          <div role="radiogroup" aria-label="Colour" className="mt-4 grid grid-cols-2 gap-3">
            {(Object.keys(DEAL_THEMES) as DealTheme[]).map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={form.theme === key}
                onClick={() => set("theme", key)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-[12.5px] transition-colors ${
                  form.theme === key ? "border-rose-500 bg-blush-50 text-ink" : "border-blush-200 text-cocoa hover:bg-blush-50"
                }`}
              >
                <span className={`h-8 w-8 shrink-0 rounded-lg ${DEAL_THEMES[key].panel}`} />
                {DEAL_THEMES[key].label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <label className={field}>Order</label>
              <input type="number" min={0} max={9999} value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="input-base" placeholder="Auto" />
              <p className={hint}>Lower numbers show first.</p>
            </div>
            <div>
              <label className={field}>Status</label>
              <Select
                value={form.is_active ? "1" : "0"}
                onChange={(v) => set("is_active", v === "1")}
                options={[
                  { value: "1", label: "Live on the site" },
                  { value: "0", label: "Hidden" },
                ]}
                ariaLabel="Status"
                variant="field"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">Preview</p>
          <div className={`relative mt-4 overflow-hidden rounded-2xl px-6 py-7 text-white ${theme.panel}`}>
            <span aria-hidden className={`absolute -right-10 -top-16 h-36 w-36 rounded-full ${theme.blobA}`} />
            <div className="relative">
              {form.eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90">{form.eyebrow}</p>}
              <p className="mt-2 text-[1.45rem] font-semibold leading-tight">
                {lead}
                {marked && (
                  <span className="relative inline-block">
                    {marked}
                    <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className={`absolute -bottom-1 left-0 h-2 w-full ${theme.underline}`}>
                      <path d="M3 8c40-6 110-8 194-3" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
                {tail}
              </p>
              {form.description && <p className="mt-3 text-[12px] text-white/90">{form.description.split("{discount}").join(SAMPLE_SAVING)}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {form.button_text && (
                  <span className={`rounded-full px-4 py-2 text-[11.5px] font-semibold ${theme.button}`}>{form.button_text}</span>
                )}
                <span className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold tabular-nums ${theme.timer}`}>02 : 14 : 36 : 09</span>
                {form.ends_label && <span className="text-[11px] font-semibold text-white/90">{form.ends_label}</span>}
              </div>
            </div>
          </div>
          <p className={hint}>{SAMPLE_SAVING}% stands in for the real saving, which the site works out from the deal&rsquo;s books.</p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button disabled={busy} className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60">
          {busy && <Spinner className="h-4 w-4" />}
          {dealId ? "Save Changes" : "Create Deal"}
        </button>
        <Link href="/admin/deals" className="rounded-full border border-blush-200 px-6 py-2.5 text-[12.5px] text-cocoa hover:bg-blush-100">
          Cancel
        </Link>
      </div>
    </form>
  );
}
