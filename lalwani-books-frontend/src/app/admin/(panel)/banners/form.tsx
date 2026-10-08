"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ApiError, apiUpload } from "@/admin/lib/api";
import { OfferBadge, Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";

export interface BannerFormValues {
  title: string;
  subtitle: string;
  badge_text: string;
  description: string;
  button_text: string;
  button_url: string;
  sort_order: string;
  is_active: boolean;
  show_text: boolean;
}

export const EMPTY_BANNER: BannerFormValues = {
  title: "",
  subtitle: "",
  badge_text: "",
  description: "",
  button_text: "",
  button_url: "",
  sort_order: "",
  is_active: true,
  show_text: true,
};

const FIELDS: {
  key: keyof BannerFormValues;
  label: string;
  placeholder: string;
  hint?: string;
  span?: boolean;
}[] = [
  { key: "title", label: "Headline", placeholder: "Books For Every Reader", hint: "The big heading on the right of the slide." },
  {
    key: "subtitle",
    label: "Underlined words",
    placeholder: "Every Reader",
    hint: "Words from the headline to underline in coral — must match the headline exactly. Leave empty for no underline.",
  },
  {
    key: "badge_text",
    label: "Small line above the headline",
    placeholder: "New arrivals · 20% off",
    hint: "Optional, shown in small capitals.",
  },
  {
    key: "description",
    label: "Description",
    placeholder: "One coral line under the headline…",
    span: true,
  },
  { key: "button_text", label: "Button text", placeholder: "Shop Now" },
  { key: "button_url", label: "Button link", placeholder: "/collection" },
];

/** The three cover slots of the hero stack, in upload-field order. */
const SLOTS = [
  { field: "image", label: "Cover 1", where: "front, centre" },
  { field: "image_2", label: "Cover 2", where: "left" },
  { field: "image_3", label: "Cover 3", where: "right" },
] as const;

type Slot = { file: File | null; preview: string | null; remove: boolean };

/**
 * Create/edit form for one hero banner, on its own page — the cover images
 * sit next to the copy they belong to instead of being a separate button in
 * the list.
 */
export function BannerForm({
  initial,
  bannerId,
  currentCovers = [null, null, null],
}: {
  initial: BannerFormValues;
  /** Omitted when creating. */
  bannerId?: number;
  /** The saved covers — front, left, right — null where a slot is empty. */
  currentCovers?: (string | null)[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<BannerFormValues>(initial);
  const [slots, setSlots] = useState<Slot[]>(() => SLOTS.map(() => ({ file: null, preview: null, remove: false })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function set<K extends keyof BannerFormValues>(key: K, value: BannerFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setSlot(i: number, patch: Partial<Slot>) {
    setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function pick(i: number, f: File | undefined) {
    if (!f) return;
    setSlot(i, { file: f, preview: URL.createObjectURL(f), remove: false });
  }

  function undo(i: number) {
    setSlot(i, { file: null, preview: null, remove: false });
    const input = inputs.current[i];
    if (input) input.value = "";
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      // Send blanks too, so clearing a field on edit actually clears it.
      (["title", "subtitle", "badge_text", "description", "button_text", "button_url"] as const).forEach((k) =>
        fd.append(k, form[k])
      );
      if (form.sort_order) fd.append("sort_order", form.sort_order);
      fd.append("is_active", form.is_active ? "1" : "0");
      fd.append("show_text", form.show_text ? "1" : "0");
      SLOTS.forEach((slot, i) => {
        if (slots[i].file) fd.append(slot.field, slots[i].file as File);
        else if (slots[i].remove) fd.append(`remove_${slot.field}`, "1");
      });

      await apiUpload(bannerId ? `/admin/banners/${bannerId}` : "/admin/banners", fd);
      router.push("/admin/banners");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      <section className="card p-7">
        <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
          Cover images (up to three)
        </p>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-fog">
          The left side of the slide shows three book covers fanned out and gently floating — Cover 1
          in front, Cover 2 behind it on the left, Cover 3 on the right. Portrait images in book-cover
          shape look best: 600×840px or larger, JPG, PNG or WebP, max 4MB each. Any slot you leave
          empty is filled with one of your Featured books&rsquo; covers, so one upload is enough.
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {SLOTS.map((slot, i) => {
            const state = slots[i];
            const saved = currentCovers[i] ?? null;
            const shown = state.preview || (state.remove ? null : saved);
            return (
              <div key={slot.field} className="flex flex-col gap-2">
                <p className="text-[11px] font-medium text-cocoa">
                  {slot.label} <span className="text-fog">· {slot.where}</span>
                </p>
                <div className="relative mx-auto aspect-[5/7] w-full max-w-[150px] overflow-hidden rounded-xl border border-blush-200 bg-blush-100">
                  {shown ? (
                    <Image src={shown} alt={`${slot.label} preview`} fill sizes="150px" className="object-cover" unoptimized />
                  ) : (
                    <span className="flex h-full items-center justify-center px-3 text-center text-[11px] leading-snug text-fog">
                      Empty — a featured book&rsquo;s cover is shown
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => inputs.current[i]?.click()}
                    className="rounded-full border border-blush-200 px-3.5 py-1.5 text-[12px] text-cocoa hover:bg-blush-100"
                  >
                    {shown ? "Replace" : "Choose image"}
                  </button>
                  {state.file || state.remove ? (
                    <button
                      type="button"
                      onClick={() => undo(i)}
                      className="rounded-full px-3 py-1.5 text-[12px] text-fog hover:bg-blush-100"
                    >
                      Undo
                    </button>
                  ) : (
                    saved && (
                      <button
                        type="button"
                        onClick={() => setSlot(i, { remove: true })}
                        className="rounded-full px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )
                  )}
                </div>
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => pick(i, e.target.files?.[0])}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="card grid gap-5 p-7 sm:grid-cols-2">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
            Slide copy
          </p>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-cocoa">
            <input
              type="checkbox"
              checked={form.show_text}
              onChange={(e) => set("show_text", e.target.checked)}
              className="h-4 w-4 accent-rose-600"
            />
            Show the text beside the covers
          </label>
        </div>

        {!form.show_text && (
          <p className="rounded-xl bg-blush-50 px-4 py-2.5 text-[11.5px] text-cocoa sm:col-span-2">
            Text is off — this slide shows the covers only. The fields below stay saved for later.
          </p>
        )}

        {FIELDS.map((f) => (
          <div key={f.key} className={f.span ? "sm:col-span-2" : ""}>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">{f.label}</label>
            <input
              value={form[f.key] as string}
              onChange={(e) => set(f.key, e.target.value as never)}
              className="input-base"
              placeholder={f.placeholder}
            />
            {f.hint && <p className="mt-1 text-[11px] text-fog">{f.hint}</p>}
            {/* The badge lands on a photo, so preview it on a dark ground
                rather than on the form's cream card. */}
            {f.key === "badge_text" && form.badge_text.trim() !== "" && (
              <div className="mt-2 rounded-xl bg-maroon-900 px-3 py-3">
                <OfferBadge>{form.badge_text}</OfferBadge>
              </div>
            )}
          </div>
        ))}

        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Sort order</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => set("sort_order", e.target.value)}
            className="input-base"
            placeholder="Auto"
          />
          <p className="mt-1 text-[11px] text-fog">Lower numbers show first in the slider.</p>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-cocoa">Status</label>
          <Select
            value={form.is_active ? "1" : "0"}
            onChange={(v) => set("is_active", v === "1")}
            options={[
              { value: "1", label: "Live on the storefront" },
              { value: "0", label: "Hidden" },
            ]}
            ariaLabel="Status"
            variant="field"
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />}
          {bannerId ? "Save Changes" : "Create Banner"}
        </button>
        <Link
          href="/admin/banners"
          className="rounded-full border border-blush-200 px-6 py-2.5 text-[12.5px] text-cocoa hover:bg-blush-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
