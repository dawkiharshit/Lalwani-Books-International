"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { API_BASE, getAuthToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CloseIcon, MicIcon } from "@/components/icons";
import { clock, settleDuration } from "@/lib/audio";
import { WHATSAPP_DISPLAY, whatsappLink } from "@/lib/contact";

/** The same limit as the API's VoiceQueries::MAX_SECONDS. */
const MAX_SECONDS = 120;

/** What each browser records in, best first: Chrome and Edge WebM, Firefox Ogg, Safari MP4. */
const TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"];

type Stage = "ready" | "asking" | "recording" | "recorded" | "sending" | "sent";

/** Everything that is live while recording. */
interface Session {
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  meter: { ctx: AudioContext; frame: number } | null;
  tick: number | null;
}

/** Microphone off, meter and clock stopped. */
function release(s: Session) {
  if (s.tick) window.clearInterval(s.tick);
  s.tick = null;
  if (s.meter) {
    cancelAnimationFrame(s.meter.frame);
    void s.meter.ctx.close().catch(() => {});
    s.meter = null;
  }
  s.stream?.getTracks().forEach((t) => t.stop());
  s.stream = null;
}

/** "+91 98765-43210" → "9876543210", as the API's IndianMobile reads it; null when it is not one. */
function mobile(value: string): string | null {
  let d = value.replace(/\D/g, "");
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/**
 * "Ask us by voice": record a question (up to two minutes), listen back, and
 * send it with a number to be called back on — required unless signed in.
 * It goes to admin → Voice Queries. The microphone is only switched on while
 * recording, and the panel is drawn over the page from <body> so the header
 * can never sit above it.
 */
export default function VoiceQueryPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const id = useId();
  const [stage, setStage] = useState<Stage>("ready");
  const [seconds, setSeconds] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; url: string; seconds: number } | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState("");
  const [said, setSaid] = useState("");

  const session = useRef<Session>({ recorder: null, stream: null, meter: null, tick: null });
  const levels = useRef<HTMLSpanElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const player = useRef<HTMLAudioElement>(null);
  const clipUrl = useRef<string | null>(null);
  const close = useEffectEvent(() => onClose());

  // Focus inside on open, Escape closes, focus goes back to the mic button,
  // and nothing keeps recording once the panel is gone.
  useEffect(() => {
    const live = session.current;
    const urls = clipUrl;
    const opener = document.activeElement;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (live.recorder && live.recorder.state !== "inactive") {
        live.recorder.onstop = null;
        live.recorder.stop();
      }
      release(live);
      if (urls.current) URL.revokeObjectURL(urls.current);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  /** The bars move with the voice, so the customer can see they are heard. */
  function listen(media: MediaStream) {
    try {
      const ctx = new AudioContext();
      // Some browsers start it paused until the page has been tapped.
      void ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const draw = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        levels.current?.style.setProperty("--lvl", String(Math.min(1, Math.sqrt(sum / data.length) * 4)));
        if (session.current.meter) session.current.meter.frame = requestAnimationFrame(draw);
      };
      session.current.meter = { ctx, frame: requestAnimationFrame(draw) };
    } catch {
      /* No meter in this browser: recording works without it. */
    }
  }

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(`This browser can’t record here. Please WhatsApp us on ${WHATSAPP_DISPLAY} instead.`);
      return;
    }
    setStage("asking");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      session.current.stream = media;
      const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(media, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
      } catch {
        rec = new MediaRecorder(media);
      }
      const chunks: Blob[] = [];
      const began = Date.now();
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        const length = Math.max(1, Math.min(MAX_SECONDS, Math.round((Date.now() - began) / 1000)));
        release(session.current);
        const blob = new Blob(chunks, { type: rec.mimeType || type || "audio/webm" });
        if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
        clipUrl.current = URL.createObjectURL(blob);
        setClip({ blob, url: clipUrl.current, seconds: length });
        setStage("recorded");
        setSaid(`Recorded ${clock(length)}. Listen back, then send it.`);
        // The stop button is gone: carry on at the player.
        requestAnimationFrame(() => player.current?.focus());
      };
      rec.start(1000);
      session.current.recorder = rec;
      listen(media);
      setSeconds(0);
      session.current.tick = window.setInterval(() => {
        const s = Math.floor((Date.now() - began) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stop();
      }, 250);
      setStage("recording");
      setSaid("Recording. Speak your question, then press Stop.");
    } catch (err) {
      release(session.current);
      setStage(clip ? "recorded" : "ready");
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "The microphone is blocked. Allow it for this site in your browser (the icon beside the address), then try again."
          : name === "NotFoundError"
            ? "No microphone was found on this device."
            : "The microphone could not be started. Please try again."
      );
    }
  }

  function stop() {
    const rec = session.current.recorder;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  async function send() {
    if (!clip) return;
    const number = mobile(phone);
    if (phone.trim() && !number) {
      setError("Enter your 10-digit mobile number so we can call you back.");
      return;
    }
    if (!user && !number) {
      setError("Enter your mobile number so we can call you back.");
      return;
    }
    setError("");
    setStage("sending");
    const ext = clip.blob.type.includes("mp4") ? "m4a" : clip.blob.type.includes("ogg") ? "ogg" : "webm";
    const body = new FormData();
    body.append("audio", clip.blob, `question.${ext}`);
    body.append("seconds", String(clip.seconds));
    if (number) body.append("phone", number);
    body.append("page", window.location.pathname);
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const res = await fetch(`${API_BASE}/voice-queries`, { method: "POST", headers, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = data?.errors ? (Object.values(data.errors)[0] as string[] | undefined)?.[0] : undefined;
        throw new Error(
          res.status === 429 ? "That’s a lot of messages in a short time — please try again in a few minutes." : reason || data?.message || "Could not send it."
        );
      }
      setThanks(String(data.message || "Thank you! We got your question."));
      setStage("sent");
      setSaid("Sent. Thank you!");
      requestAnimationFrame(() => first.current?.focus());
    } catch (err) {
      setStage("recorded");
      setError(err instanceof TypeError ? "Could not send it — check your internet connection and try again." : (err as Error).message);
    }
  }

  const recording = stage === "recording";

  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-maroon-900/25 sm:bg-transparent" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={(e) => e.stopPropagation()}
        // A sheet along the bottom of a phone; on a computer, beside the column
        // of round buttons (scroll, WhatsApp, mic) at the bottom right.
        className="absolute inset-x-3 bottom-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[var(--radius-card)] bg-white p-5 shadow-lift ring-1 ring-blush-200 sm:inset-x-auto sm:bottom-6 sm:right-[5.5rem] sm:max-h-[calc(100dvh-3rem)] sm:w-[23rem]"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush-100 text-rose-600">
            <MicIcon className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${id}-title`} className="text-[16px] font-semibold text-ink">
              Ask us by voice
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-fog">
              Tell us what you need — a book, an order, anything. Up to 2 minutes; we&rsquo;ll call you back.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fog transition-colors hover:bg-blush-100 hover:text-ink"
          >
            <CloseIcon className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {stage === "sent" ? (
          <div className="mt-5 rounded-2xl bg-green-50 px-4 py-4 text-center">
            <p className="text-[13.5px] font-semibold text-green-800">✓ {thanks}</p>
            <button
              ref={first}
              type="button"
              onClick={onClose}
              className="mt-3 rounded-full bg-rose-600 px-6 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-rose-700"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Record / stop, with the clock and the voice level. */}
            {(stage === "ready" || stage === "asking" || recording) && (
              <div className="mt-5 flex flex-col items-center gap-3">
                <button
                  ref={first}
                  type="button"
                  onClick={recording ? stop : start}
                  disabled={stage === "asking"}
                  aria-label={recording ? "Stop recording" : "Start recording"}
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lift transition-[background-color,scale] hover:scale-105 disabled:opacity-60 ${
                    recording ? "bg-red-600 hover:bg-red-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {recording ? (
                    <span className="h-5 w-5 rounded-[4px] bg-white" aria-hidden />
                  ) : (
                    <MicIcon className="h-7 w-7" strokeWidth={1.9} />
                  )}
                </button>
                {recording ? (
                  <div className="flex items-center gap-3 text-[13px] text-cocoa">
                    <span className="rec-pulse h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden />
                    <span className="tabular-nums">
                      {clock(seconds)} <span className="text-fog">/ {clock(MAX_SECONDS)}</span>
                    </span>
                    <span ref={levels} className="voice-level flex h-5 items-end gap-[3px]" aria-hidden>
                      {[0.6, 1, 0.8, 1.2, 0.7].map((k, i) => (
                        <span key={i} className="block h-full w-[3px] rounded-full bg-rose-600" style={{ ["--k" as string]: k }} />
                      ))}
                    </span>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-fog">{stage === "asking" ? "Allow the microphone to start…" : "Tap to record"}</p>
                )}
              </div>
            )}

            {/* Listen back, then send with a number to call back on. */}
            {(stage === "recorded" || stage === "sending") && clip && (
              <div className="mt-4 flex flex-col gap-3">
                <audio
                  ref={player}
                  controls
                  src={clip.url}
                  onLoadedMetadata={(e) => settleDuration(e.currentTarget)}
                  className="w-full"
                  aria-label="Your recording"
                />
                <button
                  ref={first}
                  type="button"
                  onClick={start}
                  disabled={stage === "sending"}
                  className="self-start text-[12px] font-semibold text-rose-600 underline-offset-2 hover:underline disabled:opacity-60"
                >
                  ↺ Record again
                </button>

                <div>
                  <label htmlFor={`${id}-phone`} className="block text-[11.5px] font-medium text-cocoa">
                    Mobile number {user ? <span className="font-normal text-fog">(optional)</span> : null}
                  </label>
                  <div className="mt-1 flex items-center rounded-xl border border-blush-200 bg-white focus-within:border-rose-600">
                    <span className="pl-3 text-[13px] text-fog">+91</span>
                    <input
                      id={`${id}-phone`}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={16}
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError("");
                      }}
                      placeholder="98765 43210"
                      className="w-full min-w-0 bg-transparent px-2 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-fog/70"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-fog">
                    {user
                      ? `Signed in as ${user.name} — add a number if you’d like a call back.`
                      : "We’ll call or WhatsApp you on this number."}{" "}
                    It&rsquo;s used only to answer you (
                    <Link href="/pages/privacy" className="underline underline-offset-2 hover:text-rose-600">
                      privacy
                    </Link>
                    ).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={send}
                  disabled={stage === "sending"}
                  className="flex items-center justify-center gap-2 rounded-full bg-rose-600 px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                >
                  {stage === "sending" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />}
                  {stage === "sending" ? "Sending…" : "Send my question"}
                </button>
              </div>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-red-700">
            {error}
            {error.includes("WhatsApp") && (
              <>
                {" "}
                <a href={whatsappLink("Hello! I have a question.")} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  Open WhatsApp
                </a>
              </>
            )}
          </p>
        )}
        <p className="sr-only" aria-live="polite">
          {said}
        </p>
      </div>
    </div>,
    document.body
  );
}
