"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { LEVEL_LABELS, type StaffLevel } from "@/admin/lib/staff";

interface Area {
  key: string;
  label: string;
  covers: string;
}

interface Member {
  id: number;
  name: string;
  email: string;
  active: boolean;
  areas: Record<string, StaffLevel>;
  added_at: string | null;
}

interface Payload {
  areas: Area[];
  staff: Member[];
}

interface Form {
  id: number | null;
  name: string;
  email: string;
  password: string;
  areas: Record<string, StaffLevel>;
}

/** The dashboard and search insights only show figures — there is nothing on them to edit. */
const levelsFor = (area: string): StaffLevel[] =>
  area === "dashboard" || area === "insights" ? ["none", "view"] : ["none", "view", "approval", "direct"];

/** A password nobody will guess, for the owner to hand over. */
function newPassword(): string {
  const words = "amber bright cedar delta ember frost globe harbor ivory jasmine kettle lotus maple".split(" ");
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  return `${pick()}-${pick()}-${(crypto.getRandomValues(new Uint32Array(1))[0] % 900) + 100}`;
}

/**
 * Admin → Staff: the people the owner lets into the admin panel, and what
 * each may see or change. Edits set to "needs my approval" wait in Approvals.
 */
export default function AdminStaff() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    clientApi<{ data: Payload }>("/admin/staff")
      .then((res) => {
        setData(res.data);
        setError("");
      })
      .catch((err) => setError(describeError(err, "load the staff list")));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const blankAreas = (areas: Area[]): Record<string, StaffLevel> =>
    Object.fromEntries(areas.map((a) => [a.key, "none"])) as Record<string, StaffLevel>;

  function startAdd() {
    if (!data) return;
    setForm({ id: null, name: "", email: "", password: newPassword(), areas: blankAreas(data.areas) });
    setFormErrors({});
    setNotice("");
  }

  function startEdit(m: Member) {
    setForm({ id: m.id, name: m.name, email: m.email, password: "", areas: { ...m.areas } });
    setFormErrors({});
    setNotice("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormErrors({});
    try {
      const body = form.id
        ? { name: form.name, areas: form.areas, ...(form.password.trim() ? { password: form.password } : {}) }
        : { name: form.name, email: form.email, password: form.password, areas: form.areas };
      const res = await clientApi<{ data: Payload; message: string }>(form.id ? `/admin/staff/${form.id}` : "/admin/staff", {
        method: form.id ? "PUT" : "POST",
        body,
      });
      setData(res.data);
      setNotice(
        form.id
          ? `Saved ${form.name}'s access.`
          : `${res.message} Give them their email and password: ${form.email} / ${form.password}`,
      );
      setForm(null);
    } catch (err) {
      if (err instanceof ApiError && err.errors) setFormErrors(err.errors);
      else setFormErrors({ form: [describeError(err, "save")] });
    } finally {
      setSaving(false);
    }
  }

  async function setActive(m: Member, active: boolean) {
    setBusy(true);
    setNotice("");
    try {
      const res = await clientApi<{ data: Payload }>(`/admin/staff/${m.id}`, { method: "PUT", body: { active } });
      setData(res.data);
      setNotice(active ? `${m.name} can sign in again.` : `${m.name} is paused and has been signed out.`);
    } catch (err) {
      setError(describeError(err, "save"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      const res = await clientApi<{ data: Payload }>(`/admin/staff/${removing.id}`, { method: "DELETE" });
      setData(res.data);
      setNotice(`${removing.name} no longer has access.`);
      setRemoving(null);
    } catch (err) {
      setError(describeError(err, "remove them"));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return error ? (
      <p className="card px-6 py-10 text-center text-[13px] text-red-600">{error}</p>
    ) : (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> Loading...
      </div>
    );
  }

  const fieldError = (key: string) => formErrors[key]?.[0];

  return (
    <div className="flex flex-col gap-5">
      {/* The words take the card's width; the button sits at its right, and
          below the words on a phone. */}
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:p-7">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[1.6rem] text-ink">Staff</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-fog">
            People you let into this admin panel, and what each of them may see or change. When you set an area to
            &ldquo;needs my approval&rdquo;, their changes wait in <b>Approvals</b> and go live on the website only once
            you approve them. Payments, integrations and staff stay yours alone.
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={startAdd}
            className="shrink-0 self-start rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white hover:bg-rose-700 sm:self-center"
          >
            Add staff member
          </button>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
      {notice && <p className="rounded-xl bg-green-50 px-4 py-2.5 text-[12.5px] text-green-800">{notice}</p>}

      {form && (
        <form onSubmit={save} className="card flex flex-col gap-5 p-6 sm:p-7">
          <h2 className="font-serif text-[1.2rem] text-ink">{form.id ? `Edit ${form.name}` : "New staff member"}</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="staff-name" className="mb-1 block text-[11px] font-medium text-cocoa">
                Name
              </label>
              <input
                id="staff-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-base"
                maxLength={120}
              />
              {fieldError("name") && <p className="mt-1 text-[11px] text-red-600">{fieldError("name")}</p>}
            </div>
            <div>
              <label htmlFor="staff-email" className="mb-1 block text-[11px] font-medium text-cocoa">
                Email (they sign in with it)
              </label>
              <input
                id="staff-email"
                type="email"
                required
                disabled={form.id !== null}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-base disabled:opacity-60"
                autoComplete="off"
              />
              {fieldError("email") && <p className="mt-1 text-[11px] text-red-600">{fieldError("email")}</p>}
            </div>
            <div>
              <label htmlFor="staff-password" className="mb-1 block text-[11px] font-medium text-cocoa">
                {form.id ? "New password (leave blank to keep)" : "Password"}
              </label>
              <div className="flex gap-2">
                <input
                  id="staff-password"
                  required={form.id === null}
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-base min-w-0 flex-1 font-mono"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: newPassword() })}
                  className="shrink-0 rounded-full border border-blush-200 px-3 text-[11.5px] text-cocoa hover:bg-blush-100"
                >
                  New
                </button>
              </div>
              {fieldError("password") && <p className="mt-1 text-[11px] text-red-600">{fieldError("password")}</p>}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">What they can do</p>
            <ul className="mt-3 divide-y divide-blush-100 rounded-xl border border-blush-150">
              {data.areas.map((area) => (
                <li key={area.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{area.label}</p>
                    <p className="text-[11.5px] text-fog">{area.covers}</p>
                  </div>
                  <Select
                    value={form.areas[area.key] ?? "none"}
                    onChange={(v) => setForm({ ...form, areas: { ...form.areas, [area.key]: v as StaffLevel } })}
                    options={levelsFor(area.key).map((level) => ({ value: level, label: LEVEL_LABELS[level] }))}
                    ariaLabel={`${area.label}: what they can do`}
                    className="shrink-0 sm:w-60"
                    buttonClassName="input-base flex cursor-pointer items-center justify-between gap-2 text-left"
                  />
                </li>
              ))}
            </ul>
          </div>

          {fieldError("form") && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{fieldError("form")}</p>}

          <div className="flex flex-wrap gap-2.5">
            <button
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving && <Spinner className="h-4 w-4" />} {form.id ? "Save" : "Add staff member"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-full border border-blush-200 px-6 py-2.5 text-[13px] text-cocoa hover:bg-blush-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {data.staff.length === 0 && !form ? (
        <p className="card px-6 py-10 text-center text-[12.5px] text-fog">
          No staff yet. Add someone to let them help with the shop.
        </p>
      ) : (
        data.staff.map((m) => {
          const given = data.areas.filter((a) => (m.areas[a.key] ?? "none") !== "none");
          return (
            <article key={m.id} className="card flex flex-col gap-3 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-ink">{m.name}</p>
                  <p className="text-[12px] text-fog">{m.email}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    m.active ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {m.active ? "Active" : "Paused"}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {given.length === 0 ? (
                  <span className="text-[12px] text-fog">No areas yet.</span>
                ) : (
                  given.map((a) => (
                    <span key={a.key} className="rounded-full bg-blush-50 px-2.5 py-1 text-[11px] text-cocoa">
                      {a.label}: <b>{LEVEL_LABELS[m.areas[a.key]].replace("Edit — ", "")}</b>
                    </span>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(m)}
                  className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100"
                >
                  Edit access
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setActive(m, !m.active)}
                  className="rounded-full border border-blush-200 px-4 py-1.5 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
                >
                  {m.active ? "Pause" : "Let them in again"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoving(m)}
                  className="rounded-full border border-red-200 px-4 py-1.5 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Remove
                </button>
              </div>
            </article>
          );
        })
      )}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ""}?`}
        body="They are signed out at once and can no longer open the admin panel. Changes they sent that are still waiting stay in Approvals."
        confirmLabel="Remove"
        tone="danger"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
