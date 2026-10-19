/**
 * Chrome's recordings (WebM) carry no length, so a player shows 0:00 / ∞ and
 * cannot seek until it has read to the end. Asking for a far-off moment makes
 * it work the length out; then it goes back to the start. Call it on
 * `loadedmetadata`.
 */
export function settleDuration(audio: HTMLAudioElement) {
  if (Number.isFinite(audio.duration)) return;
  const back = () => {
    if (!Number.isFinite(audio.duration)) return;
    audio.removeEventListener("durationchange", back);
    audio.currentTime = 0;
  };
  audio.addEventListener("durationchange", back);
  audio.currentTime = 1e101;
}

/** "1:05" */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
