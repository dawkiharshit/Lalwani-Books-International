"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";

interface Field {
  value: string | null;
  is_secret: boolean;
  set: boolean;
  source: "admin" | "env" | "unset";
}

interface Payload {
  group: string;
  fields: Record<string, Field>;
  enabled: boolean;
  webhook_url: string | null;
}

export interface IntegrationField {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  /** Renders a dropdown instead of a text box. */
  options?: { value: string; label: string }[];
  /** Span both columns. */
  wide?: boolean;
}

/**
 * One integration's credentials — payment, delivery or email.
 *
 * Each group loads, saves and tests on its own endpoint, so a screen never
 * touches another integration's keys.
 */
export function IntegrationPanel({
  group,
  title,
  blurb,
  sectionTitle,
  onLabel,
  offLabel,
  fields,
  testLabel,
  testTo,
  note,
}: {
  group: "payment" | "delivery" | "mail" | "google";
  title: string;
  blurb: string;
  sectionTitle: string;
  onLabel: string;
  offLabel: string;
  fields: IntegrationField[];
  testLabel: string;
  /** Mail only: let the tester name the inbox instead of assuming the admin address is real. */
  testTo?: { label: string; placeholder: string };
  note?: React.ReactNode;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [clear, setClear] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testAddress, setTestAddress] = useState("");

  const load = useCallback(() => {
    clientApi<{ data: Payload }>(`/admin/integrations/${group}`)
      .then((res) => {
        setData(res.data);
        // Non-secret values are editable in place; secrets always start blank.
        const next: Record<string, string> = {};
        Object.entries(res.data.fields).forEach(([k, f]) => {
          next[k] = f.is_secret ? "" : (f.value ?? "");
        });
        setDraft(next);
        setClear([]);
      })
      .catch((err) => setError(describeError(err)));
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  // Anything typed (or marked to clear) that the server does not have yet.
  // The server trims what it saves, so whitespace alone is no change.
  const dirty =
    clear.length > 0 ||
    Object.entries(draft).some(([key, value]) => {
      const field = data?.fields[key];
      if (!field) return false;
      return field.is_secret ? value.trim() !== "" : value.trim() !== (field.value ?? "").trim();
    });

  /** Writes the form; true when it saved. */
  async function persist() {
    setBusy(true);
    setError("");
    setSaved(false);
    setTestMsg(null);
    try {
      await clientApi(`/admin/integrations/${group}`, { method: "PUT", body: { ...draft, clear } });
      setSaved(true);
      load();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await persist();
  }

  async function test() {
    // The test runs against what the server has saved. Unsaved edits are saved
    // first: testing before pressing Save used to re-check the old details and
    // fail again, as if the new ones were wrong too.
    if (dirty && !(await persist())) return;
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await clientApi<{ message: string }>(`/admin/integrations/${group}/test`, {
        method: "POST",
        body: testTo && testAddress.trim() ? { to: testAddress.trim() } : undefined,
      });
      setTestMsg({ ok: true, text: res.message });
    } catch (err) {
      setTestMsg({ ok: false, text: err instanceof ApiError ? err.message : "Test failed." });
    } finally {
      setTesting(false);
    }
  }

  function toggleClear(key: string) {
    setClear((c) => (c.includes(key) ? c.filter((x) => x !== key) : [...c, key]));
    setSaved(false);
  }

  if (!data)
    return error ? (
      // A failed load says why and offers a retry, instead of a spinner that
      // keeps turning beside an error.
      <div role="alert" className="card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
        <p className="max-w-md text-[13px] text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError("");
            load();
          }}
          className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-rose-600"
        >
          Retry
        </button>
      </div>
    ) : (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> Loading...
      </div>
    );

  const renderField = (f: IntegrationField) => {
    const meta = data.fields[f.key];
    if (!meta) return null;

    const clearing = clear.includes(f.key);
    const onChange = (value: string) => {
      setDraft((d) => ({ ...d, [f.key]: value }));
      setSaved(false);
    };

    return (
      <div key={f.key} className={f.wide || f.hint ? "sm:col-span-2" : ""}>
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <label className="text-[11px] font-medium text-cocoa">{f.label}</label>
          {meta.set ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-green-700">
              Set{meta.source === "env" ? " in .env" : ""}
            </span>
          ) : (
            <span className="rounded-full bg-blush-100 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-fog">
              Not set
            </span>
          )}
          {meta.set && (
            <button
              type="button"
              onClick={() => toggleClear(f.key)}
              className={`ml-auto text-[10.5px] ${clearing ? "text-red-600" : "text-fog hover:text-red-500"}`}
            >
              {clearing ? "will be cleared — undo" : "clear"}
            </button>
          )}
        </div>

        {f.options ? (
          <Select
            value={clearing ? "" : (draft[f.key] ?? "")}
            disabled={clearing}
            onChange={onChange}
            options={f.options}
            ariaLabel={f.label}
            buttonClassName="input-base flex cursor-pointer items-center justify-between gap-2 text-left disabled:opacity-50"
          />
        ) : (
          <input
            type={meta.is_secret ? "password" : "text"}
            value={clearing ? "" : (draft[f.key] ?? "")}
            disabled={clearing}
            onChange={(e) => onChange(e.target.value)}
            className="input-base font-mono tracking-tight disabled:opacity-50"
            placeholder={
              meta.is_secret && meta.set
                ? "•••••••••••••  (leave blank to keep)"
                : (f.placeholder ?? "")
            }
            autoComplete="off"
          />
        )}
        {f.hint && <p className="mt-1 text-[11px] leading-relaxed text-fog">{f.hint}</p>}
      </div>
    );
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-[1.6rem] text-ink">{title}</h1>
        <p className="mt-1 text-[12px] text-fog">{blurb}</p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
      {saved && (
        <p className="rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">
          Saved — this takes effect immediately.
        </p>
      )}
      {testMsg && (
        <p
          className={`rounded-xl px-4 py-2.5 text-[12px] ${
            testMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {testMsg.text}
        </p>
      )}

      <section className="card grid gap-5 p-7 sm:grid-cols-2">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
          <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
            {sectionTitle}
          </p>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              data.enabled ? "bg-green-100 text-green-700" : "bg-blush-100 text-fog"
            }`}
          >
            {data.enabled ? onLabel : offLabel}
          </span>
        </div>

        {fields.map(renderField)}

        {/* Both providers need a URL registered on their side, but they are
            different things — a webhook for Razorpay, a redirect for Google. */}
        {data.webhook_url && (
          <div className="sm:col-span-2">
            <p className="mb-1 text-[11px] font-medium text-cocoa">
              {group === "google" ? "Authorized redirect URI" : "Webhook URL"}
            </p>
            <code className="block overflow-x-auto rounded-xl bg-blush-50 px-4 py-2.5 text-[11.5px] text-cocoa">
              {data.webhook_url}
            </code>
            {group === "payment" && (
              <p className="mt-1 text-[11px] text-fog">
                Paste this into Razorpay → Settings → Webhooks, subscribe to{" "}
                <span className="text-ink">payment.captured</span>, and use the same secret as
                above.
              </p>
            )}
          </div>
        )}

        {note && <div className="sm:col-span-2">{note}</div>}

        <div className="sm:col-span-2">
          {testTo && (
            <input
              type="email"
              value={testAddress}
              onChange={(e) => setTestAddress(e.target.value)}
              placeholder={testTo.placeholder}
              aria-label={testTo.label}
              className="w-full rounded-full border border-blush-200 px-4 py-2 text-[12.5px] text-ink outline-none placeholder:text-fog focus:border-rose-400 sm:w-64"
            />
          )}

          <button
            type="button"
            onClick={test}
            disabled={testing || busy}
            className="flex items-center gap-2 rounded-full border border-blush-200 px-5 py-2 text-[12.5px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
          >
            {testing && <Spinner className="h-3.5 w-3.5" />}{" "}
            {dirty ? `Save & ${testLabel.charAt(0).toLowerCase()}${testLabel.slice(1)}` : testLabel}
          </button>
        </div>
      </section>

      <div>
        <button
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />} Save
        </button>
      </div>
    </form>
  );
}
