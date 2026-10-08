"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/** A tab hidden for less than this was only glanced away from; nothing to re-fetch. */
const MIN_HIDDEN_MS = 1500;

/**
 * Re-fetches the page's server data when the tab comes back into view after
 * being hidden (another tab, another window, the phone's app switcher) and
 * when the browser restores a page from its back/forward cache.
 *
 * The owner edits in admin in one tab and looks at the shop in another: the
 * admin save already drops the server cache the same second, but the shop
 * tab kept showing whatever it had rendered until someone pressed reload.
 * Now it shows the change the moment they switch back. Shoppers get fresh
 * prices and stock the same way. Only server-rendered parts update — the
 * cart, open menus and half-filled forms are client state and stay as they
 * are. Not used in the admin panel, which keeps its own data in sync.
 */
export function FreshOnReturn() {
  const router = useRouter();
  const pathname = usePathname();
  const inAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (inAdmin) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= MIN_HIDDEN_MS) router.refresh();
      hiddenAt = 0;
    };
    // A page pulled back out of the back/forward cache is as old as when it was left.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router, inAdmin]);

  return null;
}
