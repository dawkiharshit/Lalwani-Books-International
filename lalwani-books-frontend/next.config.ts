import path from "node:path";
import type { NextConfig } from "next";

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1").replace(/\/api\/v1\/?$/, "");

const nextConfig: NextConfig = {
  // Drops "X-Powered-By: Next.js" — it tells a scanner what to look for and
  // buys nothing in return.
  poweredByHeader: false,
  // How long the browser keeps a pre-rendered page (a book page, the home
  // page) for client-side navigation before asking the server again. The
  // default is five minutes: after a photo or price change in admin the
  // server cache is dropped at once (see /revalidate), yet a shopper tab that
  // had the page cached kept showing the old copy until a hard reload. Thirty
  // seconds keeps clicks instant while an edit shows on the next visit.
  experimental: {
    staleTimes: { static: 30 },
  },
  // Dev only: allow the dev server (HMR, RSC, chunks) to be reached from these
  // hosts. Next 16 blocks cross-origin dev requests by default, so opening the
  // app at 127.0.0.1 while the server assumes localhost got its scripts 403'd —
  // the page rendered but never hydrated, so nothing was clickable.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.15"],
  // Pin the Turbopack workspace root to this app. Without it Next.js walks up
  // the tree and can latch onto an unrelated lockfile in a parent directory.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Category and product photography is hosted on the Unsplash CDN (Unsplash
  // Licence). next/image refuses remote hosts unless they are declared here, so
  // without this every category tile renders as a broken image.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
    ],
    // Trimmed from the defaults (8 device + 8 image widths). Every next/image
    // writes one srcset entry per width into the HTML, and a proxied Unsplash
    // URL is ~200 bytes once encoded — the home page was shipping 962 of them,
    // most of its 494 kB. These widths still cover phone through 2x desktop;
    // 3840 was only ever used by 4K displays that downscale anyway.
    deviceSizes: [640, 828, 1080, 1440, 1920],
    imageSizes: [64, 128, 256, 384],
    // How long a resized image is served from cache before the server
    // re-checks the original. The default is a few hours, after which the
    // Node process fetches and re-encodes the photo again. Uploads get a
    // fresh random filename (Laravel's store()), so a given URL never
    // changes content; a month is safe and saves that work on shared CPU.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  /**
   * Baseline security headers. The app shipped with none, so any site could
   * frame the storefront — and framing a page that holds a checkout and an
   * admin panel is how clickjacking gets a customer to click something they
   * cannot see.
   *
   * The CSP below deliberately omits script-src. A policy strict enough to
   * block inline scripts needs a per-request nonce, and Next's own docs are
   * explicit that nonces force dynamic rendering — which would throw away the
   * static generation of all 73 pages. The directives kept here need no nonce,
   * cost nothing, and still close off real attacks: plugin content, <base>
   * rewriting, form hijacking and framing.
   */
  async headers() {
    /*
     * No `default-src`, deliberately. Directives left out of a CSP are simply
     * unenforced, but `default-src` is the fallback for the ones you omit — so
     * `default-src 'self'` silently becomes a script-src too and blocks every
     * inline script Next emits for the RSC payload. That white-screened the
     * home page with 183 violations the first time.
     *
     * What is left needs no nonce, cannot block a script or a stylesheet, and
     * still shuts off four real attack routes.
     */
    const csp = [
      // No plugin content, ever. Blocks a whole class of legacy payloads.
      "object-src 'none'",
      // Stops injected markup rewriting every relative URL on the page.
      "base-uri 'self'",
      // A posted form cannot be redirected to someone else's server.
      "form-action 'self'",
      // Same intent as X-Frame-Options, for browsers that prefer CSP.
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          // Blocks the site being framed by another origin.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stops a browser second-guessing a declared Content-Type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the origin, never the full path, to other sites.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here needs these, so no embedded frame gets them either.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy", value: csp },
          /*
           * Browsers ignore this over plain HTTP, so it is inert locally and
           * takes effect the moment the site is served over TLS. One year,
           * without includeSubDomains or preload: those are far harder to undo
           * and should be a deliberate choice once every subdomain is on HTTPS.
           */
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },

  // Publishers moved into Categories & Authors as its Publications tab; the
  // old address still lands there.
  async redirects() {
    return [
      { source: "/admin/publishers", destination: "/admin/categories?tab=publications", permanent: false },
      // The Instagram screen was removed; its section went with it.
      { source: "/admin/instagram", destination: "/admin/home", permanent: false },
    ];
  },

  // Admin-uploaded product photos live in Laravel storage; proxy them through
  // this origin so every <img>/<Image> stays same-origin (no CORS surprises).
  async rewrites() {
    return [
      {
        source: "/storage/:path*",
        destination: `${API_ORIGIN}/storage/:path*`,
      },
    ];
  },
};

export default nextConfig;
