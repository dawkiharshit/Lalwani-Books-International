"use client";

import { useState } from "react";
import { API_BASE, getAuthToken } from "@/admin/lib/api";
import { FileTextIcon } from "@/admin/components/icons";
import { Spinner } from "@/admin/components/ui";

export interface Attachment {
  id: string;
  name: string;
  bytes: number;
  type: string;
  ext: string;
}

/** A file size as people read it. */
const size = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * A reading list sent with a quote request. The files are kept out of the
 * website's public folder, so each one is fetched with the signed-in admin's
 * key and handed to the browser from memory.
 *
 * A CSV also opens here as a table: the shop can read the list without
 * downloading it, and without a spreadsheet running anything the file carries.
 */
export function Attachments({ messageId, files }: { messageId: number; files: Attachment[] }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<{ id: string; rows: string[][] } | null>(null);

  async function fetchFile(file: Attachment): Promise<Blob | null> {
    setBusy(file.id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/messages/${messageId}/files/${file.id}`, {
        headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      return await res.blob();
    } catch {
      setError(`Could not open ${file.name}. Please try again.`);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function download(file: Attachment) {
    const blob = await fetchFile(file);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function view(file: Attachment) {
    if (open?.id === file.id) return setOpen(null);
    const blob = await fetchFile(file);
    if (!blob) return;
    setOpen({ id: file.id, rows: readCsv(await blob.text()) });
  }

  return (
    <div className="mt-3 border-t border-blush-100 pt-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-fog">Attached list</p>
      <ul className="mt-2 flex flex-col gap-2">
        {files.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-blush-50 px-3 py-2">
            <FileTextIcon className="h-4 w-4 shrink-0 text-rose-500" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{f.name}</span>
            <span className="shrink-0 text-[11px] text-fog">{size(f.bytes)}</span>
            {busy === f.id && <Spinner className="h-4 w-4" />}
            {f.ext === "csv" && (
              <button onClick={() => view(f)} className="text-[12px] text-rose-600 hover:underline">
                {open?.id === f.id ? "Hide" : "View"}
              </button>
            )}
            <button onClick={() => download(f)} className="text-[12px] text-rose-600 hover:underline">
              Download
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mt-2 text-[11.5px] text-red-600">{error}</p>}

      {open && (
        <div className="mt-2 overflow-x-auto rounded-xl ring-1 ring-blush-200">
          <table className="w-full text-left text-[12px]">
            <tbody className="divide-y divide-blush-100">
              {open.rows.map((row, i) => (
                <tr key={i} className={i === 0 ? "bg-blush-50 font-semibold text-ink" : "text-cocoa"}>
                  {row.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-3 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {open.rows.length === 0 && <p className="px-3 py-3 text-[12px] text-fog">That file is empty.</p>}
        </div>
      )}
    </div>
  );
}

/**
 * The first rows of a CSV, as text for the table above. Commas inside "quotes"
 * stay part of their cell, and a doubled "" is one quotation mark — the two
 * things a spreadsheet writes that a plain split on commas gets wrong.
 */
function readCsv(text: string, maxRows = 50, maxCols = 12): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c !== "")) rows.push(row.slice(0, maxCols));
    row = [];
  };

  for (let i = 0; i < text.length && rows.length <= maxRows; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      endCell();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length) endRow();

  return rows.slice(0, maxRows);
}
