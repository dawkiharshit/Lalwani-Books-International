"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientApi, ApiError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";
import { SettingImage } from "./settings-image";

export interface SettingField {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "number" | "textarea" | "toggle" | "select";
  options?: { value: string; label: string }[];
  rows?: number;
  placeholder?: string;
  span?: boolean;
}

/** An image upload that sits at the top of a section, next to its text. */
export interface SettingImageField {
  settingKey: string;
  label: string;
  hint?: string;
  aspect?: "landscape" | "square" | "portrait";
}

/**
 * Shared editor for any slice of the key-value Settings store. Each admin
 * screen (CTA banner, popup, stats, branding, about, pages) is this form
 * with a different field list — the API is one endpoint for all of them.
 */
export function SettingsForm({
  heading,
  blurb,
  sections,
}: {
  heading: string;
  blurb?: string;
  sections: {
    /** Anchor for links straight to this section, e.g. /admin/shipping#return-address. */
    id?: string;
    title?: string;
    note?: string;
    /** The admin screen that manages this part of the site, shown beside the title. */
    link?: { href: string; label: string };
    images?: SettingImageField[];
    fields: SettingField[];
  }[];
}) {
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const keys = sections.flatMap((s) => s.fields.map((f) => f.key));

  useEffect(() => {
    clientApi<{ data: Record<string, string> }>("/admin/settings")
      .then((res) => setForm(res.data))
      .catch(() => setError("Could not load settings."));
  }, []);

  // A link to a section (/admin/shipping#return-address) lands on it. The
  // sections are only drawn once the settings arrive, so the browser's own
  // jump to the anchor finds nothing; do it then, with a brief glow.
  const loaded = form !== null;
  useEffect(() => {
    if (!loaded) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    el.animate(
      [{ boxShadow: "0 0 0 3px rgba(246, 93, 78, 0.5)" }, { boxShadow: "0 0 0 3px rgba(246, 93, 78, 0)" }],
      { duration: 2000, easing: "ease-out" }
    );
  }, [loaded]);

  function set(key: string, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      // Send only the keys this screen owns — never clobber other sections.
      const body: Record<string, string> = {};
      keys.forEach((k) => (body[k] = form[k] ?? ""));
      const res = await clientApi<{ data: Record<string, string> }>("/admin/settings", {
        method: "PUT",
        body,
      });
      setForm(res.data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!form)
    return (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> {error || "Loading..."}
      </div>
    );

  const render = (f: SettingField) => {
    const common = "input-base";
    if (f.type === "toggle" || f.type === "select") {
      const options =
        f.options ?? [
          { value: "1", label: "Enabled" },
          { value: "0", label: "Disabled" },
        ];
      return (
        <Select
          value={String(form[f.key] ?? "")}
          onChange={(v) => set(f.key, v)}
          options={options}
          ariaLabel={f.label}
          buttonClassName={`${common} flex cursor-pointer items-center justify-between gap-2 text-left`}
        />
      );
    }
    if (f.type === "textarea") {
      return (
        <textarea
          rows={f.rows ?? 4}
          value={form[f.key] ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
          className={`${common} resize-y`}
          placeholder={f.placeholder}
        />
      );
    }
    return (
      <input
        type={f.type === "number" ? "number" : "text"}
        value={form[f.key] ?? ""}
        onChange={(e) => set(f.key, e.target.value)}
        className={common}
        placeholder={f.placeholder}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">{heading}</h1>
        {blurb && <p className="mt-1 text-[12px] text-fog">{blurb}</p>}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
      {saved && <p className="rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">Saved — refresh the storefront to see it.</p>}

      <form onSubmit={save} className="flex flex-col gap-5">
        {sections.map((section, si) => (
          <div key={section.title ?? si} id={section.id} className="card grid scroll-mt-6 gap-5 p-7 sm:grid-cols-2">
            {(section.title || section.link) && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 sm:col-span-2">
                {section.title && (
                  <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">{section.title}</p>
                )}
                {section.link && (
                  <Link href={section.link.href} className="text-[12px] font-semibold text-rose-600 hover:underline">
                    {section.link.label} →
                  </Link>
                )}
              </div>
            )}
            {section.note && (
              <p className="-mt-2 text-[12px] leading-relaxed text-fog sm:col-span-2">{section.note}</p>
            )}
            {section.images?.map((img) => (
              <div key={img.settingKey} className="sm:col-span-2">
                <SettingImage
                  settingKey={img.settingKey}
                  label={img.label}
                  hint={img.hint}
                  aspect={img.aspect}
                />
              </div>
            ))}
            {section.fields.map((f) => (
              <div key={f.key} className={f.span || f.type === "textarea" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-[11px] font-medium text-cocoa">{f.label}</label>
                {render(f)}
                {f.hint && <p className="mt-1 text-[11px] text-fog">{f.hint}</p>}
              </div>
            ))}
          </div>
        ))}

        <div>
          <button
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />} Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
