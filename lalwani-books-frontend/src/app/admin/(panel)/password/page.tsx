"use client";

import { useState } from "react";
import { ApiError, clientApi } from "@/admin/lib/api";
import { useAuth } from "@/admin/context/AuthContext";
import { Spinner } from "@/admin/components/ui";

/**
 * Change the signed-in admin's own password.
 *
 * The endpoint (PUT /auth/password) already existed and had no caller anywhere
 * in the frontend — this is its first one. It is deliberately scoped to the
 * current user: an admin changes their own password here and nobody else's,
 * so there is no user picker and no way to reach another account.
 *
 * An admin created through Google has no password yet. The backend drops the
 * current-password requirement in that case, so the form drops the field and
 * the wording switches from changing one to setting one.
 */
export default function AdminPassword() {
  const { user, setUser } = useAuth();
  const hasPassword = user?.has_password !== false;

  const [form, setForm] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    setDone("");

    // Caught here rather than at the server so the mismatch is reported next to
    // the field instead of as a round trip.
    if (form.password !== form.password_confirmation) {
      setErrors({ password_confirmation: ["The two passwords do not match."] });
      setBusy(false);
      return;
    }

    try {
      const res = await clientApi<{ message: string }>("/auth/password", {
        method: "PUT",
        body: hasPassword ? form : { password: form.password, password_confirmation: form.password_confirmation },
      });
      setDone(res.message || "Password updated.");
      setForm({ current_password: "", password: "", password_confirmation: "" });

      // The account now has a password, so a Google admin should not be shown
      // the "set one" wording again on the next visit.
      if (user && !hasPassword) setUser({ ...user, has_password: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors ?? {});
        // A field-level 422 already says what is wrong beside the input.
        if (!err.errors || Object.keys(err.errors).length === 0) setError(err.message);
      } else {
        setError("Could not update the password.");
      }
    } finally {
      setBusy(false);
    }
  }

  const field = (
    key: keyof typeof form,
    label: string,
    autoComplete: "current-password" | "new-password",
    hint?: string
  ) => (
    <div>
      <label htmlFor={key} className="mb-1 block text-[11px] font-medium text-cocoa">
        {label}
      </label>
      <input
        id={key}
        name={key}
        type="password"
        required
        autoComplete={autoComplete}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className="input-base"
      />
      {errors[key]?.length ? (
        <p className="mt-1 text-[11px] text-red-600">{errors[key][0]}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-fog">{hint}</p>
      ) : null}
    </div>
  );

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">
          {hasPassword ? "Change Password" : "Set a Password"}
        </h1>
        <p className="mt-1 text-[12px] text-fog">
          {hasPassword
            ? `For your own admin account, ${user?.email ?? ""}. Other accounts are not affected.`
            : `Your account signs in with Google. Set a password and you can use ${user?.email ?? "your email"} as well.`}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">
          {done}
        </p>
      )}

      <form onSubmit={submit} className="card flex flex-col gap-5 p-7">
        {hasPassword && field("current_password", "Current password", "current-password")}
        {field("password", "New password", "new-password", "At least 8 characters.")}
        {field("password_confirmation", "Confirm new password", "new-password")}

        <div>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />}
            {hasPassword ? "Update Password" : "Set Password"}
          </button>
        </div>
      </form>

      <p className="text-[11.5px] leading-relaxed text-fog">
        You stay signed in on this device after the change. Sessions elsewhere are not ended — sign
        out from those devices if you need to.
      </p>
    </div>
  );
}
