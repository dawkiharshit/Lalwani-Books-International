export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Page title for inner pages (Shop, About Us, My Account…).
 *
 * The grey title band with its breadcrumb is switched off: the page opens
 * straight on its content. The title is still rendered as the page's main
 * heading, visually hidden, so screen readers and search engines keep a
 * proper <h1> on every page. `crumbs` is accepted and ignored, so pages can
 * keep passing it if the band is ever brought back.
 */
export function PageBanner({
  title,
  as: Heading = "h1",
}: {
  title: string;
  crumbs?: Crumb[];
  /** "p" when the page has its own main heading (a book page). */
  as?: "h1" | "p";
}) {
  // A book page already shows its own <h1>, so there is nothing to add.
  if (Heading === "p") return null;
  return <h1 className="sr-only">{title}</h1>;
}
