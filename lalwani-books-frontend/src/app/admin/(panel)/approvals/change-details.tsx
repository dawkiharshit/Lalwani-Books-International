"use client";

import { useEffect, useState } from "react";
import { API_BASE, getAuthToken } from "@/admin/lib/api";

export interface StaffChange {
  id: string;
  status: "pending" | "approved" | "rejected";
  area: string;
  area_label: string;
  title: string;
  staff: { id: number; name: string; email: string };
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  reason: string | null;
  error: string | null;
  fields: { label: string; before: string | null; after: string | null }[];
  files: { index: number; name: string; size: number; image: boolean }[];
}

/** Tells the sidebar's Approvals count to look again. */
export const APPROVALS_CHANGED = "lalwani:approvals-changed";

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * A photo sent with a change. It sits in private storage, so it is fetched
 * with the owner's sign-in and shown from memory rather than linked to.
 */
function HeldPhoto({ changeId, index, name }: { changeId: string; index: number; name: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetch(`${API_BASE}/admin/approvals/${changeId}/files/${index}`, {
      headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` },
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [changeId, index]);

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a private blob: URL, not an optimisable image
    <img src={url} alt={name} className="h-28 w-28 rounded-xl border border-blush-150 object-cover" />
  ) : (
    <span className="flex h-28 w-28 items-center justify-center rounded-xl border border-blush-150 bg-blush-50 text-[11px] text-fog">
      {name}
    </span>
  );
}

/** What a change would change: each field, today and after approval. */
export function ChangeDetails({ change }: { change: StaffChange }) {
  return (
    <>
      {change.fields.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-blush-150">
          <table className="w-full min-w-[480px] text-left text-[12px]">
            <thead className="bg-blush-50 text-[10.5px] uppercase tracking-wide text-fog">
              <tr>
                <th className="px-3 py-2 font-semibold">Field</th>
                <th className="px-3 py-2 font-semibold">Now</th>
                <th className="px-3 py-2 font-semibold">After approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blush-100">
              {change.fields.map((f) => (
                <tr key={f.label} className="align-top">
                  <td className="px-3 py-2 font-medium text-ink">{f.label}</td>
                  <td className="px-3 py-2 text-fog line-through decoration-red-300">{f.before ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-green-800">{f.after ?? "(empty)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {change.files.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {change.files.map((f) =>
            f.image && change.status === "pending" ? (
              <HeldPhoto key={f.index} changeId={change.id} index={f.index} name={f.name} />
            ) : (
              <span key={f.index} className="rounded-full bg-blush-50 px-3 py-1 text-[11.5px] text-cocoa">
                {f.name} · {Math.max(1, Math.round(f.size / 1024))} KB
              </span>
            ),
          )}
        </div>
      )}
    </>
  );
}
