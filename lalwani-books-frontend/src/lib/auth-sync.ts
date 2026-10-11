/**
 * The shop and the admin panel keep separate sign-ins in this browser
 * (lalwani_token and lalwani_admin_token). An admin who signs in on the shop's
 * login page gets the same token in both, so signing out of either one revokes
 * it for both, and the other copy must go too or that side still looks signed
 * in (the header's "Admin" button stayed up after signing out because of it).
 *
 * The browser's own "storage" event only reaches other tabs, so a change made
 * on this tab is announced with this event as well.
 */
export const AUTH_CHANGE_EVENT = "lalwani-auth-change";

/**
 * After signing out of one side: if the other side holds the same (now
 * revoked) token, forget it as well, then let the page know.
 */
export function forgetSharedSignIn(revoked: string | null, other: { token: string; user: string }) {
  try {
    if (revoked && localStorage.getItem(other.token) === revoked) {
      localStorage.removeItem(other.token);
      localStorage.removeItem(other.user);
    }
  } catch {
    /* storage blocked: nothing saved to forget */
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}
