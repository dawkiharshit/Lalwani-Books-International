/**
 * A link from admin-entered content that is safe to put in an href: a page on
 * this site ("/collection?…") or a full http(s) address. Anything else —
 * javascript:, data:, a "//host" or "/\host" that browsers read as another
 * website — gives null, and the caller leaves the link out.
 *
 * The API refuses these links on save (App\Rules\SafeLink); this is the
 * second lock, for anything saved before that rule existed.
 */
export function safeHref(url: string | null | undefined): string | null {
  const link = (url ?? "").trim();
  if (/^\/(?![/\\])\S*$/.test(link)) return link;
  if (/^https?:\/\/[^\s/$.?#]\S*$/i.test(link)) return link;
  return null;
}
