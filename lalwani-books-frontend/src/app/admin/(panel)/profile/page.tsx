"use client";

import { useState } from "react";
import { clientApi, ApiError } from "@/admin/lib/api";
import { useAuth } from "@/admin/context/AuthContext";
import type { User } from "@/admin/lib/types";
import { Spinner } from "@/admin/components/ui";

/**
 * The signed-in admin's own profile, inside the panel. "My Profile" used to
 * jump to the storefront's /account page, which threw the admin out of the
 * panel to a customer screen of orders and wishlists.
 */
export default function AdminProfile() {
  const { user, setUser } = useAuth();

  if (!user) {
    return (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">My Profile</h1>
        <p className="mt-1 text-[12px] text-fog">Your admin account details and sign-in.</p>
      </div>

      <Overview user={user} />
      <DetailsForm user={user} onSaved={setUser} />
      <PasswordForm hasPassword={user.has_password !== false} onSet={() => setUser({ ...user, has_password: true })} />
    </div>
  );
}

function Overview({ user }: { user: User }) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  const since = user.member_since
    ? new Date(`${user.member_since}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  const rows: [string, React.ReactNode][] = [
    ["Role", user.is_admin ? "Administrator" : "Customer"],
    /*
     * No verified / not-verified badge. Email verification is a shopper flow:
     * nothing on the backend gates an admin on it (no `verified` middleware,
     * no hasVerifiedEmail() check), and the seeded admin never had
     * email_verified_at set — so the badge only ever read "Not verified" on an
     * account where that changes nothing.
     */
    ["Email", user.email],
    ["Phone", user.phone || "—"],
    ["Sign-in", user.has_password === false ? "Google only" : "Email and password"],
    ["Member since", since],
  ];

  return (
    <section className="card flex flex-col gap-6 p-7 sm:flex-row sm:items-start">
      <div className="flex shrink-0 items-center gap-4 sm:w-56 sm:flex-col sm:items-start">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- a Google avatar URL; one small image.
          <img src={user.avatar} alt="" className="h-16 w-16 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-maroon-800 font-serif text-[1.4rem] text-white">
            {initials || "A"}
          </span>
        )}
        <div>
          <p className="text-[15px] font-semibold text-ink">{user.name}</p>
          <p className="text-[11.5px] text-fog">{user.is_admin ? "Administrator" : "Customer"}</p>
        </div>
      </div>

      <dl className="grid flex-1 gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-[8rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-fog sm:pt-0.5">{label}</dt>
            <dd className="-mt-2 break-words text-ink sm:mt-0">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DetailsForm({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone ?? "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = form.name !== user.name || form.email !== user.email || form.phone !== (user.phone ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMsg(null);
    try {
      const res = await clientApi<{ user: User }>("/auth/profile", {
        method: "PUT",
        body: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null },
      });
      onSaved(res.user);
      setMsg({ ok: true, text: "Profile saved." });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors ?? {});
        setMsg({ ok: false, text: err.errors ? "Please fix the highlighted fields." : err.message });
      } else {
        setMsg({ ok: false, text: "Could not save. Please try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-5 p-7">
      <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">Edit details</p>
      {msg && <Banner {...msg} />}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={errors.name?.[0]}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="name"
            className="input-base"
          />
        </Field>
        <Field label="Phone" error={errors.phone?.[0]}>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            className="input-base"
          />
        </Field>
        <Field label="Email" error={errors.email?.[0]} wide>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            type="email"
            required
            autoComplete="email"
            className="input-base"
          />
        </Field>
      </div>
      <div>
        <SaveButton busy={busy} disabled={!dirty}>
          Save details
        </SaveButton>
      </div>
    </form>
  );
}

function PasswordForm({ hasPassword, onSet }: { hasPassword: boolean; onSet: () => void }) {
  const blank = { current_password: "", password: "", password_confirmation: "" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMsg(null);
    try {
      const res = await clientApi<{ message: string }>("/auth/password", { method: "PUT", body: form });
      setForm(blank);
      setMsg({ ok: true, text: res.message });
      if (!hasPassword) onSet();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors ?? {});
        setMsg({ ok: false, text: err.errors ? "Please fix the highlighted fields." : err.message });
      } else {
        setMsg({ ok: false, text: "Could not update the password. Please try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  const input = (key: keyof typeof blank, autoComplete: string) => (
    <input
      type="password"
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      required
      autoComplete={autoComplete}
      className="input-base"
    />
  );

  return (
    <form onSubmit={save} className="card flex flex-col gap-5 p-7">
      <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
        {hasPassword ? "Change password" : "Set a password"}
      </p>
      {!hasPassword && (
        <p className="-mt-2 text-[11.5px] text-fog">
          You sign in with Google. Set a password to also sign in with your email.
        </p>
      )}
      {msg && <Banner {...msg} />}
      <div className="grid gap-5 sm:grid-cols-2">
        {hasPassword && (
          <Field label="Current password" error={errors.current_password?.[0]} wide>
            {input("current_password", "current-password")}
          </Field>
        )}
        <Field label="New password" error={errors.password?.[0]}>
          {input("password", "new-password")}
        </Field>
        <Field label="Confirm new password" error={errors.password_confirmation?.[0]}>
          {input("password_confirmation", "new-password")}
        </Field>
      </div>
      <p className="-mt-2 text-[11px] text-fog">At least 8 characters.</p>
      <div>
        <SaveButton busy={busy}>{hasPassword ? "Update password" : "Set password"}</SaveButton>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[11px] font-medium text-cocoa">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-red-500">{error}</span>}
    </label>
  );
}

function Banner({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-xl px-4 py-2.5 text-[12px] ${ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
    >
      {text}
    </p>
  );
}

function SaveButton({
  busy,
  disabled,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="inline-flex items-center gap-2 rounded-full bg-maroon-800 px-5 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-maroon-900 disabled:opacity-50"
    >
      {busy && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}
