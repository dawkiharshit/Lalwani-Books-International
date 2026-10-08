"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiUpload, clientApi } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";

/**
 * Upload widget for any setting that stores an image path.
 * Reads and writes the value itself, so it can sit beside a SettingsForm
 * without the two fighting over the same save button.
 */
export function SettingImage({
  settingKey,
  label,
  hint,
  aspect = "landscape",
}: {
  settingKey: string;
  label: string;
  hint?: string;
  aspect?: "landscape" | "square" | "portrait";
}) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clientApi<{ data: Record<string, string> }>("/admin/settings")
      .then((res) => setValue(res.data[settingKey] ?? ""))
      .catch(() => setValue(""));
  }, [settingKey]);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await apiUpload<{ data: Record<string, string> }>(
        `/admin/settings/image/${settingKey}`,
        body
      );
      setValue(res.data[settingKey] ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!confirm(`Remove the ${label.toLowerCase()}?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await clientApi<{ data: Record<string, string> }>(
        `/admin/settings/image/${settingKey}`,
        { method: "DELETE" }
      );
      setValue(res.data[settingKey] ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove the image.");
    } finally {
      setBusy(false);
    }
  }

  // The preview matches the crop the hint asks for, so a portrait slot is not
  // previewed in a landscape frame.
  const box = {
    square: "h-28 w-28",
    portrait: "h-36 w-28",
    landscape: "h-28 w-44",
  }[aspect];

  return (
    <div className="rounded-xl border border-blush-150 bg-blush-50/40 p-4">
      <p className="mb-2.5 text-[11px] font-medium text-cocoa">{label}</p>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className={`${box} shrink-0 overflow-hidden rounded-xl border border-blush-200 bg-white`}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-[11px] text-fog">
              {value === null ? "…" : "None"}
            </span>
          )}
        </div>

        {/*
          The two buttons sit on their own row and size to their own labels.
          They used to be stacked in a `flex flex-col`, which stretches its
          children: both inflated to whatever width the hint text below them
          wrapped to, so every row came out a different width with the labels
          floating in the middle of an over-wide pill.
        */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-blush-200 bg-white px-4 py-1.5 text-[12px] text-cocoa transition-colors hover:bg-blush-100 disabled:opacity-60"
            >
              {busy && <Spinner className="h-3.5 w-3.5" />}
              {value ? "Replace image" : "Choose image"}
            </button>

            {value && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                title="Falls back to the built-in image"
                className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] text-red-500 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>

          {hint && <p className="mt-2.5 max-w-md text-[11px] leading-relaxed text-fog">{hint}</p>}
          {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
    </div>
  );
}
