import Link from "next/link";
import { Brand } from "@/components/Brand";
import { getSettings } from "@/lib/settings";

/**
 * Auth pages get their own chrome: no nav, no footer, nothing to click away to
 * except the mark itself.
 *
 * This is a sibling route group to (shop) rather than a nested one, because
 * nested layouts compose — a layout inside (shop) would still render the header
 * above it. Route groups do not affect the URL, so /login and /register are
 * unchanged.
 *
 * The card lives here rather than in each page. Six pages carry eleven card
 * roots between them (loading, error and success states), so owning the surface
 * once keeps the logo from having to be repeated eleven times — and the card
 * now stays put while its contents swap between states.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    /* min-h-screen, not h-screen: the tallest page (register, with the Google
       button) overflows a short laptop viewport, and a fixed height would clip
       it instead of letting the page scroll. */
    <div className="flex min-h-screen items-center justify-center bg-blush-100 px-4 py-6">
      <div className="card w-full max-w-md overflow-hidden shadow-soft">
        {/* The only way back to the store, so it is a link rather than an image. */}
        <div className="flex justify-center pt-6">
          <Link href="/" aria-label={settings.site_name || "Lalwani Books International"}>
            <Brand logo={settings.site_logo} name={settings.site_name} height={88} />
          </Link>
        </div>

        <main>{children}</main>
      </div>
    </div>
  );
}
