import { Brand } from "@/admin/components/Brand";
import { MenuIcon, UserIcon } from "@/admin/components/icons";

/**
 * What the admin panel shows while it confirms the visitor is a signed-in
 * admin (the /auth/me round trip on a fresh load).
 *
 * It used to be a bare "Checking access..." line on an empty page. This is
 * the panel's own frame instead — the maroon sidebar with the store logo, and
 * placeholder rows and cards that pulse — so the real panel lands in exactly
 * the same layout rather than replacing a blank screen.
 *
 * Nothing in it comes from the account: no name, no data. A signed-out
 * visitor only ever sees the empty frame before being sent to the login page.
 */
export function AdminLoadingScreen({
  brand,
  groups,
}: {
  brand: { logo: string; name: string };
  /** The real sidebar groups, so the placeholder rows match its shape. */
  groups: { title: string; links: { label: string }[] }[];
}) {
  return (
    <div className="flex min-h-screen w-full" aria-busy="true">
      <p role="status" className="sr-only">
        Loading admin panel…
      </p>

      {/* Desktop sidebar — the same box the real one sits in. */}
      <div aria-hidden className="sticky top-0 hidden h-screen lg:block">
        <aside className="flex h-full w-64 flex-col overflow-hidden bg-maroon-900">
          <div className="mx-4 mb-4 mt-5 flex items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream ring-1 ring-white/25">
              <Brand logo={brand.logo} name={brand.name} height={40} mark />
            </span>
            <span className="flex-1 space-y-1.5 motion-safe:animate-pulse">
              <span className="block h-2.5 w-24 rounded-full bg-white/20" />
              <span className="block h-2 w-16 rounded-full bg-white/10" />
            </span>
          </div>

          <div className="flex-1 space-y-4 px-3 motion-safe:animate-pulse">
            {groups.map((group) => (
              <div key={group.title}>
                <span className="mx-2 block h-2 w-14 rounded-full bg-white/10" />
                <div className="space-y-0.5 pt-2.5">
                  {group.links.map((link) => (
                    <div key={link.label} className="flex items-center gap-2.5 px-3 py-[7px]">
                      <span className="h-[15px] w-[15px] shrink-0 rounded-md bg-white/15" />
                      {/* Roughly as long as the label it stands in for. */}
                      <span
                        className="h-2.5 rounded-full bg-white/10"
                        style={{ width: Math.min(170, 24 + link.label.length * 6.5) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div aria-hidden className="flex min-w-0 flex-1 flex-col bg-blush-50">
        {/* The phone-width bar, box for box: the logo, then the account and
            menu buttons — dimmed, since they do nothing until it loads. */}
        <div className="flex items-center justify-between gap-3 border-b border-blush-100 bg-white py-2 pl-5 pr-3 sm:pl-6 sm:pr-4 lg:hidden">
          <Brand logo={brand.logo} name={brand.name} height={40} />
          <span className="flex items-center gap-1 text-cocoa/40">
            <span className="flex h-10 w-10 items-center justify-center">
              <UserIcon className="h-[19px] w-[19px]" />
            </span>
            <span className="flex h-10 w-10 items-center justify-center">
              <MenuIcon className="h-[18px] w-[18px]" />
            </span>
          </span>
        </div>

        {/* The pulse sits on the placeholders, not the cards, so the cards stay
            solid white like the real panel. blush-150/200 rather than 100: on
            white, and dimmed to half by the pulse, blush-100 all but vanished. */}
        <div className="flex-1 p-5 sm:p-6">
          <div className="motion-safe:animate-pulse">
            <span className="block h-7 w-52 max-w-full rounded-full bg-blush-200" />
            <span className="mt-3 block h-3 w-80 max-w-full rounded-full bg-blush-150" />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card p-5">
                <div className="motion-safe:animate-pulse">
                  <span className="block h-2.5 w-20 rounded-full bg-blush-150" />
                  <span className="mt-3 block h-6 w-28 max-w-full rounded-full bg-blush-200" />
                </div>
              </div>
            ))}
          </div>

          <div className="card mt-6 p-6">
            <div className="space-y-4 motion-safe:animate-pulse">
              <span className="block h-3 w-40 rounded-full bg-blush-200" />
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <span className="h-9 w-9 shrink-0 rounded-xl bg-blush-150" />
                  <span className="h-2.5 flex-1 rounded-full bg-blush-150" />
                  <span className="hidden h-2.5 w-20 rounded-full bg-blush-150 sm:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
