"use client";

import Link from "next/link";
import Image from "@/components/Image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { clientApi } from "@/lib/api";
import { useWishlistCount } from "@/lib/wishlist";
import { money } from "@/lib/format";
import type { Category, Paginated, ProductCard } from "@/lib/types";
import {
  BagIcon,
  BookIcon,
  ChevronIcon,
  CloseIcon,
  FileTextIcon,
  GridIcon,
  HeartIcon,
  HomeIcon,
  InfoIcon,
  LogoutIcon,
  MailIcon,
  MenuIcon,
  SearchIcon,
  ShieldIcon,
  ShopIcon,
  TruckIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
} from "./icons";
import { drawerIcon, drawerLink, drawerLinkActive } from "./ui";
import { Brand } from "./Brand";
import { startNavigation } from "@/lib/loading-bus";

/** Below this a search matches most of the catalogue, which helps nobody. */
const MIN_QUERY = 2;
const SUGGEST_DELAY = 220;
const SUGGEST_LIMIT = 6;

const NAV = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/collection", label: "Shop", icon: ShopIcon },
  { href: "/authors", label: "Authors", icon: UsersIcon },
  { href: "/publications", label: "Publications", icon: BookIcon },
  { href: "/about", label: "About Us", icon: InfoIcon },
  { href: "/blog", label: "Blog", icon: FileTextIcon },
  { href: "/contact", label: "Contact", icon: MailIcon },
];


/** Where a search card was opened from: the desktop pinned bar or the phone header. */
type SearchBar = "pinned" | "phone";

