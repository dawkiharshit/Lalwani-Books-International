/**
 * The site-wide "something is loading" state behind the loading screen
 * (components/loading/LoadingLayer.tsx). Plain module state with a subscribe
 * function, so it can be fed from anywhere — the API helpers, the document's
 * click and submit listeners, a router.push — and read with
 * useSyncExternalStore.
 *
 * Two things are tracked:
 *
 *  - Navigation: from a link click or startNavigation() until the address
 *    changes (endNavigation(), called by LoadingLayer when the pathname or
 *    search changes). A start that never lands — a link Next decides not to
 *    follow — is cleared by a safety timeout.
 *
 *  - Form submissions: a submit opens a short window; any API request started
 *    in it (or straight after another such request, for saves that upload a
 *    photo next) belongs to the submission, which ends once those requests
 *    have all finished. A submit that never sends anything — a validation
 *    message — shows nothing.
 *
 * Browser-only: every entry point is a no-op during server rendering.
 */

export type LoadingKind = "idle" | "navigation" | "submit";

export interface LoadingSnapshot {
  kind: LoadingKind;
  /** Bumps on every new navigation or submission, so the UI can restart its animations. */
  run: number;
}

/** How long after a submit a request still counts as belonging to it. */
const SUBMIT_WINDOW_MS = 800;
/** A follow-on request starting this soon after the last one ended continues the same save. */
const CHAIN_MS = 250;
/** A navigation whose address never changes is given up after this long. */
const NAV_TIMEOUT_MS = 8000;
/** However long a save runs, its click-blocking veil lifts after this long. */
const SUBMIT_MAX_MS = 25000;

let snapshot: LoadingSnapshot = { kind: "idle", run: 0 };
const listeners = new Set<() => void>();

let navigating = false;
let navTimer: ReturnType<typeof setTimeout> | undefined;

let submitWindowUntil = 0;
let submitRequests = 0;
let lastSubmitRequestEnd = 0;
let submitEndTimer: ReturnType<typeof setTimeout> | undefined;
let submitCapTimer: ReturnType<typeof setTimeout> | undefined;
/** Bumped when a save is given up, so its late-settling requests are ignored. */
let submitSession = 0;

const isBrowser = () => typeof window !== "undefined";

function publish() {
  const kind: LoadingKind = submitRequests > 0 ? "submit" : navigating ? "navigation" : "idle";
  if (kind === snapshot.kind) return;
  // A new run only when loading starts from idle: a save that hands straight
  // over to a page change keeps the same veil and bar, without a blink.
  snapshot = { kind, run: snapshot.kind === "idle" ? snapshot.run + 1 : snapshot.run };
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSnapshot(): LoadingSnapshot {
  return snapshot;
}

const IDLE: LoadingSnapshot = { kind: "idle", run: 0 };
export function getServerSnapshot(): LoadingSnapshot {
  return IDLE;
}

/** The same page — path and query — as the one showing now, ignoring any #hash. */
function isCurrent(url: URL) {
  // Queries compared parsed, as the router sees them: `a+b` and `a%20b` are one search.
  const query = (search: string) => new URLSearchParams(search).toString();
  return url.pathname === window.location.pathname && query(url.search) === query(window.location.search);
}

/**
 * Marks the start of a client-side navigation. Pass the destination when it is
 * known: a navigation to the page already showing is ignored, since its
 * address would never change and the loader would have nothing to end it.
 */
export function startNavigation(href?: string) {
  if (!isBrowser()) return;
  if (href !== undefined) {
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin || isCurrent(url)) return;
  }
  navigating = true;
  clearTimeout(navTimer);
  navTimer = setTimeout(endNavigation, NAV_TIMEOUT_MS);
  publish();
}

/** The new page is showing (or the navigation was given up). */
export function endNavigation() {
  if (!navigating) return;
  navigating = false;
  clearTimeout(navTimer);
  publish();
}

/** A form was submitted: requests that start in the next moment belong to it. */
export function noteSubmit() {
  if (!isBrowser()) return;
  submitWindowUntil = Date.now() + SUBMIT_WINDOW_MS;
}

/**
 * Called by the API helpers around every browser request. Returns the
 * function to call when the request settles (whatever the outcome).
 */
export function beginRequest(): () => void {
  if (!isBrowser()) return () => {};
  const now = Date.now();
  // Only requests the submit itself sends: those starting in its window, or
  // straight after the previous one (a photo upload after the save). A
  // background refresh that happens to overlap does not join.
  const partOfSubmit = now <= submitWindowUntil || (lastSubmitRequestEnd > 0 && now - lastSubmitRequestEnd <= CHAIN_MS);
  if (!partOfSubmit) return () => {};

  if (submitRequests === 0) {
    clearTimeout(submitCapTimer);
    submitCapTimer = setTimeout(abandonSubmit, SUBMIT_MAX_MS);
  }
  submitRequests += 1;
  clearTimeout(submitEndTimer);
  publish();

  const session = submitSession;
  let ended = false;
  return () => {
    if (ended || session !== submitSession) return;
    ended = true;
    submitRequests -= 1;
    lastSubmitRequestEnd = Date.now();
    if (submitRequests > 0) return;
    // Wait a beat before calling the save finished: a photo upload that
    // follows the main request keeps the same loading screen up.
    clearTimeout(submitEndTimer);
    submitEndTimer = setTimeout(() => {
      if (submitRequests === 0) {
        clearTimeout(submitCapTimer);
        submitWindowUntil = 0;
        lastSubmitRequestEnd = 0;
        publish();
      }
    }, CHAIN_MS);
  };
}

/** A save that has run too long: lift its veil; its requests settle unseen. */
function abandonSubmit() {
  submitSession += 1;
  submitRequests = 0;
  submitWindowUntil = 0;
  lastSubmitRequestEnd = 0;
  clearTimeout(submitEndTimer);
  publish();
}

/**
 * Clears everything — for a page restored from the back/forward cache, which
 * comes back exactly as it was left, loader and all.
 */
export function resetLoading() {
  navigating = false;
  clearTimeout(navTimer);
  clearTimeout(submitCapTimer);
  abandonSubmit();
}

/** Wraps a request promise so it is counted while in flight. */
export function track<T>(request: Promise<T>): Promise<T> {
  const done = beginRequest();
  return request.finally(done);
}
