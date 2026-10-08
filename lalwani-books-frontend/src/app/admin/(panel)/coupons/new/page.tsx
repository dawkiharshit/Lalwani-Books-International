"use client";

import { BackLink } from "@/admin/components/BackLink";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clientApi, ApiError } from "@/admin/lib/api";
import { CURRENCY } from "@/admin/lib/format";
import { Select } from "@/admin/components/Select";

const EMPTY = {
  code: "",
  type: "percent" as "percent" | "fixed",
  value: "",
  min_order: "",
  max_uses: "",
  expires_at: "",
  is_active: true,
  is_public: false,
};

export default function NewCouponPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await clientApi("/admin/coupons", {
        method: "POST",
        body: {
          code: form.code.trim().toUpperCase(),
          type: form.type,
          value: Number(form.value),
          min_order: form.min_order ? Number(form.min_order) : 0,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          expires_at: form.expires_at || null,
          is_active: form.is_active,
          is_public: form.is_public,
        },
      });
      router.push("/admin/coupons");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the coupon.");
      setBusy(false);
    }
  }

  const valueSuffix = form.type === "percent" ? "% off" : `${CURRENCY} off`;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/admin/coupons" label="Back to coupons" />

      <h1 className="font-serif text-[1.6rem] text-ink">New Coupon</h1>

      <form onSubmit={create} className="card flex flex-col gap-5 p-6">
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-[12.5px] text-red-600">{error}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-cocoa">Code</span>
            <input
              required
              placeholder="WELCOME10"
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              className="input-base uppercase"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-cocoa">Discount type</span>
            <Select
              value={form.type}
              onChange={(v) => set("type", v as "percent" | "fixed")}
              options={[
                { value: "percent", label: "Percentage (% off)" },
                { value: "fixed", label: `Fixed amount (${CURRENCY} off)` },
              ]}
              ariaLabel="Discount type"
              variant="field"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-cocoa">Value ({valueSuffix})</span>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              placeholder={form.type === "percent" ? "10" : "500"}
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              className="input-base"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-cocoa">Minimum order ({CURRENCY})</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0 = no minimum"
              value={form.min_order}
              onChange={(e) => set("min_order", e.target.value)}
              className="input-base"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-cocoa">Max uses</span>
            <input
              type="number"
              min="1"
              placeholder="Leave blank for unlimited"
              value={form.max_uses}
              onChange={(e) => set("max_uses", e.target.value)}
              className="input-base"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-cocoa">Expires on</span>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => set("expires_at", e.target.value)}
              className="input-base"
            />
            <span className="text-[10.5px] text-fog">Leave blank to never expire.</span>
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-blush-50 p-4">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => set("is_public", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-rose-600"
            />
            <span>
              <span className="block text-[12.5px] font-medium text-ink">Show on checkout page</span>
              <span className="block text-[11px] text-fog">
                Customers see this coupon and can tap to apply it. Leave off to keep it a private
                code they must type.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-rose-600"
            />
            <span>
              <span className="block text-[12.5px] font-medium text-ink">Active</span>
              <span className="block text-[11px] text-fog">
                An inactive coupon is refused at checkout even if typed.
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={busy}
            className="rounded-full bg-rose-600 px-6 py-2.5 text-[12.5px] text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? "Creating..." : "Create Coupon"}
          </button>
          <Link href="/admin/coupons" className="text-[12.5px] text-fog hover:text-rose-600">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
