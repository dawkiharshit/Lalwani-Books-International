"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, clientApi, describeError } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";

type StepKey = "placed" | "shipped" | "delivered" | "cancelled";

interface Template {
  name: string;
  language: string;
  status: string;
  category: string;
  header_format: string;
  header: string;
  body: string;
  footer: string;
  buttons: { type: string; text: string; url: string }[];
  vars: string[];
  blocked: string | null;
  warning: string | null;
}

interface Choice {
  on: boolean;
  template: string;
  language: string;
  fields: string[];
}

interface Step extends Choice {
  key: StepKey;
  label: string;
  when: string;
  suggest: string[];
}

interface Field {
  key: string;
  label: string;
  sample: string;
}

interface Note {
  at: string;
  step: string;
  order: string;
  ok: boolean;
  note: string;
  test: boolean;
}

interface Payload {
  connected: boolean;
  /** Switched off above with Disconnect: details and choices kept, nothing sent. */
  disconnected: boolean;
  webhook: boolean;
  steps: Step[];
  fields: Field[];
  templates: { fetched_at: string | null; items: Template[]; total: number };
  log: Note[];
}

type Draft = Record<StepKey, Choice>;

const BLANK = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** The words just before a blank that say what usually goes in it (for some steps only, when given). */
const HINTS: [RegExp, string, StepKey[]?][] = [
  [/(hi|hello|hey|dear|namaste|namaskar)[\s,]*$/i, "customer_name"],
  [/(shopping with|team)[\s,]*$/i, "shop_name"],
  [/(track(ing)?|follow)[^{}.]*$/i, "tracking_url"],
  [/(courier|via|through)[\s:]*$/i, "courier"],
  // "…has left our shop with {{3}}" names the courier.
  [/with[\s:]*$/i, "courier", ["shipped"]],
  [/(order\s*(no\.?|number|id)?|#)[\s:#-]*$/i, "order_number"],
  [/(₹|rs\.?|inr|amount|total|worth|price)[\s:]*$/i, "total"],
  [/(items?|books?|products?)[^{}.]*$/i, "items"],
  [/(dated?|on)[\s:]*$/i, "order_date"],
  [/(link|visit|view|details)[^{}.]*$/i, "order_url"],
];

/** Named blanks such as {{customer_name}} say what they want themselves. */
const NAMES: [RegExp, string][] = [
  [/first/i, "first_name"],
  [/name/i, "customer_name"],
  [/order|number|id/i, "order_number"],
  [/total|amount|price/i, "total"],
  [/track/i, "tracking_url"],
  [/courier|carrier/i, "courier"],
  [/item|book|product/i, "items"],
  [/date/i, "order_date"],
  [/link|url/i, "order_url"],
  [/shop|store|company/i, "shop_name"],
];

/** A first guess at what fills each of a template's blanks; the admin can change any of them. */
function suggest(template: Template, step: Step, fields: Field[]): string[] {
  const known = new Set(fields.map((f) => f.key));
  const used = new Set<string>();

  // The words between the previous blank and each blank.
  const before = new Map<string, string>();
  let last = 0;
  for (const m of template.body.matchAll(BLANK)) {
    if (!before.has(m[1])) before.set(m[1], template.body.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
  }

  const free = (key: string) => known.has(key) && !used.has(key);

  return template.vars.map((blank) => {
    const words = (before.get(blank) ?? "").slice(-40);
    const pick =
      HINTS.find(([re, key, steps]) => free(key) && (!steps || steps.includes(step.key)) && re.test(words))?.[1] ??
      (/^\d+$/.test(blank) ? undefined : NAMES.find(([re, key]) => free(key) && re.test(blank))?.[1]) ??
      step.suggest.find(free) ??
      "order_number";
    used.add(pick);
    return pick;
  });
}

const draftFrom = (steps: Step[]): Draft =>
  Object.fromEntries(
    steps.map((s) => [s.key, { on: s.on, template: s.template, language: s.language, fields: s.fields }]),
  ) as Draft;

const sameChoice = (a: Choice, b: Choice) =>
  a.on === b.on && a.template === b.template && a.language === b.language && a.fields.join() === b.fields.join();

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Admin → WhatsApp → Order messages: for each step of an order, one of the
 * account's own AiGrowBot templates and what fills its blanks — with a
 * preview, a test to the admin's own number, and a log of what went out.
 */
export function OrderMessages({ reloadKey }: { reloadKey: number }) {
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [stepErrors, setStepErrors] = useState<Record<string, string[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testStep, setTestStep] = useState<StepKey | "">("");
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const take = useCallback((payload: Payload) => {
    setData(payload);
    setDraft(draftFrom(payload.steps));
  }, []);

  const load = useCallback(() => {
    clientApi<{ data: Payload }>("/admin/whatsapp")
      .then((res) => {
        setLoadError("");
        take(res.data);
      })
      .catch((err) => setLoadError(describeError(err)));
  }, [take]);

  // Again whenever the connection above loads the templates afresh.
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (!data || !draft) {
    return loadError ? (
      <section role="alert" className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="max-w-md text-[13px] text-red-600">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError("");
            load();
          }}
          className="rounded-full bg-ink px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-rose-700"
        >
          Retry
        </button>
      </section>
    ) : (
      <section className="card flex items-center justify-center gap-2 py-14 text-fog">
        <Spinner className="h-5 w-5" /> Loading order messages...
      </section>
    );
  }

  const templates = data.templates.items;
  const fieldList = data.fields;
  const current = draft;
  const byKey = (choice: Choice) => templates.find((t) => t.name === choice.template && t.language === choice.language);
  const dirty = data.steps.some((s) => !sameChoice(s, draft[s.key]));
  const withTemplate = data.steps.filter((s) => draft[s.key].template !== "");
  const testFor = testStep && draft[testStep]?.template ? testStep : (withTemplate[0]?.key ?? "");
  const values = Object.fromEntries(data.fields.map((f) => [f.key, f.sample]));
  // Names only, so the list stays narrow on a phone; the preview shows the values.
  const fieldOptions = data.fields.map((f) => ({ value: f.key, label: f.label }));

  function change(step: Step, next: Partial<Choice>) {
    setDraft((d) => (d ? { ...d, [step.key]: { ...d[step.key], ...next } } : d));
    setSaved(false);
  }

  function pickTemplate(step: Step, value: string) {
    if (!value) {
      change(step, { template: "", language: "", fields: [], on: false });
      return;
    }
    const template = templates.find((t) => `${t.name}|${t.language}` === value);
    if (!template) return;
    change(step, {
      template: template.name,
      language: template.language,
      fields: suggest(template, step, fieldList),
      // Picking a ready template for a step that had none switches it on —
      // not one with a warning, which wants a test first.
      on:
        current[step.key].template === ""
          ? template.blocked === null && template.warning === null
          : current[step.key].on && template.blocked === null,
    });
  }

  /** Saves the choices; true when it saved. */
  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    setStepErrors({});
    try {
      const res = await clientApi<{ data: Payload }>("/admin/whatsapp", { method: "PUT", body: { steps: draft } });
      take(res.data);
      setSaved(true);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        setStepErrors(err.errors);
        setError("Not saved — see the notes in red below.");
      } else {
        setError(describeError(err, "save the order messages"));
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function reload() {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await clientApi<{ data: Payload }>("/admin/whatsapp/templates", { method: "POST" });
      // Keep unsaved choices; only the template list is new.
      setData(res.data);
      setRefreshMsg({ ok: true, text: `Templates loaded — ${res.data.templates.total} found.` });
    } catch (err) {
      setRefreshMsg({ ok: false, text: err instanceof ApiError ? err.message : "Could not load the templates." });
    } finally {
      setRefreshing(false);
    }
  }

  async function sendTest() {
    if (!testFor) return;
    // The test sends what is saved, so save first — as the connection tests do.
    if (dirty && !(await save())) return;
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await clientApi<{ message: string; data: Payload }>("/admin/whatsapp/test", {
        method: "POST",
        body: { step: testFor, phone: testPhone.trim() },
      });
      setTestMsg({ ok: true, text: res.message });
      take(res.data);
    } catch (err) {
      const phoneError = err instanceof ApiError ? err.errors?.phone?.[0] : undefined;
      setTestMsg({ ok: false, text: phoneError ?? (err instanceof ApiError ? err.message : "The test could not be sent.") });
      load();
    } finally {
      setTesting(false);
    }
  }

  const errorsFor = (key: StepKey) =>
    Object.entries(stepErrors)
      .filter(([k]) => k.startsWith(`steps.${key}.`))
      .flatMap(([, messages]) => messages);

  return (
    <section className="flex flex-col gap-5">
      <div className="card flex flex-col gap-4 p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
              Step 2 · Order messages
            </p>
            <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-fog">
              Choose which of your AiGrowBot templates goes to the customer at each step. The shop fills the
              blanks with that order&rsquo;s details and sends it to the WhatsApp number given at checkout.
            </p>
          </div>
          {data.connected && (
            <button
              type="button"
              onClick={reload}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-full border border-blush-200 px-4 py-2 text-[12px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
            >
              {refreshing && <Spinner className="h-3.5 w-3.5" />} Reload templates
            </button>
          )}
        </div>

        {data.connected && (
          <p className="text-[11.5px] text-fog">
            {data.templates.fetched_at
              ? `${data.templates.total} template${data.templates.total === 1 ? "" : "s"} loaded ${when(data.templates.fetched_at)}${
                  data.templates.items.length < data.templates.total
                    ? ` (showing the first ${data.templates.items.length})`
                    : ""
                }. Loading them only reads them — nothing is sent.`
              : "Templates not loaded yet — press “Reload templates”."}
          </p>
        )}
        {refreshMsg && (
          <p
            className={`rounded-xl px-4 py-2.5 text-[12px] ${
              refreshMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}
          >
            {refreshMsg.text}
          </p>
        )}

        {!data.connected &&
          (data.disconnected ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800">
              AiGrowBot is disconnected, so no WhatsApp order messages are sent. Press <b>Connect again</b> above to
              start them again — your choices here are kept.
            </p>
          ) : (
            <p className="rounded-xl bg-blush-50 px-4 py-3 text-[12.5px] leading-relaxed text-cocoa">
              Connect your AiGrowBot account above first, then press <b>Save &amp; load templates</b> — your
              templates will appear here.
            </p>
          ))}
      </div>

      {data.connected && templates.length > 0 && (
        <>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
          {saved && (
            <p className="rounded-xl bg-green-50 px-4 py-2.5 text-[12px] text-green-700">
              Saved — from now on, these messages go out by themselves.
            </p>
          )}

          {data.steps.map((step) => {
            const choice = draft[step.key];
            const template = byKey(choice);
            const missing = choice.template !== "" && !template;
            const notes = errorsFor(step.key);
            const options = [
              { value: "", label: "— No message —" },
              ...(missing
                ? [{ value: `${choice.template}|${choice.language}`, label: `${choice.template} (no longer in AiGrowBot)` }]
                : []),
              ...templates.map((t) => ({
                value: `${t.name}|${t.language}`,
                label: `${t.name} (${t.language})${t.blocked ? " — not approved" : ""}`,
              })),
            ];

            return (
              <article key={step.key} className="card flex flex-col gap-5 p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-[1.15rem] text-ink">{step.label}</h2>
                    <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-fog">{step.when}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={choice.on}
                    aria-label={`Send the ${step.label.toLowerCase()} message`}
                    disabled={choice.template === ""}
                    title={choice.template === "" ? "Choose a template first" : undefined}
                    onClick={() => change(step, { on: !choice.on })}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      choice.on ? "bg-rose-600" : "bg-blush-200"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        choice.on ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium text-cocoa">Template</p>
                  <Select
                    value={choice.template ? `${choice.template}|${choice.language}` : ""}
                    onChange={(v) => pickTemplate(step, v)}
                    options={options}
                    ariaLabel={`${step.label} template`}
                    className="w-full sm:max-w-md"
                    buttonClassName="input-base flex cursor-pointer items-center justify-between gap-2 text-left"
                  />
                  {missing && (
                    <p className="mt-1.5 text-[11.5px] text-red-600">
                      This template is no longer in your AiGrowBot account — choose another.
                    </p>
                  )}
                  {template?.blocked && (
                    <p className="mt-1.5 text-[11.5px] text-red-600">Can&rsquo;t be sent: {template.blocked}</p>
                  )}
                  {template?.warning && <p className="mt-1.5 text-[11.5px] text-amber-700">{template.warning}</p>}
                </div>

                {template && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[11px] font-medium text-cocoa">
                        {template.vars.length
                          ? "Fill the blanks with"
                          : "This template has no blanks — it is sent exactly as written."}
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {template.vars.map((blank, i) => (
                          <div key={blank} className="flex items-center gap-3">
                            <code className="w-14 shrink-0 rounded-lg bg-blush-50 px-2 py-1.5 text-center text-[11.5px] text-cocoa">
                              {`{{${blank}}}`}
                            </code>
                            <Select
                              value={choice.fields[i] ?? ""}
                              onChange={(v) => {
                                const fields = [...choice.fields];
                                fields[i] = v;
                                change(step, { fields });
                              }}
                              options={fieldOptions}
                              ariaLabel={`What fills blank ${blank}`}
                              className="min-w-0 flex-1"
                              buttonClassName="input-base flex cursor-pointer items-center justify-between gap-2 text-left"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-medium text-cocoa">Preview, with a sample order</p>
                      <Preview template={template} fields={choice.fields} values={values} />
                    </div>
                  </div>
                )}

                {notes.length > 0 && (
                  <ul className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
                    {notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}

          <div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-rose-600 px-7 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {saving && <Spinner className="h-4 w-4" />} Save order messages
            </button>
          </div>

          <div className="card flex flex-col gap-3 p-6 sm:p-7">
            <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
              Send yourself a test
            </p>
            <p className="text-[12px] leading-relaxed text-fog">
              Sends one message, filled with a sample order (LBI-TEST-0001), to the number you type — so you see
              exactly what customers will get. Nothing goes to any customer.
            </p>
            {withTemplate.length === 0 ? (
              <p className="text-[12px] text-cocoa">Choose a template for at least one step first.</p>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select
                  value={testFor}
                  onChange={(v) => setTestStep(v as StepKey)}
                  options={withTemplate.map((s) => ({ value: s.key, label: s.label }))}
                  ariaLabel="Which message to test"
                  className="sm:w-48"
                  buttonClassName="input-base flex cursor-pointer items-center justify-between gap-2 text-left"
                />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Your WhatsApp number"
                  aria-label="Your WhatsApp number"
                  maxLength={20}
                  className="input-base sm:w-56"
                />
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={testing || saving || testPhone.trim() === ""}
                  className="flex items-center justify-center gap-2 rounded-full border border-blush-200 px-5 py-2 text-[12.5px] text-cocoa hover:bg-blush-100 disabled:opacity-60"
                >
                  {testing && <Spinner className="h-3.5 w-3.5" />} {dirty ? "Save & send test" : "Send test"}
                </button>
              </div>
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
          </div>
        </>
      )}

      {data.connected && data.templates.fetched_at && templates.length === 0 && (
        <p className="card px-7 py-6 text-[12.5px] leading-relaxed text-cocoa">
          Your AiGrowBot account has no WhatsApp templates yet. Create them in AiGrowBot (they need WhatsApp&rsquo;s
          approval), then press <b>Reload templates</b>.
        </p>
      )}

      {data.log.length > 0 && (
        <div className="card flex flex-col gap-3 p-6 sm:p-7">
          <p className="text-[11px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
            Recent WhatsApp messages
          </p>
          <ul className="flex flex-col divide-y divide-blush-100">
            {data.log.map((n, i) => (
              <li key={`${n.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-[12px]">
                <span className={n.ok ? "font-semibold text-green-700" : "font-semibold text-red-600"}>
                  {n.ok ? "✓ Sent" : "✗ Not sent"}
                </span>
                <span className="text-ink">
                  {data.steps.find((s) => s.key === n.step)?.label ?? n.step} · {n.order}
                  {n.test && <span className="ml-1.5 rounded-full bg-blush-100 px-2 py-0.5 text-[10px] text-fog">test</span>}
                </span>
                <span className="text-fog">{when(n.at)}</span>
                {!n.ok && <span className="w-full text-[11.5px] text-red-600">{n.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.connected && data.webhook && (
        <p className="text-[11.5px] leading-relaxed text-fog">
          A step with a template switched on goes out as that template only. Steps without one still go to your
          AiGrowBot webhook (Advanced, below).
        </p>
      )}
    </section>
  );
}

/** The template as the customer will see it, its blanks filled from the sample order. */
function Preview({ template, fields, values }: { template: Template; fields: string[]; values: Record<string, string> }) {
  const fill = (text: string) => {
    const out: React.ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(BLANK)) {
      out.push(text.slice(last, m.index));
      const i = template.vars.indexOf(m[1]);
      const value = i >= 0 ? values[fields[i] ?? ""] : undefined;
      out.push(
        <mark key={m.index} className="rounded-sm bg-amber-100 text-ink [box-decoration-break:clone]">
          {value ?? m[0]}
        </mark>,
      );
      last = (m.index ?? 0) + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  };

  return (
    <div className="rounded-2xl rounded-tl-sm bg-[#e7f6dd] px-4 py-3 text-[12.5px] leading-relaxed text-ink shadow-sm">
      {template.header_format && template.header_format !== "TEXT" ? (
        <p className="mb-2 rounded-lg bg-white/70 px-3 py-2 text-center text-[11px] uppercase tracking-wide text-fog">
          {template.header_format.toLowerCase()}
        </p>
      ) : (
        template.header && <p className="mb-1 font-semibold">{template.header}</p>
      )}
      <p className="whitespace-pre-line break-words">{fill(template.body)}</p>
      {template.footer && <p className="mt-1.5 text-[11px] text-fog">{template.footer}</p>}
      {template.buttons.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-black/5 pt-2">
          {template.buttons.map((b, i) => (
            <span key={`${b.text}-${i}`} className="rounded-full bg-white px-3 py-1 text-[11px] text-sky-700">
              {b.text || b.type.toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
