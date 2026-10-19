"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { APPROVALS_CHANGED, ChangeDetails, when, type StaffChange } from "./change-details";

/**
 * Admin → Approvals: changes staff made in areas set to "needs my approval".
 * Nothing in them is on the website until approved here.
 */
export default function AdminApprovals() {
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [list, setList] = useState<StaffChange[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const load = useCallback(() => {
    clientApi<{ data: StaffChange[] }>(`/admin/approvals?status=${tab}`)
      .then((res) => {
        setList(res.data);
        setError("");
      })
      .catch((err) => setError(describeError(err, "load the changes")));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(change: StaffChange, action: "approve" | "reject", reason?: string) {
    setBusy(change.id);
    setNotice("");
    setError("");
    try {
      const res = await clientApi<{ message: string }>(`/admin/approvals/${change.id}/${action}`, {
        method: "POST",
        body: action === "reject" ? { reason: reason ?? "" } : undefined,
      });
      setNotice(`${change.title}: ${res.message}`);
      setRejecting(null);
      setList((prev) => prev?.filter((c) => c.id !== change.id) ?? prev);
      window.dispatchEvent(new Event(APPROVALS_CHANGED));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : describeError(err, "do that"));
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* The words take the card's width; the tabs sit at its right, and below
          the words on a phone. */}
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[1.6rem] text-ink">Approvals</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fog">
            Changes your staff made where you asked to approve them first. Nothing here is on the website yet —
            approving makes it live at once, exactly as if you had saved it yourself.
          </p>
        </div>
        <div role="tablist" className="flex shrink-0 self-start rounded-full bg-blush-50 p-1 text-[12px] sm:self-center">
          {(["pending", "decided"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setList(null);
              }}
              className={`rounded-full px-4 py-1.5 ${tab === t ? "bg-white font-semibold text-ink shadow-sm" : "text-fog hover:text-ink"}`}
            >
              {t === "pending" ? "Waiting" : "Decided"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
      {notice && <p className="rounded-xl bg-green-50 px-4 py-2.5 text-[12.5px] text-green-800">{notice}</p>}

      {list === null ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : list.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[12.5px] text-fog">
          {tab === "pending" ? "Nothing is waiting for you." : "No decisions yet."}
        </p>
      ) : (
        list.map((c) => (
          <article key={c.id} className="card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-ink">{c.title}</p>
                <p className="mt-0.5 text-[12px] text-fog">
                  {c.area_label} · by {c.staff.name} · {when(c.created_at)}
                </p>
              </div>
              {c.status !== "pending" && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    c.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}
                >
                  {c.status === "approved" ? "Approved" : "Rejected"}
                  {c.decided_at ? ` · ${when(c.decided_at)}` : ""}
                </span>
              )}
            </div>

            <ChangeDetails change={c} />
            {c.status === "pending" && c.fields.length === 0 && c.files.length === 0 && (
              <p className="text-[12px] text-fog">No fields to compare — the title says what it does.</p>
            )}
            {c.reason && <p className="text-[12px] text-cocoa">Reason: {c.reason}</p>}

            {c.error && (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
                <b>Could not be made last time:</b> {c.error}
                <button
                  type="button"
                  onClick={() => setRejecting({ id: c.id, reason: c.error ?? "" })}
                  className="ml-2 font-semibold underline underline-offset-2"
                >
                  Reject with this reason
                </button>
              </div>
            )}

            {c.status === "pending" &&
              (rejecting?.id === c.id ? (
                <div className="flex flex-col gap-2.5">
                  <label htmlFor={`reason-${c.id}`} className="text-[11px] font-medium text-cocoa">
                    Why not? ({c.staff.name} sees this)
                  </label>
                  <textarea
                    id={`reason-${c.id}`}
                    rows={2}
                    maxLength={500}
                    value={rejecting.reason}
                    onChange={(e) => setRejecting({ id: c.id, reason: e.target.value })}
                    className="input-base resize-none"
                    placeholder="e.g. Please keep the original price."
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() => decide(c, "reject", rejecting.reason)}
                      className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-[12.5px] text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {busy === c.id && <Spinner className="h-3.5 w-3.5" />} Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(null)}
                      className="rounded-full border border-blush-200 px-5 py-2 text-[12.5px] text-cocoa hover:bg-blush-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => decide(c, "approve")}
                    className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2 text-[12.5px] text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busy === c.id && <Spinner className="h-3.5 w-3.5" />} Approve — make it live
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setRejecting({ id: c.id, reason: "" })}
                    className="rounded-full border border-red-200 px-5 py-2 text-[12.5px] text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              ))}
          </article>
        ))
      )}
    </div>
  );
}
