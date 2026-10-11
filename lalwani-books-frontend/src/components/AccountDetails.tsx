"use client";

import { useState } from "react";
import { ApiError, clientApi } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "./ui";

/** Edit name, email and phone, and change the password — "My account" details. */
export function AccountDetails({ user, className = "mt-8" }: { user: User; className?: string }) {
  const { setUser } = useAuth();

  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone ?? "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [pw, setPw] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string[]>>({});

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved("");
    setErrors({});
    try {
      const res = await clientApi<{ user: User; email_changed?: boolean; otp_sent?: boolean }>("/auth/profile", {
        method: "PUT",
        body: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null },
      });
      setUser(res.user);
      // A changed address starts unconfirmed (see AuthController::updateProfile).
      setSaved(
        res.email_changed
          ? res.otp_sent
            ? "Details saved. We've sent a confirmation code to your new email address."
            : "Details saved. Your new email address still needs confirming."
          : "Details saved."
      );
    } catch (err) {
      setErrors(err instanceof ApiError ? err.errors ?? { name: [err.message] } : { name: ["Could not save."] });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwDone("");
    setPwErrors({});
    try {
      await clientApi("/auth/password", { method: "PUT", body: pw });
      setPw({ current_password: "", password: "", password_confirmation: "" });
      setPwDone("Password changed.");
    } catch (err) {
      setPwErrors(err instanceof ApiError ? err.errors ?? { password: [err.message] } : { password: ["Could not change password."] });
    } finally {
      setPwBusy(false);
    }
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    error?: string[],
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-cocoa">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input-base" {...props} />
      {error?.[0] && <span className="mt-1 block text-[11.5px] text-red-600">{error[0]}</span>}
    </label>
  );

  return (
    <section className={`grid gap-6 md:grid-cols-2 ${className}`}>
      <form onSubmit={saveDetails} className="card space-y-4 p-6">
        <h2 className="text-[1.15rem] font-semibold text-ink">Account details</h2>
        {field("Full name", form.name, (v) => setForm({ ...form, name: v }), errors.name, { required: true, autoComplete: "name" })}
        {field("Email", form.email, (v) => setForm({ ...form, email: v }), errors.email, { type: "email", required: true, autoComplete: "email" })}
        {field("Mobile", form.phone, (v) => setForm({ ...form, phone: v }), errors.phone, { type: "tel", autoComplete: "tel" })}
        <div className="flex items-center gap-3">
          <button disabled={saving} className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60">
            {saving && <Spinner className="h-4 w-4" />} Save details
          </button>
          {saved && <span role="status" className="text-[12.5px] text-emerald-700">{saved}</span>}
        </div>
      </form>

      <form onSubmit={changePassword} className="card space-y-4 p-6">
        <h2 className="text-[1.15rem] font-semibold text-ink">Change password</h2>
        {user.has_password !== false &&
          field("Current password", pw.current_password, (v) => setPw({ ...pw, current_password: v }), pwErrors.current_password, {
            type: "password",
            required: true,
            autoComplete: "current-password",
          })}
        {field("New password", pw.password, (v) => setPw({ ...pw, password: v }), pwErrors.password, {
          type: "password",
          required: true,
          minLength: 8,
          autoComplete: "new-password",
        })}
        {field("Confirm new password", pw.password_confirmation, (v) => setPw({ ...pw, password_confirmation: v }), undefined, {
          type: "password",
          required: true,
          minLength: 8,
          autoComplete: "new-password",
        })}
        <div className="flex items-center gap-3">
          <button disabled={pwBusy} className="flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60">
            {pwBusy && <Spinner className="h-4 w-4" />} Change password
          </button>
          {pwDone && <span role="status" className="text-[12.5px] text-emerald-700">{pwDone}</span>}
        </div>
      </form>
    </section>
  );
}
