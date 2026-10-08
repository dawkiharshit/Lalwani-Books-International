/**
 * A template (unlike a layout) remounts on every navigation, so each page
 * fades in as it arrives. Opacity only: a transform here would trap the
 * position:fixed overlays inside pages (the photo lightbox, dialogs).
 */
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
