import type { User } from "./types";

/** What a staff member may do in one area (admin → Staff). */
export type StaffLevel = "none" | "view" | "approval" | "direct";

/**
 * Which area each admin page belongs to — the same areas as the server's
 * App\Support\StaffAccess. Pages not listed (integrations, staff, approvals)
 * are the owner's alone.
 */
const PAGE_AREAS: [prefix: string, area: string][] = [
  ["/admin/search-insights", "insights"],
  ["/admin/products", "products"],
  ["/admin/categories", "categories"],
  ["/admin/orders", "orders"],
  ["/admin/returns", "returns"],
  ["/admin/coupons", "coupons"],
  ["/admin/deals", "coupons"],
  ["/admin/reviews", "reviews"],
  ["/admin/home", "content"],
  ["/admin/banners", "content"],
  ["/admin/cta-banner", "content"],
  ["/admin/spotlight", "content"],
  ["/admin/testimonials", "content"],
  ["/admin/stats", "content"],
  ["/admin/about", "content"],
  ["/admin/contact", "content"],
  ["/admin/blogs", "content"],
  ["/admin/pages", "content"],
  ["/admin/popup", "content"],
  ["/admin/branding", "content"],
  ["/admin/shipping", "content"],
  ["/admin/settings", "content"],
  ["/admin/inbox", "inbox"],
  ["/admin/voice-queries", "inbox"],
];

/** Pages every staff member has: their own account and their own changes. */
const OWN_PAGES = ["/admin/profile", "/admin/password", "/admin/my-changes"];

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + "/");

/** The area a page belongs to: "own" for a staff member's own pages, null for the owner's. */
export function pageArea(pathname: string): string | "own" | null {
  if (pathname === "/admin") return "dashboard";
  if (OWN_PAGES.some((p) => matches(pathname, p))) return "own";
  return PAGE_AREAS.find(([prefix]) => matches(pathname, prefix))?.[1] ?? null;
}

/** Can this signed-in user open this admin page? */
export function canOpen(user: User, pathname: string): boolean {
  if (user.is_admin) return true;
  if (!user.staff) return false;
  const area = pageArea(pathname);
  if (area === "own") return true;
  return area !== null && (user.staff.areas[area] ?? "none") !== "none";
}

/** Where a staff member lands when the page they asked for is not theirs. */
export function firstPage(user: User): string {
  if (canOpen(user, "/admin")) return "/admin";
  const first = PAGE_AREAS.find(([prefix]) => canOpen(user, prefix));
  return first ? first[0] : "/admin/my-changes";
}

export const LEVEL_LABELS: Record<StaffLevel, string> = {
  none: "No access",
  view: "View only",
  approval: "Edit — needs my approval",
  direct: "Edit — goes live directly",
};
