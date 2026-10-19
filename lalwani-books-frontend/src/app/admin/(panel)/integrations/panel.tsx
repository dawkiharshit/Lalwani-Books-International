"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";

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
  /** Switched off by the admin: the details are kept but nothing uses them. */
  disconnected: boolean;
  webhook_url: string | null;
  /** Email only: the last messages that could not be sent, newest first. */
  problems?: { at: string; what: string; to: string; error: string }[];
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
  hideHeading = false,
  onTested,
  disconnect,
  onChanged,
}: {
  group: "payment" | "delivery" | "mail" | "google" | "whatsapp" | "whatsapp_api";
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
  /** For a second panel on a screen that already has its heading. */
  hideHeading?: boolean;
  /** Told how the test went, so the rest of the screen can catch up. */
  onTested?: (ok: boolean) => void;
  /** For the Disconnect button: what to call it, and what stops working while it is off. */
  disconnect?: { name: string; note: string };
  /** Told when it is disconnected or connected again. */
  onChanged?: () => void;
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
  const [askOff, setAskOff] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchMsg, setSwitchMsg] = useState("");
  const offNote = disconnect?.note ?? "The shop stops using these details until you connect again.";
  // Stable, so the dialog's Escape and focus handling is set up once.
  const cancelOff = useCallback(() => setAskOff(false), []);

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
      onTested?.(true);
    } catch (err) {
      setTestMsg({ ok: false, text: err instanceof ApiError ? err.message : "Test failed." });
      onTested?.(false);
    } finally {
      setTesting(false);
    }
  }

  /** Disconnect (keeping the details) or connect again. */
  async function switchTo(connected: boolean) {
    setSwitching(true);
    setError("");
    setSaved(false);
    setTestMsg(null);
    setSwitchMsg("");
    try {
      const res = await clientApi<{ data: Payload }>(
        `/admin/integrations/${group}/${connected ? "connect" : "disconnect"}`,
        { method: "POST" },
      );
      setData(res.data);
      setAskOff(false);
      setSwitchMsg(
        connected
          ? "Connected again — the saved details are in use."
          : "Disconnected — the details are kept, but nothing uses them.",
      );
      onChanged?.();
    } catch (err) {
      setAskOff(false);
      setError(describeError(err, connected ? "connect it again" : "disconnect it"));
    } finally {
      setSwitching(false);
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
          className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-rose-700"
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
      {!hideHeading && (
        <div>
          <h1 className="font-serif text-[1.6rem] text-ink">{title}</h1>
          <p className="mt-1 text-[12px] text-fog">{blurb}</p>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
      {saved && (
        <p className="rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">
          {data.disconnected
            ? "Saved — still disconnected; press “Connect again” to use these details."
            : "Saved — this takes effect immediately."}
        </p>
      )}
      {switchMsg && (
        <p
          className={`rounded-xl px-4 py-2.5 text-[12px] ${
            data.disconnected ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-700"
          }`}
        >
          {switchMsg}
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
              data.disconnected
                ? "bg-amber-100 text-amber-700"
                : data.enabled
                  ? "bg-green-100 text-green-700"
                  : "bg-blush-100 text-fog"
            }`}
          >
            {data.disconnected ? "Disconnected" : data.enabled ? onLabel : offLabel}
          </span>
        </div>

        {data.disconnected && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 sm:col-span-2">
            <p className="max-w-xl text-[12.5px] leading-relaxed text-amber-800">
              <b>Disconnected.</b> {offNote} The details below are kept, so you can connect again at any time.
            </p>
            <button
              type="button"
              onClick={() => switchTo(true)}
              disabled={switching}
              className="flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2 text-[12.5px] text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {switching && <Spinner className="h-3.5 w-3.5" />} Connect again
            </button>
          </div>
        )}

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

        {/* Emails are sent after the page answers, so failures are kept here. */}
        {data.problems && data.problems.length > 0 && (
          <div className="rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 sm:col-span-2">
            <p className="text-[12px] font-semibold text-red-700">Recent emails that could not be sent</p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {data.problems.map((p, i) => (
                <li key={`${p.at}-${i}`} className="text-[11.5px] leading-relaxed text-cocoa">
                  <span className="text-fog">
                    {new Date(p.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </span>{" "}
                  · {p.what} to {p.to} — <span className="text-red-700">{p.error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* While disconnected the banner above offers "Connect again" instead. */}
        {!data.disconnected && (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
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

            {Object.values(data.fields).some((f) => f.set) && (
              <button
                type="button"
                onClick={() => setAskOff(true)}
                disabled={switching || busy}
                className="ml-auto rounded-full border border-red-200 px-5 py-2 text-[12.5px] text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Disconnect
              </button>
            )}
          </div>
        )}
      </section>

      <div>
        <button
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />} Save
        </button>
      </div>

      {/* On the page body, so no card or animation around the panel can clip it. */}
      {askOff &&
        createPortal(
          <ConfirmDialog
            open
            title={`Disconnect ${disconnect?.name ?? title}?`}
            body={
              <>
                <p>{offNote}</p>
                <p className="mt-2">
                  The details stay saved, so you can press &ldquo;Connect again&rdquo; at any time.
                </p>
              </>
            }
            confirmLabel="Disconnect"
            tone="danger"
            busy={switching}
            onConfirm={() => switchTo(false)}
            onCancel={cancelOff}
          />,
          document.body,
        )}
    </form>
  );
}
