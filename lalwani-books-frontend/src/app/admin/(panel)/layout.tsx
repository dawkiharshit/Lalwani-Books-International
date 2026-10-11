"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { useAuth } from "@/admin/context/AuthContext";
import { STOREFRONT_URL } from "@/admin/lib/storefront";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { AdminLoadingScreen } from "./loading-screen";
import { Brand } from "@/admin/components/Brand";
import { DEFAULT_SETTINGS, fetchSettingsClient } from "@/admin/lib/settings";
import {
  AtIcon,
  BoxIcon,
  CardIcon,
  ChartIcon,
  ChevronIcon,
  DashboardIcon,
  ExternalIcon,
  FileTextIcon,
  GearIcon,
  GridIcon,
  HomeIcon,
  ImageIcon,
  InfoIcon,
  KeyIcon,
  LogoutIcon,
  MailIcon,
  MapPinIcon,
  MegaphoneIcon,
  MenuIcon,
  MessageIcon,
  PagesIcon,
  PaletteIcon,
  PercentIcon,
  PhoneIcon,
  QuoteIcon,
  ReceiptIcon,
  RefreshIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
  TruckIcon,
  UserIcon,
} from "@/admin/components/icons";

type NavIcon = ComponentType<{ className?: string }>;

/*
 * Icon tints, written out in full because Tailwind scans source text — a
 * computed `text-${tint}` would never be generated.
 *
 * The hue follows what the screen does, not the group it sits in: money is
 * honey, anything that moves or ships is mint, attention and brand are rose,
 * warnings are coral, structure is lilac, information is sky, and plain
 * documents are cream. Two rows never share a hue back to back.
 */
const TINT = {
  sky: "text-nav-sky",
  mint: "text-nav-mint",
  honey: "text-nav-honey",
  rose: "text-nav-rose",
  coral: "text-nav-coral",
  lilac: "text-nav-lilac",
  cream: "text-nav-cream",
} as const;

/** Sidebar groups — mirrors the reference admin panel's information architecture. */
const GROUPS: {
  title: string;
  links: { href: string; label: string; icon: NavIcon; tint: string }[];
}[] = [
  {
    title: "Main",
    links: [{ href: "/admin", label: "Dashboard", icon: DashboardIcon, tint: TINT.sky }],
  },
  {
    title: "Shop",
    links: [
      { href: "/admin/categories", label: "Categories & Authors", icon: GridIcon, tint: TINT.lilac },
      { href: "/admin/coupons", label: "Coupons", icon: TagIcon, tint: TINT.honey },
      { href: "/admin/orders", label: "Orders", icon: ReceiptIcon, tint: TINT.mint },
      { href: "/admin/products", label: "Products", icon: BoxIcon, tint: TINT.sky },
      { href: "/admin/returns", label: "Returns/Refund", icon: RefreshIcon, tint: TINT.rose },
      { href: "/admin/reviews", label: "Reviews", icon: StarIcon, tint: TINT.honey },
    ],
  },
  {
    // In the order of the website: the home page and its sections top to
    // bottom, then the other pages, then the popup shown over them.
    title: "Content",
    links: [
      { href: "/admin/home", label: "Home Page", icon: HomeIcon, tint: TINT.coral },
      { href: "/admin/banners", label: "Hero Banners", icon: ImageIcon, tint: TINT.coral },
      { href: "/admin/deals", label: "Deals", icon: PercentIcon, tint: TINT.honey },
      { href: "/admin/cta-banner", label: "Promo Band", icon: MegaphoneIcon, tint: TINT.coral },
      { href: "/admin/spotlight", label: "Product Spotlight", icon: SparkleIcon, tint: TINT.honey },
      { href: "/admin/testimonials", label: "Testimonials", icon: QuoteIcon, tint: TINT.lilac },
      { href: "/admin/stats", label: "Stats Counter", icon: ChartIcon, tint: TINT.mint },
      { href: "/admin/about", label: "About Page", icon: InfoIcon, tint: TINT.sky },
      { href: "/admin/contact", label: "Contact Page", icon: PhoneIcon, tint: TINT.mint },
      { href: "/admin/blogs", label: "Blog", icon: FileTextIcon, tint: TINT.cream },
      { href: "/admin/pages", label: "FAQ & Policies", icon: PagesIcon, tint: TINT.cream },
      { href: "/admin/popup", label: "Popup", icon: MessageIcon, tint: TINT.honey },
    ],
  },
  {
    title: "Store",
    links: [
      { href: "/admin/branding", label: "Branding", icon: PaletteIcon, tint: TINT.rose },
      { href: "/admin/shipping", label: "Shipping & Tax", icon: TruckIcon, tint: TINT.mint },
    ],
  },
  {
    // Each provider is its own screen — saved and tested on its own.
    title: "Integrations",
    links: [
      { href: "/admin/delivery", label: "Delivery", icon: MapPinIcon, tint: TINT.coral },
      { href: "/admin/email", label: "Email (SMTP)", icon: AtIcon, tint: TINT.sky },
      { href: "/admin/google", label: "Google Sign-in", icon: KeyIcon, tint: TINT.honey },
      { href: "/admin/payments", label: "Payments", icon: CardIcon, tint: TINT.mint },
    ],
  },
  {
    title: "Inbox",
    links: [
      { href: "/admin/inbox", label: "Messages & Subscribers", icon: MailIcon, tint: TINT.sky },
    ],
  },
];

