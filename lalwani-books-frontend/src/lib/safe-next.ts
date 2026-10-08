/**
 * The `?next=` a guarded page sets so that sign-in can return to it.
 *
 * Only a path on this site is honoured. A full URL, a protocol-relative
 * "//host" or a "/\host" (which browsers read as "//host") would let a crafted
 * link — "sign in to Lalwani Books" — land someone who has just typed their
 * password on another site dressed up to look like this one: the classic open
 * redirect used for phishing.
 */
export function safeNext(raw: string | null | undefined, fallback: string): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Control characters have no place in a path and can smuggle a scheme past
  // some parsers.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}
