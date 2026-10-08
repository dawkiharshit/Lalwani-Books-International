"use client";

import { useEffect, useState } from "react";
import { clientApi, ApiError } from "@/lib/api";
import type { SavedAddress } from "@/lib/types";
import { Spinner } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MapPinIcon, PlusIcon } from "@/components/icons";
import { PageLoader } from "./loading/BookLoader";

type Draft = Omit<SavedAddress, "id" | "is_default" | "label" | "address2"> & {
  label: string;
  address2: string;
  is_default: boolean;
};

const BLANK: Draft = {
  label: "",
  name: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "India",
  is_default: false,
};

/** One line for a card: "12 MG Road, Indiranagar, Bengaluru, Karnataka 560001". */
export function addressLine(a: Pick<SavedAddress, "address1" | "address2" | "city" | "state" | "zip">) {
  return [a.address1, a.address2, a.city, `${a.state} ${a.zip}`].filter(Boolean).join(", ");
}

/**
 * The account page's address book: every address the customer has saved —
 * including the ones checkout remembered from past orders — with add, edit,
 * delete and "make default". The default is what checkout prefills.
 */
export function AddressBook() {
  const [list, setList] = useState<SavedAddress[] | null>(null);
  const [loadError, setLoadError] = useState("");
  // null = form closed; "new" = adding; a number = editing that address.
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    clientApi<{ data: SavedAddress[] }>("/addresses")
      .then((r) => !cancelled && setList(r.data))
      .catch(() => !cancelled && setLoadError("Could not load your addresses."));
    return () => {
      cancelled = true;
    };
  }, []);

  function open(target: SavedAddress | "new") {
    setErrors({});
    setFormError("");
    setActionError("");
    if (target === "new") {
      setEditing("new");
      setDraft({ ...BLANK, is_default: !list?.length });
    } else {
      setEditing(target.id);
      setDraft({
        ...target,
        label: target.label ?? "",
        address2: target.address2 ?? "",
      });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError("");
    try {
      const body = {
        ...draft,
        label: draft.label.trim() || null,
        address2: draft.address2.trim() || null,
      };
      const res =
        editing === "new"
          ? await clientApi<{ data: SavedAddress[] }>("/addresses", { method: "POST", body })
          : await clientApi<{ data: SavedAddress[] }>(`/addresses/${editing}`, { method: "PUT", body });
      setList(res.data);
      setEditing(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.errors ?? {});
        setFormError(err.errors ? "Please fix the highlighted fields." : err.message);
      } else {
        setFormError("Could not save the address. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function act(path: string, method: "POST" | "DELETE") {
    setActionError("");
    try {
      const res = await clientApi<{ data: SavedAddress[] }>(path, { method });
      setList(res.data);
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    }
  }

  const field = (
    key: keyof Draft,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => {
    const id = `addr-${key}`;
    const err = errors[key]?.[0];
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-cocoa">
          {label}
        </label>
        <input
          id={id}
          name={key}
          value={draft[key] as string}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
          aria-invalid={err ? true : undefined}
          className="input-base"
          {...props}
        />
        {err && <p className="mt-1 text-[11px] text-red-500">{err}</p>}
      </div>
    );
  };

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-[1.3rem] text-ink">Saved addresses</h2>
        {list && editing === null && (
          <button
            type="button"
            onClick={() => open("new")}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-blush-200 px-4 py-2 text-[12px] font-medium text-cocoa transition-colors hover:bg-blush-100 hover:text-ink"
          >
            <PlusIcon className="h-3.5 w-3.5" strokeWidth={2} />
            Add address
          </button>
        )}
      </div>

      {loadError && <p className="mt-3 text-[12px] text-red-600">{loadError}</p>}
      {actionError && <p className="mt-3 text-[12px] text-red-600">{actionError}</p>}

      {!list && !loadError && (
        <PageLoader label="Loading your addresses…" size="sm" className="mt-4 py-8" />
      )}

      {editing !== null && (
        <form onSubmit={save} className="card mt-4 p-6" noValidate>
          <h3 className="text-[14px] font-semibold text-ink">
            {editing === "new" ? "New address" : "Edit address"}
          </h3>
          {formError && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{formError}</p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {field("name", "Full name", { required: true, autoComplete: "name" })}
            {field("phone", "Phone", {
              required: true,
              type: "tel",
              inputMode: "numeric",
              autoComplete: "tel",
              placeholder: "10-digit mobile",
            })}
            {field("address1", "Address line 1", { required: true, autoComplete: "address-line1" })}
            {field("address2", "Address line 2 (optional)", { autoComplete: "address-line2" })}
            {field("city", "City", { required: true, autoComplete: "address-level2" })}
            {field("state", "State", { required: true, autoComplete: "address-level1" })}
            {field("zip", "PIN code", {
              required: true,
              inputMode: "numeric",
              maxLength: 6,
              autoComplete: "postal-code",
            })}
            {field("label", "Label (optional)", { placeholder: "Home, Work…", maxLength: 40 })}
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-[12px] text-cocoa">
            <input
              type="checkbox"
              checked={draft.is_default}
              onChange={(e) => setDraft((d) => ({ ...d, is_default: e.target.checked }))}
              className="h-4 w-4 accent-rose-600"
            />
            Use as my default address at checkout
          </label>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
            >
              {busy && <Spinner className="h-3.5 w-3.5" />}
              {editing === "new" ? "Save address" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="cursor-pointer rounded-full border border-blush-200 px-5 py-2.5 text-[12.5px] text-cocoa transition-colors hover:bg-blush-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {list?.length === 0 && editing === null && (
        <div className="card mt-4 p-8 text-center">
          <p className="text-[13px] text-cocoa">No saved addresses yet.</p>
          <p className="mt-1 text-[11.5px] text-fog">
            The address from your first order is saved here automatically.
          </p>
        </div>
      )}

      {list && list.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="card flex flex-col p-4">
              <div className="flex items-start gap-2.5">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                    {a.label || a.name}
                    {a.is_default && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-rose-700">
                        Default
                      </span>
                    )}
                  </p>
                  {a.label && <p className="text-[11.5px] text-cocoa">{a.name}</p>}
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-cocoa">{addressLine(a)}</p>
                  <p className="text-[11.5px] text-fog">{a.phone}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-blush-100 pt-3 text-[11.5px] font-medium">
                <button
                  type="button"
                  onClick={() => open(a)}
                  className="cursor-pointer text-maroon-700 hover:underline"
                >
                  Edit
                </button>
                {!a.is_default && (
                  <button
                    type="button"
                    onClick={() => act(`/addresses/${a.id}/default`, "POST")}
                    className="cursor-pointer text-maroon-700 hover:underline"
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleting(a)}
                  className="cursor-pointer text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this address?"
        body={deleting ? addressLine(deleting) : ""}
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          setBusy(true);
          await act(`/addresses/${deleting.id}`, "DELETE");
          setBusy(false);
          setDeleting(null);
          if (editing === deleting.id) setEditing(null);
        }}
      />
    </section>
  );
}
