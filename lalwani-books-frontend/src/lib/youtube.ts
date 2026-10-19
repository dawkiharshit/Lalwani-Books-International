/**
 * The 11-character id of a YouTube video, from any link a person might paste:
 * youtube.com/watch?v=…, youtu.be/…, /shorts/…, /live/…, /embed/…, mobile and
 * music links, with or without share extras (?si=…, &t=…). Null for anything
 * that is not a YouTube video link. Mirrors App\Support\YouTube on the API.
 */
export function youtubeId(link: string): string | null {
  const text = link.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const ok = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null);
  const [first, second] = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return ok(first);
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  const v = url.searchParams.get("v");
  if (v) return ok(v);
  return ["embed", "shorts", "live", "v"].includes(first ?? "") ? ok(second) : null;
}

/** The privacy-friendly player: YouTube sets no cookies until the visitor presses play. */
export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}

/** YouTube's own preview picture of the video. */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
