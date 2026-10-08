import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

/*
 * Maintenance mode is read from the settings API, but no visitor ever waits
 * for that read. The flag is served from memory and refreshed in the
 * background once it is older than REFRESH_MS (stale-while-revalidate).
 *
 * It used to await the fetch inline, with no timeout: every 15 seconds one
 * unlucky visitor's page sat behind a full API round trip, and a slow or
 * hung API stalled that page for as long as the API did. Switching
 * maintenance on now takes effect within about a minute instead of 15
 * seconds, which is a fair trade for never blocking a page on it.
 */
const REFRESH_MS = 60_000;
const TIMEOUT_MS = 3_000;

let state = { on: false, at: 0 };
// One refresh at a time; concurrent requests share it rather than stampede.
let inflight: Promise<void> | null = null;

function refresh(): Promise<void> {
  inflight ??= fetch(`${API_BASE}/settings`, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
    .then((res) => res.json())
    .then((json) => {
      state = { on: String(json?.data?.maintenance_mode ?? "0") === "1", at: Date.now() };
    })
    // If settings can't be read, never lock the whole site out — keep the
    // last known value and try again on the next window.
    .catch(() => {
      state = { ...state, at: Date.now() };
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function maintenanceOn(): Promise<boolean> {
  // The very first request after the server starts has nothing to go on, so
  // it waits (bounded by the timeout); every later one answers from memory.
  if (state.at === 0) await refresh();
  else if (Date.now() - state.at > REFRESH_MS) void refresh();
  return state.on;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // The admin panel, login and the maintenance page itself must always stay
  // reachable — otherwise there is no way to switch maintenance back off.
  // /revalidate is Laravel clearing the page cache after an admin save.
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/revalidate") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  if (await maintenanceOn()) {
    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on page routes only — skip Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|storage/).*)"],
};