const COLLAPSED_KEY = "lalwani_admin_collapsed";

/* A stable empty array — returning a fresh [] would loop useSyncExternalStore. */
const EMPTY_COLLAPSED: string[] = [];

/** Cached so getSnapshot returns the identical reference until storage changes. */
let collapsedCache: { raw: string | null; value: string[] } = {
  raw: null,
  value: EMPTY_COLLAPSED,
};

function readCollapsed(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(COLLAPSED_KEY);
  } catch {
    // Private mode or blocked storage — behave as if nothing is collapsed.
    return EMPTY_COLLAPSED;
  }

  if (raw !== collapsedCache.raw) {
    let parsed: string[] = EMPTY_COLLAPSED;
    try {
      const candidate = raw ? JSON.parse(raw) : null;
      if (Array.isArray(candidate)) parsed = candidate.filter((t) => typeof t === "string");
    } catch {
      parsed = EMPTY_COLLAPSED;
    }
    collapsedCache = { raw, value: parsed };
  }

  return collapsedCache.value;
}

const collapsedListeners = new Set<() => void>();

function subscribeCollapsed(onChange: () => void) {
  collapsedListeners.add(onChange);
  // Keep a second tab in step.
  window.addEventListener("storage", onChange);
  return () => {
    collapsedListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeCollapsed(next: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
  } catch {
    /* Storage unavailable — the sidebar simply will not remember. */
  }
  collapsedListeners.forEach((fn) => fn());
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  /**
   * The drawer belongs to the page it was opened on, so navigating away closes
   * it without an effect that resets state and cascades an extra render.
   */
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const closeDrawer = () => setOpenOn(null);

  /** The account menu on the profile card, keyed the same way for the same reason. */
  const [menuOn, setMenuOn] = useState<string | null>(null);
  const menuOpen = menuOn === pathname;
  const closeMenu = () => setMenuOn(null);

  /** The same menu opened from the phone bar's profile button. Its own state,
   *  so opening it never leaves the card's copy open inside the drawer. */
  const [barMenuOn, setBarMenuOn] = useState<string | null>(null);
  const barMenuOpen = barMenuOn === pathname;
  const closeBarMenu = () => setBarMenuOn(null);

  /**
   * Group titles the admin has collapsed, remembered per browser.
   *
   * useSyncExternalStore rather than an effect: localStorage does not exist
   * during SSR, so a lazy initialiser would either crash or hydrate to a
   * different value, and reading it in an effect is what the
   * set-state-in-effect rule forbids. The server snapshot is "nothing
   * collapsed", which matches the first client paint.
   */
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => EMPTY_COLLAPSED
  );

  /*
   * The store logo for the account card, so admin shows the same mark as the
   * storefront header and follows admin → Branding when a new one is uploaded.
   * Starts on the built-in default rather than empty, so the usual case paints
   * the right logo at once instead of flashing the fallback first.
   */
  const [brand, setBrand] = useState({
    logo: DEFAULT_SETTINGS.site_logo,
    name: DEFAULT_SETTINGS.site_name,
  });

  useEffect(() => {
    let cancelled = false;
    fetchSettingsClient().then((s) => {
      if (cancelled) return;
      setBrand({
        logo: s.site_logo || DEFAULT_SETTINGS.site_logo,
        name: s.site_name || DEFAULT_SETTINGS.site_name,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/admin/login?next=/admin");
    // No shop in this app to send a customer to: sign them out instead.
    else if (!user.is_admin) void logout().then(() => router.replace("/admin/login?next=/admin"));
  }, [ready, user, router, logout]);

  // Until the session is confirmed (and while a non-admin is being sent
  // away), show the panel's frame as a loading screen, not a blank page.
  if (!ready || !user || !user.is_admin) {
    return <AdminLoadingScreen brand={brand} groups={GROUPS} />;
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const toggleGroup = (title: string) =>
    writeCollapsed(collapsed.includes(title) ? collapsed.filter((t) => t !== title) : [...collapsed, title]);

  /** Shared by the two navigating entries in the account menu. */
  const accountItem =
    "flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-white/75 transition-colors hover:bg-white/8 hover:text-white";

  /**
   * The account menu's entries. Both the sidebar's profile card and the phone
   * bar's profile button open them, so they are written once; `close` shuts
   * whichever of the two menus is showing them.
   */
  const accountEntries = (close: () => void) => (
    <>
      {/* Alphabetical, like the sidebar groups; Sign Out stays last.
          No separate "Change Password" entry: the password form is
          on My Profile. */}
      <Link
        role="menuitem"
        href="/admin/profile"
        onClick={close}
        className={accountItem}
      >
        <UserIcon className="h-[15px] w-[15px] shrink-0 text-white/45" />
        My Profile
      </Link>
      {/* Settings lives in this menu only — it was taken out of the Store
          group in the nav so the sidebar lists it once. */}
      <Link
        role="menuitem"
        href="/admin/settings"
        onClick={close}
        className={accountItem}
      >
        <GearIcon className="h-[15px] w-[15px] shrink-0 text-white/45" />
        Settings
      </Link>
      {/* The shop lives in its own app; set NEXT_PUBLIC_STOREFRONT_URL to show this. */}
      {STOREFRONT_URL && (
        <a
          role="menuitem"
          href={STOREFRONT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
          className={accountItem}
        >
          <ExternalIcon className="h-[15px] w-[15px] shrink-0 text-white/45" />
          View Site
        </a>
      )}

      {/* Sign out is the one destructive entry, so it sits below a rule. */}
      <div className="my-1 border-t border-white/10" />
      <button
        role="menuitem"
        onClick={() => {
          close();
          setConfirmingSignOut(true);
        }}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[12.5px] text-rose-300 transition-colors hover:bg-white/8 hover:text-rose-200"
      >
        <LogoutIcon className="h-[15px] w-[15px] shrink-0 text-rose-300/60" />
        Sign Out
      </button>
    </>
  );

  const sidebar = (
    <aside className="scrollbar-hidden flex h-full w-64 shrink-0 flex-col overflow-y-auto bg-maroon-900 text-white">
      {/* No wordmark block above this: the logo badge in the row below already
          carries the brand, and "Dashboard" under Main goes where the wordmark
          used to link. mt-5 replaces the spacing that block used to provide. */}
      {/*
        The profile card is the account menu's trigger. Escape and a focus that
        leaves the wrapper both close it, and the open menu lays a transparent
        sheet over the viewport to catch a click anywhere else — the same
        no-document-listener approach the shop menu and the drawer already use,
        which keeps this out of an effect.
      */}
      <div
        className="relative mx-4 mb-4 mt-5"
        onKeyDown={(e) => {
          if (e.key === "Escape") closeMenu();
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) closeMenu();
        }}
      >
        <button
          type="button"
          onClick={() => setMenuOn(menuOpen ? null : pathname)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
            menuOpen ? "bg-white/15" : "bg-white/10 hover:bg-white/15"
          }`}
        >
          {/*
            The LBi emblem in place of the user's initial. Emblem only: the
            full logo is wide and a round 40px slot would crop it.
          */}
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cream ring-1 ring-white/25">
            <Brand logo={brand.logo} name={brand.name} height={40} mark />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium">{user.name}</span>
            <span className="block text-[10px] text-white/50">Administrator</span>
          </span>
          <ChevronIcon
            className={`h-3.5 w-3.5 shrink-0 text-white/50 transition-transform duration-200 ${
              menuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {menuOpen && (
          <>
            <button
              aria-hidden
              tabIndex={-1}
              onClick={closeMenu}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div
              role="menu"
              className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-white/15 bg-maroon-800 py-1 shadow-lift [animation:shopmenu_.16s_ease-out]"
            >
              {accountEntries(closeMenu)}
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 px-3 pb-4">
        {GROUPS.map((group) => {
          // The group holding the current page stays open regardless, so a
          // collapsed section can never hide where you actually are.
          const hasCurrent = group.links.some((l) => isActive(l.href));
          const open = hasCurrent || !collapsed.includes(group.title);

          return (
          <div key={group.title} className="mb-4">
            <button
              type="button"
              onClick={() => toggleGroup(group.title)}
              aria-expanded={open}
              className="group/grp flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[9.5px] font-semibold font-accent uppercase tracking-[0.18em] text-white/35 transition-colors hover:bg-white/8 hover:text-white/60"
            >
              <span className="flex-1">{group.title}</span>
              {/* Brighter and larger than the label: a chevron at the label's
                  own 9.5px and 35% opacity was invisible on the maroon. */}
              <ChevronIcon
                className={`h-3.5 w-3.5 shrink-0 text-white/60 transition-all duration-200 group-hover/grp:text-white ${
                  open ? "" : "-rotate-90"
                }`}
              />
            </button>
            <ul className={`space-y-0.5 pt-1 ${open ? "" : "hidden"}`}>
              {group.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                      isActive(l.href)
                        ? "bg-white/15 font-medium text-white"
                        : "text-white/65 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    {/* Held just under full strength so the words still lead,
                        and brought up to it on the current page. Opacity rather
                        than a second shade keeps one token per hue. */}
                    <l.icon
                      className={`h-[15px] w-[15px] shrink-0 ${l.tint} ${
                        isActive(l.href) ? "" : "opacity-80"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          );
        })}

      </nav>
    </aside>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-screen lg:block">{sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">{sidebar}</div>
          <button
            aria-label="Close menu"
            className="flex-1 bg-black/40"
            onClick={closeDrawer}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-blush-50">
        {/*
          Phone and tablet bar, laid out like the storefront header: the logo
          on the left, the account menu and the drawer's burger on the right.
          Desktop has no bar — the sidebar carries all three there.
          pr-3 rather than matching pl-5: the buttons' 40px hit areas already
          pad their icons, so this lines the burger up with the page's edge.
        */}
        <div className="flex items-center justify-between gap-3 border-b border-blush-100 bg-white py-2 pl-5 pr-3 sm:pl-6 sm:pr-4 lg:hidden">
          <Link href="/admin" aria-label={`${brand.name} dashboard`} className="flex items-center">
            <Brand logo={brand.logo} name={brand.name} height={48} />
          </Link>

          <div className="flex items-center gap-1">
            {/* Same open/close handling as the profile card's menu above. */}
            <div
              className="relative"
              onKeyDown={(e) => {
                if (e.key === "Escape") closeBarMenu();
              }}
              onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) closeBarMenu();
              }}
            >
              <button
                type="button"
                onClick={() => setBarMenuOn(barMenuOpen ? null : pathname)}
                aria-label="Account menu"
                aria-expanded={barMenuOpen}
                aria-haspopup="menu"
                className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-blush-100 hover:text-rose-600 ${
                  barMenuOpen ? "bg-blush-100 text-rose-600" : "text-cocoa"
                }`}
              >
                <UserIcon className="h-[19px] w-[19px]" />
              </button>

              {barMenuOpen && (
                <>
                  <button
                    aria-hidden
                    tabIndex={-1}
                    onClick={closeBarMenu}
                    className="fixed inset-0 z-40 cursor-default"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-white/15 bg-maroon-800 py-1 shadow-lift [animation:shopmenu_.16s_ease-out]"
                  >
                    {/* The card names who is signed in; a bare icon does not,
                        so the menu says it before the entries. */}
                    <div className="mb-1 border-b border-white/10 px-3 pb-2 pt-1.5">
                      <p className="truncate text-[12px] font-medium text-white">{user.name}</p>
                      <p className="text-[10px] text-white/50">Administrator</p>
                    </div>
                    {accountEntries(closeBarMenu)}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOpenOn(pathname)}
              aria-label="Open menu"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-blush-100"
            >
              <MenuIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
        <main className="flex-1 p-5 sm:p-6">{children}</main>
      </div>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out of the admin panel?"
        body="Anything you have typed but not saved will be lost."
        confirmLabel="Sign out"
        busy={signingOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={async () => {
          setSigningOut(true);
          await logout();
        }}
      />
    </div>
  );
}