/** A nav item is active on its own path; query-string variants don't steal Shop. */
function isActive(pathname: string, href: string) {
  if (href.includes("?")) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Rounded grey search field with live suggestions — Bookory's centre-piece.
 *
 * Suggestions are fetched once by the header and handed to every instance
 * (desktop row, phone row, phone menu, search cards), so the fields never
 * duplicate a request.
 */
function SearchField({
  value,
  onChange,
  onSubmit,
  onPick,
  suggestions,
  searching,
  className = "",
  id,
  autoFocus = false,
  inline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onPick: () => void;
  suggestions: ProductCard[];
  searching: boolean;
  className?: string;
  id?: string;
  /** Focus the field as it appears (the pinned bar's search card). */
  autoFocus?: boolean;
  /** Results open inside the surrounding card instead of floating below it. */
  inline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const router = useRouter();

  const q = value.trim();
  const show = focused && q.length >= MIN_QUERY;
  const hasResults = suggestions.length > 0;

  function keyDown(e: React.KeyboardEvent) {
    if (!show || !hasResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setFocused(false);
      setActive(-1);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      onPick();
      setFocused(false);
      startNavigation(`/product/${suggestions[active].slug}`);
      router.push(`/product/${suggestions[active].slug}`);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`relative ${className}`}
      role="search"
      // Searching is a page change (startNavigation in submitSearch), not a save:
      // the debounced suggestions request must not raise the click-blocking veil.
      data-no-loader
      id={id}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocused(false);
          setActive(-1);
        }
      }}
    >
      <div className="flex items-center rounded-full border border-transparent bg-[#f5f5f5] pl-5 pr-1.5 transition-colors focus-within:border-rose-600 focus-within:bg-white">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(-1);
          }}
          onKeyDown={keyDown}
          placeholder="Search by title, author or ISBN…"
          aria-label="Search books"
          role="combobox"
          aria-expanded={show}
          aria-controls={show ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          className="h-12 w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-fog lg:h-11"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-rose-600 hover:text-white lg:h-9 lg:w-9"
        >
          <SearchIcon className="h-[17px] w-[17px]" strokeWidth={2} />
        </button>
      </div>

      {show && (
        <div
          className={`overflow-hidden rounded-xl border border-blush-200 bg-white ${
            inline ? "mt-3" : "absolute inset-x-0 top-full z-50 mt-2 shadow-lift"
          }`}
        >
          {hasResults ? (
            <>
              <ul id={listId} role="listbox" aria-label="Book suggestions" className="max-h-[22rem] overflow-auto p-1.5">
                {suggestions.map((p, i) => (
                  <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                    <Link
                      href={`/product/${p.slug}`}
                      onClick={() => {
                        onPick();
                        setFocused(false);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${i === active ? "bg-blush-100" : ""}`}
                    >
                      <span
                        className="relative h-12 w-9 shrink-0 overflow-hidden rounded"
                        style={{ background: `linear-gradient(135deg, ${p.colors.from}, ${p.colors.to})` }}
                      >
                        {p.image && <Image src={p.image} alt="" fill sizes="36px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{p.name}</span>
                        {p.author && <span className="block truncate text-[11.5px] text-fog">{p.author}</span>}
                      </span>
                      <span className="shrink-0 text-[13px] font-semibold text-rose-600">{money(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="submit"
                className="block w-full border-t border-blush-200 px-4 py-2.5 text-left text-[12px] font-medium text-rose-600 transition-colors hover:bg-blush-50"
              >
                See all results for &ldquo;{q}&rdquo; &rarr;
              </button>
            </>
          ) : (
            <p className="px-4 py-5 text-center text-[12.5px] text-fog">
              {searching ? "Searching…" : `No books match “${q}”.`}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

/** The coral "Categories" pill and its drop-down list of every category. */
function CategoriesMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className="relative"
      onMouseEnter={() => {
        if (timer.current) clearTimeout(timer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        timer.current = setTimeout(() => setOpen(false), 160);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex h-11 w-[200px] items-center gap-3 rounded-full bg-rose-600 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700"
      >
        <GridIcon className="h-[17px] w-[17px]" />
        Categories
        <ChevronIcon className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[260px] overflow-hidden rounded-xl border border-blush-200 bg-white py-2 shadow-lift [animation:shopmenu_.16s_ease-out]">
          {categories.length === 0 ? (
            <p className="px-5 py-3 text-[13px] text-fog">No categories yet.</p>
          ) : (
            categories.map((c) => (
              <Link
                key={c.id}
                href={`/collection?category=${c.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-5 py-2.5 text-[13.5px] text-cocoa transition-colors hover:bg-blush-50 hover:text-rose-600"
              >
                <span>{c.name}</span>
                {c.products_count > 0 && <span className="text-[11px] text-fog">{c.products_count}</span>}
              </Link>
            ))
          )}
          <Link
            href="/collection"
            onClick={() => setOpen(false)}
            className="mt-1 block border-t border-blush-200 px-5 pt-3 pb-1.5 text-[13px] font-semibold text-rose-600"
          >
            All books &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * True for staff: a customer session flagged is_admin, or an admin-panel
 * session in this browser (the panel keeps its own sign-in). Read after mount,
 * through useSyncExternalStore, so the server render (no admin) and the first
 * client render agree.
 */
function readPanelAdmin() {
  try {
    const raw = localStorage.getItem("lalwani_admin_user");
    return Boolean(raw && JSON.parse(raw)?.is_admin);
  } catch {
    return false;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function useIsAdmin(storeUserIsAdmin: boolean) {
  const panel = useSyncExternalStore(subscribeStorage, readPanelAdmin, () => false);
  return storeUserIsAdmin || panel;
}

export function Header({
  logo,
  siteName = "Lalwani Books International",
  categories = [],
}: {
  logo?: string | null;
  siteName?: string;
  categories?: Category[];
}) {
  const { count, openCart } = useCart();
  const wishCount = useWishlistCount();
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin(Boolean(user?.is_admin));
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const [found, setFound] = useState<{ q: string; items: ProductCard[] }>({ q: "", items: [] });
  const trimmed = query.trim();
  const suggestions = found.q === trimmed ? found.items : [];
  const searching = trimmed.length >= MIN_QUERY && found.q !== trimmed;

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      clientApi<Paginated<ProductCard>>(`/products?search=${encodeURIComponent(q)}&per_page=${SUGGEST_LIMIT}`, {
        token: null,
        cartToken: null,
        signal: controller.signal,
      })
        .then((res) => setFound({ q, items: res.data }))
        .catch(() => {});
    }, SUGGEST_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // The drawer belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const closeMenu = () => setOpenOn(null);
  const [signingOut, setSigningOut] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

  // Desktop: the slim bar pinned to the top once the full header has scrolled
  // away. Phones: the header itself is sticky, and `scrolled` folds its search
  // row away so it takes less of the screen.
  const headerRef = useRef<HTMLElement>(null);
  const [pinned, setPinned] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Phones: only the home page opens with the search row under the logo. Every
  // other page shows the folded header from the start (the search icon in the
  // bar instead), the way the home page looks once scrolled (owner's request).
  const alwaysFolded = pathname !== "/";
  const folded = scrolled || alwaysFolded;

  // A bar's search icon opens a search card under it: the desktop pinned bar,
  // or the phone header once its search row has folded away. Like the drawer
  // the card belongs to the page it was opened on, and it leaves with its bar.
  const [searchOn, setSearchOn] = useState<{ path: string; bar: SearchBar } | null>(null);
  // Leaving the page forgets the card, so it can't reappear when the shopper
  // comes back (Back/Forward fire no tap to close it, and on a page that is
  // always folded no scroll back to the top closes it either). Reset during
  // render, so the card never flashes open for a frame.
  const [searchPath, setSearchPath] = useState(pathname);
  if (searchPath !== pathname) {
    setSearchPath(pathname);
    setSearchOn(null);
  }
  const searchBar = searchOn?.path === pathname ? searchOn.bar : null;
  const pinnedSearchOpen = searchBar === "pinned" && pinned;
  const phoneSearchOpen = searchBar === "phone" && folded;
  const searchOpen = pinnedSearchOpen || phoneSearchOpen;
  const pinnedSearchBtn = useRef<HTMLButtonElement>(null);
  const phoneSearchBtn = useRef<HTMLButtonElement>(null);
  const searchCard = useRef<HTMLDivElement>(null);
  const toggleSearch = (bar: SearchBar) =>
    setSearchOn((on) => (on?.path === pathname && on.bar === bar ? null : { path: pathname, bar }));
  const closeSearch = () => setSearchOn(null);

  useEffect(() => {
    const onScroll = () => {
      const h = headerRef.current?.offsetHeight ?? 200;
      const y = window.scrollY;
      const pin = y > h + 40;
      setPinned(pin);
      // The pinned bar slides away below its line; the home page's phone
      // header unfolds its search row at the very top (where `scrolled` turns
      // off). Other pages stay folded, so their card stays open there.
      setSearchOn((on) => (on && (on.bar === "pinned" ? !pin : !alwaysFolded && y <= 20) ? null : on));
      // Two thresholds, so the header shrinking as the search row folds can
      // never push the page back across the line and make it flicker.
      setScrolled((was) => (was ? y > 20 : y > 90));
    };
    const first = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", onScroll);
    };
  }, [alwaysFolded]);

  // Phones: keep the page's scroll-padding-top (globals.css) equal to this
  // sticky header's height. Next.js counts a new page whose content starts
  // under the header as not yet at the top and scrolls it up; a #link or a
  // focused field also stops below the header instead of underneath it.
  // A layout effect, so a header mounted by a page change (home ↔ shop) has
  // set it before Next.js checks where the new page's content sits.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement.style;
    const sync = () => root.setProperty("--phone-header-h", `${el.offsetHeight}px`);
    sync();
    const resize = new ResizeObserver(sync);
    resize.observe(el);
    return () => {
      resize.disconnect();
      root.removeProperty("--phone-header-h");
    };
  }, []);

  // A click or tap outside the card, or Escape, closes it. (Pointer events, so
  // a tap closes it on phones too.)
  useEffect(() => {
    if (!searchOpen) return;
    const btn = pinnedSearchOpen ? pinnedSearchBtn : phoneSearchBtn;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!searchCard.current?.contains(t) && !btn.current?.contains(t)) setSearchOn(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSearchOn(null);
      btn.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, pinnedSearchOpen]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      closeMenu();
    }
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    const href = q ? `/collection?search=${encodeURIComponent(q)}` : "/collection";
    startNavigation(href);
    router.push(href);
  }

  // Phones get larger targets and symbols, scaled to the screen width so the
  // logo and four icons still fit on a 290px phone; lg: keeps the desktop sizes.
  const iconLink =
    "relative flex h-[clamp(36px,12.3vw,48px)] w-[clamp(36px,12.3vw,48px)] items-center justify-center rounded-full text-ink transition-colors hover:text-rose-600 lg:h-10 lg:w-10";
  const iconGlyph = "h-[clamp(22px,7vw,28px)] w-[clamp(22px,7vw,28px)] lg:h-[21px] lg:w-[21px]";
  const badge =
    "absolute -right-0.5 -top-0.5 flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10.5px] font-semibold text-white lg:h-[17px] lg:min-w-[17px] lg:text-[9.5px]";

  // Account, wishlist, cart and the phone menu button — drawn in both the full
  // header and the pinned bar. Phones keep the wishlist in the menu instead,
  // which leaves room for the search icon.
  const actionIcons = (
    <>
      <Link href={user ? "/account" : "/login"} aria-label={user ? "Your account" : "Sign in"} className={iconLink}>
        <UserIcon className={iconGlyph} />
      </Link>
      <Link
        href="/wishlist"
        aria-label={wishCount > 0 ? `Wishlist, ${wishCount} saved` : "Wishlist"}
        className={`${iconLink} max-sm:hidden`}
      >
        <HeartIcon className={iconGlyph} />
        <span className={badge}>{wishCount}</span>
      </Link>
      <button type="button" onClick={openCart} aria-label={`Cart, ${count} items`} className={iconLink}>
        <BagIcon className={iconGlyph} />
        <span className={badge}>{count}</span>
      </button>
      <button
        type="button"
        onClick={() => setOpenOn(pathname)}
        className={`${iconLink} lg:hidden`}
        aria-label="Open menu"
      >
        <MenuIcon className="h-[clamp(23px,7.3vw,29px)] w-[clamp(23px,7.3vw,29px)]" />
      </button>
    </>
  );

  // The search card's contents, for whichever bar opened it: the same live
  // search as the full header, and the categories to browse while nothing is
  // typed (wrapped on desktop, one swipeable row on phones).
  const searchCardBody = (
    <>
      <SearchField
        value={query}
        onChange={setQuery}
        onSubmit={(e) => {
          submitSearch(e);
          closeSearch();
        }}
        onPick={() => {
          setQuery("");
          closeSearch();
        }}
        suggestions={suggestions}
        searching={searching}
        autoFocus
        inline
      />
      {trimmed.length < MIN_QUERY && categories.length > 0 && (
        <div className="mt-4 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog">Browse categories</p>
          <div className="scrollbar-hidden mt-2.5 flex gap-2 overflow-x-auto max-lg:-mx-5 max-lg:px-5 lg:flex-wrap">
            {categories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={`/collection?category=${c.slug}`}
                onClick={closeSearch}
                className="shrink-0 whitespace-nowrap rounded-full border border-blush-200 px-3.5 py-1.5 text-[12.5px] text-cocoa transition-colors hover:border-rose-600 hover:text-rose-600"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const navLinks = NAV.map((item) => {
    const active = isActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={`relative py-1 transition-colors hover:text-rose-600 after:absolute after:-bottom-0.5 after:left-0 after:h-[2px] after:rounded-full after:bg-rose-600 after:transition-all after:duration-300 ${
            active ? "text-rose-600 after:w-full" : "after:w-0 hover:after:w-full"
          }`}
        >
          {item.label}
        </Link>
      </li>
    );
  });

  return (
    <>
    {/* Pinned bar: slides down once the full header has scrolled out of view,
        so the menu, search and cart stay one tap away. `inert` while hidden
        keeps it out of the tab order and away from screen readers. */}
    <div
      inert={!pinned}
      className={`fixed inset-x-0 top-0 z-50 hidden border-b border-blush-200 bg-white shadow-[0_8px_24px_-16px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out lg:block ${
        pinned ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container-shop relative flex h-16 items-center gap-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label={siteName}>
          <Brand logo={logo} name={siteName} height={38} heightClass="h-[34px] lg:h-[38px]" />
        </Link>
        <nav aria-label="Main (pinned)" className="hidden flex-1 lg:block">
          <ul className="flex items-center justify-center gap-9 text-[14px] font-semibold text-ink">{navLinks}</ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <button
            ref={pinnedSearchBtn}
            type="button"
            onClick={() => toggleSearch("pinned")}
            aria-label={pinnedSearchOpen ? "Close search" : "Search books"}
            aria-expanded={pinnedSearchOpen}
            aria-controls="pinned-search"
            className={`${iconLink} aria-expanded:text-rose-600`}
          >
            {pinnedSearchOpen ? <CloseIcon className="h-[18px] w-[18px]" /> : <SearchIcon className="h-[20px] w-[20px]" />}
          </button>
          {actionIcons}
        </div>

        {pinnedSearchOpen && (
          <div
            ref={searchCard}
            id="pinned-search"
            className="absolute right-8 top-full mt-2 w-[30rem] rounded-2xl border border-blush-200 bg-white p-4 shadow-lift [animation:shopmenu_.16s_ease-out]"
          >
            {searchCardBody}
          </div>
        )}
      </div>
    </div>

    <header
      ref={headerRef}
      // Sticky below desktop width only (max-lg:), so nothing has to undo it on
      // desktop, where the slim pinned bar takes over instead.
      className={`relative z-40 bg-white transition-shadow duration-300 max-lg:sticky max-lg:top-0 ${
        scrolled ? "max-lg:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.35)]" : ""
      }`}
    >
      {/* No dark top strip: Track Order, the phone number and the social icons
          live in the footer (and Track Order in the phone menu). */}

      {/* Logo · Categories · Search · Account icons */}
      <div className={`container-shop flex items-center gap-2 transition-[padding] duration-300 lg:gap-6 lg:py-6 ${folded ? "py-3.5" : "py-5"}`}>
        <Link href="/" className="flex shrink-0 items-center" aria-label={siteName}>
          <Brand logo={logo} name={siteName} height={52} heightClass="h-[clamp(38px,13.9vw,56px)] lg:h-[52px]" />
        </Link>

        <div className="hidden flex-1 items-center gap-3 lg:flex xl:ml-8">
          <CategoriesMenu categories={categories} />
          <SearchField
            value={query}
            onChange={setQuery}
            onSubmit={submitSearch}
            onPick={() => setQuery("")}
            suggestions={suggestions}
            searching={searching}
            className="max-w-[560px] flex-1"
          />
        </div>

        <div className="ml-auto flex items-center gap-0 lg:ml-0 lg:gap-1">
          {isAdmin && (
            <Link
              href="/admin"
              className="mr-1 hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-rose-600 sm:flex"
            >
              <ShieldIcon className="h-4 w-4" />
              Admin
            </Link>
          )}
          {/* Phones, while the search row below is folded away. */}
          {folded && (
            <button
              ref={phoneSearchBtn}
              type="button"
              onClick={() => toggleSearch("phone")}
              aria-label={phoneSearchOpen ? "Close search" : "Search books"}
              aria-expanded={phoneSearchOpen}
              aria-controls="phone-search"
              className={`${iconLink} aria-expanded:text-rose-600 lg:hidden`}
            >
              {phoneSearchOpen ? (
                <CloseIcon className="h-[clamp(19px,6vw,24px)] w-[clamp(19px,6vw,24px)]" />
              ) : (
                <SearchIcon className={iconGlyph} />
              )}
            </button>
          )}
          {actionIcons}
        </div>
      </div>

      {/* Phone search card, hanging under the folded header (right-aligned
          and capped in width on tablets). Only the card itself takes taps. */}
      {phoneSearchOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-full lg:hidden">
          <div className="container-shop pt-2">
            <div
              ref={searchCard}
              id="phone-search"
              className="pointer-events-auto ml-auto max-w-[30rem] rounded-2xl border border-blush-200 bg-white p-4 shadow-lift [animation:shopmenu_.16s_ease-out]"
            >
              {searchCardBody}
            </div>
          </div>
        </div>
      )}

      {/* Phones: search on its own row at the top of the home page; folded away
          while scrolled and on every other page (the search icon above then
          opens the search card). */}
      <div className={`container-shop lg:hidden ${folded ? "hidden" : "pb-4"}`}>
        <SearchField
          value={query}
          onChange={setQuery}
          onSubmit={submitSearch}
          onPick={() => setQuery("")}
          suggestions={suggestions}
          searching={searching}
        />
      </div>

      {/* Centred main menu */}
      <nav aria-label="Main" className="hidden border-y border-blush-200 lg:block">
        <ul className="container-shop flex h-[60px] items-center justify-center gap-11 text-[14px] font-semibold text-ink">
          {navLinks}
        </ul>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={closeMenu}>
          <div
            className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col overflow-hidden bg-white p-5 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <Brand logo={logo} name={siteName} height={38} />
              <button onClick={closeMenu} className="flex h-9 w-9 items-center justify-center rounded-full bg-blush-150 text-ink" aria-label="Close menu">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            {/* No search box here (the owner asked): phones search from the row
                at the top of the home page, or the search icon in the bar. */}
            {/* Scrolls by touch with no visible bar. */}
            <nav className="scrollbar-hidden flex flex-col gap-0.5 overflow-y-auto text-[14.5px] text-cocoa">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`${drawerLink} ${isActive(pathname, item.href) ? drawerLinkActive : ""}`}
                >
                  <item.icon className={drawerIcon} />
                  {item.label}
                </Link>
              ))}
              {/* Categories fold away behind one row so the menu stays short. */}
              {categories.length > 0 && (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setCatsOpen((v) => !v)}
                    aria-expanded={catsOpen}
                    aria-controls="drawer-categories"
                    className={`${drawerLink} w-full text-left ${catsOpen ? "bg-blush-100 text-ink" : ""}`}
                  >
                    <GridIcon className={drawerIcon} />
                    <span className="flex-1">Categories</span>
                    <ChevronIcon
                      className={`h-4 w-4 shrink-0 text-fog transition-transform duration-200 ${catsOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {catsOpen && (
                    <div id="drawer-categories" className="ml-4 flex flex-col gap-0.5 border-l border-blush-200 pl-2 [animation:shopmenu_.16s_ease-out]">
                      {categories.map((c) => (
                        <Link key={c.id} href={`/collection?category=${c.slug}`} className={`${drawerLink} py-2.5 text-[14px]`}>
                          <BookIcon className={drawerIcon} />
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <hr className="my-3 border-blush-200" />
              <Link href="/wishlist" className={drawerLink}>
                <HeartIcon className={drawerIcon} />
                Wishlist {wishCount > 0 ? `(${wishCount})` : ""}
              </Link>
              <Link href="/cart" className={drawerLink}>
                <BagIcon className={drawerIcon} />
                Cart {count > 0 ? `(${count})` : ""}
              </Link>
              <Link href="/track-order" className={drawerLink}>
                <TruckIcon className={drawerIcon} />
                Track Order
              </Link>
              {isAdmin && (
                <Link href="/admin" className={drawerLink}>
                  <ShieldIcon className={drawerIcon} />
                  Admin Panel
                </Link>
              )}
              {user ? (
                <Link href="/account" className={drawerLink}>
                  <UserIcon className={drawerIcon} />
                  My Account
                </Link>
              ) : (
                <>
                  <Link href="/login" className={drawerLink}>
                    <UserIcon className={drawerIcon} />
                    Sign In
                  </Link>
                  <Link href="/register" className={drawerLink}>
                    <UserPlusIcon className={drawerIcon} />
                    Create Account
                  </Link>
                </>
              )}
              {user && (
                <button type="button" onClick={signOut} disabled={signingOut} className={`${drawerLink} w-full text-left disabled:opacity-60`}>
                  <LogoutIcon className={drawerIcon} />
                  {signingOut ? "Signing out…" : "Sign Out"}
                </button>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
    </>
  );
}
