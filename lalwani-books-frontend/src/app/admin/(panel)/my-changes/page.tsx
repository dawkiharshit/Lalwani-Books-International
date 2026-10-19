"use client";

import { useEffect, useState } from "react";
import { clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { ChangeDetails, when, type StaffChange } from "../approvals/change-details";

const STATUS: Record<StaffChange["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting for approval", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved — live", cls: "bg-green-100 text-green-700" },
  rejected: { label: "Not approved", cls: "bg-red-100 text-red-600" },
};

/** Admin → My changes: what a staff member sent for approval, and how it went. */
export default function MyChanges() {
  const [list, setList] = useState<StaffChange[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: StaffChange[] }>("/admin/my-changes")
      .then((res) => setList(res.data))
      .catch((err) => setError(describeError(err, "load your changes")));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-6 sm:p-7">
        <h1 className="font-serif text-[1.6rem] text-ink">My changes</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fog">
          Changes you saved that wait for the owner&rsquo;s approval before they go live on the website, and what
          happened to each.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}

      {list === null && !error ? (
        <div className="card flex items-center justify-center gap-2 py-16 text-fog">
          <Spinner className="h-5 w-5" /> Loading...
        </div>
      ) : list && list.length === 0 ? (
        <p className="card px-6 py-10 text-center text-[12.5px] text-fog">Nothing sent for approval yet.</p>
      ) : (
        list?.map((c) => (
          <article key={c.id} className="card flex flex-col gap-3 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-ink">{c.title}</p>
                <p className="mt-0.5 text-[12px] text-fog">
                  {c.area_label} · sent {when(c.created_at)}
                  {c.decided_at ? ` · decided ${when(c.decided_at)}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS[c.status].cls}`}>
                {STATUS[c.status].label}
              </span>
            </div>
            {c.status === "pending" && <ChangeDetails change={{ ...c, files: c.files.map((f) => ({ ...f, image: false })) }} />}
            {c.reason && (
              <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-700">
                <b>Owner&rsquo;s note:</b> {c.reason}
              </p>
            )}
          </article>
        ))
      )}
    </div>
  );
}
