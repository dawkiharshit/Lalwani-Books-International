"use client";

import { useRef, useState } from "react";
import { PhotoFill } from "@/components/Portrait";
import { ApiError, apiUpload, clientApi } from "@/lib/api";
import type { User } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { initialsOf } from "@/lib/format";
import { Spinner } from "./ui";

/** Pictures the shop accepts, matching what the API allows. */
const TYPES = "image/jpeg,image/png,image/webp";
const MAX_MB = 4;

/**
 * "My account" → the customer's own profile picture. It shows beside the
 * reviews they write. A Google sign-in brings its picture along; uploading
 * one here replaces it.
 */
export function ProfilePhoto({ user, className = "" }: { user: User; className?: string }) {
  const { setUser } = useAuth();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function run(what: "upload" | "remove", call: () => Promise<{ user: User }>) {
    setBusy(what);
    setError("");
    setDone("");
    try {
      const res = await call();
      setUser(res.user);
      setDone(what === "upload" ? "Photo saved." : "Photo removed.");
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.file?.[0] ?? err.message) : "Could not save the photo.");
    } finally {
      setBusy(null);
    }
  }

  function upload(chosen: File | undefined) {
    if (!chosen) return;
    // Checked here as well as on the server, so a wrong file says so at once.
    if (!TYPES.split(",").includes(chosen.type)) {
      setError("Choose a JPG, PNG or WebP picture.");
      return;
    }
    if (chosen.size > MAX_MB * 1024 * 1024) {
      setError(`That picture is over ${MAX_MB} MB. Choose a smaller one.`);
      return;
    }
    const body = new FormData();
    body.append("file", chosen);
    void run("upload", () => apiUpload<{ user: User }>("/auth/avatar", body));
  }

  return (
    <section className={`card flex flex-wrap items-center gap-5 p-6 ${className}`}>
      <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blush-100 text-[1.4rem] font-semibold text-rose-700 ring-2 ring-white shadow-soft">
        {user.avatar ? <PhotoFill src={user.avatar} /> : initialsOf(user.name) || "?"}
      </span>

      <div className="min-w-0 flex-1">
        <h2 className="text-[1.15rem] font-semibold text-ink">Profile photo</h2>
        <p className="mt-0.5 text-[12.5px] text-fog">
          Shown next to the reviews you write. JPG, PNG or WebP, up to {MAX_MB} MB.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => file.current?.click()}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
          >
            {busy === "upload" && <Spinner className="h-4 w-4" />}
            {user.avatar ? "Change photo" : "Upload photo"}
          </button>
          {user.avatar && (
            <button
              type="button"
              onClick={() => run("remove", () => clientApi<{ user: User }>("/auth/avatar", { method: "DELETE" }))}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-full border border-blush-200 px-5 py-2.5 text-[13px] text-cocoa transition-colors hover:border-rose-300 hover:text-rose-700 disabled:opacity-60"
            >
              {busy === "remove" && <Spinner className="h-4 w-4" />} Remove
            </button>
          )}
          {done && <span role="status" className="text-[12.5px] text-emerald-700">{done}</span>}
          {error && <span role="alert" className="text-[12.5px] text-red-600">{error}</span>}
        </div>
      </div>

      <input
        ref={file}
        type="file"
        accept={TYPES}
        className="hidden"
        aria-label="Choose a profile photo"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </section>
  );
}
