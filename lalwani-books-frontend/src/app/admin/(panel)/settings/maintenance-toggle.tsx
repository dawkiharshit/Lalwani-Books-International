"use client";

import { useEffect, useState } from "react";
import { clientApi } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";

/**
 * Maintenance mode — a real switch that saves the moment it is flipped, so
 * there is no "changed but not saved" trap for a control that takes the whole
 * storefront down.
 */
export function MaintenanceToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: Record<string, string> }>("/admin/settings")
      .then((res) => setOn(res.data.maintenance_mode === "1"))
      .catch(() => setOn(false));
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError("");
    try {
      await clientApi("/admin/settings", { method: "PUT", body: { maintenance_mode: next ? "1" : "0" } });
      setOn(next);
    } catch {
      setError("Could not save — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[1.15rem] text-ink">Maintenance mode</h2>
          <p className="mt-1 max-w-md text-[12px] leading-relaxed text-fog">
            When ON, visitors see an &ldquo;Under maintenance&rdquo; page across the whole site — no
            page opens. The admin panel and login stay open so you can switch it back off. Saves
            instantly; takes effect within a few seconds.
          </p>
        </div>

        {on === null ? (
          <Spinner className="h-5 w-5 shrink-0" />
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Maintenance mode"
            disabled={busy}
            onClick={() => toggle(!on)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              on ? "bg-rose-600" : "bg-blush-200"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                on ? "left-6" : "left-1"
              }`}
            />
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}
      {on !== null && !error && (
        <p
          className={`mt-3 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            on ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
          }`}
        >
          {busy ? "Saving…" : on ? "Site is under maintenance" : "Site is live"}
        </p>
      )}
    </section>
  );
}
