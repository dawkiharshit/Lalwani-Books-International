import Link from "next/link";
import { api } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import type { Category } from "@/lib/types";
import { BUILT_IN_LOGO, LOGO_RATIO, isBuiltInLogo } from "./Brand";
import { FooterColumns, type FooterColumn } from "./FooterColumns";
import { NewsletterForm } from "./NewsletterForm";
import { SocialIcon3D } from "./SocialIcon3D";
import { BookOpenIcon, ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "./icons";

/** Build credit. Verified live before linking — it leaves the storefront. */
const DEVELOPER = {
  name: "Dawki Infotech Pvt. Ltd.",
  href: "https://dawkiinfotech.com",
};

const EXPLORE: FooterColumn = {
  title: "Explore",
  links: [
    { label: "About Us", href: "/about" },
    { label: "All Books", href: "/collection" },
    { label: "New Arrivals", href: "/collection?sort=newest" },
    { label: "Blog", href: "/blog" },
    { label: "Contact Us", href: "/contact" },
  ],
};

const SERVICE: FooterColumn = {
  title: "Our Service",
  links: [
    { label: "My Account", href: "/account" },
    { label: "Track Order", href: "/track-order" },
    { label: "Wishlist", href: "/wishlist" },
    { label: "FAQ", href: "/pages/faq" },
    { label: "Shipping & Returns", href: "/contact#returns" },
  ],
};

/**
 * The shelf of book spines the footer stands under. Fixed pseudo-random
 * (seeded), so the server and the browser draw the same books; enough of them
 * to fill a very wide screen, centred and clipped at both edges.
 */
const SPINE_COLORS = ["#042b52", "#e8b04b", "#2b5d92", "#a9bfd9", "#5c7896", "#8db1dc", "#b98a2e", "#1b4675", "#e8eef6"];
const SPINES = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  let previous = -1;
  return Array.from({ length: 110 }, (_, i) => {
    let color = Math.floor(rnd() * SPINE_COLORS.length);
    if (color === previous) color = (color + 3) % SPINE_COLORS.length;
    previous = color;
    const height = 30 + Math.round(rnd() * 26);
    return {
      color: SPINE_COLORS[color],
      height,
      width: 12 + Math.round(rnd() * 12),
      // Now and then a book leans on its neighbour.
      lean: i % 13 === 6 ? 8 : 0,
    };
  });
})();

function Bookshelf() {
  return (
    <div aria-hidden className="pointer-events-none flex h-16 items-end justify-center gap-[3px] overflow-hidden">
      {SPINES.map((s, i) => (
        <span
          key={i}
          className="shrink-0 rounded-t-[3px] shadow-[inset_-3px_0_0_rgba(0,0,0,0.12)]"
          style={{
            height: s.height,
            width: s.width,
            backgroundColor: s.color,
            // A pale title band near the top and a darker one near the foot.
            backgroundImage:
              "linear-gradient(to bottom, transparent 16%, rgba(255,255,255,0.42) 16%, rgba(255,255,255,0.42) 21%, transparent 21%, transparent 74%, rgba(0,0,0,0.14) 74%, rgba(0,0,0,0.14) 80%, transparent 80%)",
            ...(s.lean
              ? { transform: `rotate(${s.lean}deg)`, transformOrigin: "bottom left", marginRight: Math.round(s.height * 0.15) }
              : null),
          }}
        />
      ))}
    </div>
  );
}

/**
 * The library footer: a shelf of book spines on top, then deep green with
 * parchment type — the newsletter, the shop's contact details with icons, the
 * link columns (the last lists real categories), the name as a faint outlined
 * signature, and the fine print.
 */
export async function Footer() {
  const [settings, categories] = await Promise.all([
    getSettings(),
    api<{ data: Category[] }>("/categories", { revalidate: 300 })
      .then((r) => r.data)
      .catch(() => [] as Category[]),
  ]);
  const name = settings.site_name || "Lalwani Books International";
  const logo = String(settings.site_logo ?? "");
  const address = String(settings.contact_address ?? "").trim();
  const hours = String(settings.contact_hours ?? "").trim();
  const phone = String(settings.support_phone ?? "");
  const email = String(settings.support_email ?? "");
  // "Lalwani Books International" signs as "Lalwani Books".
  const signature = name.split(/\s+/).slice(0, 2).join(" ");

  const socials = [
    { network: "facebook" as const, href: settings.social_facebook },
    { network: "x" as const, href: settings.social_x },
    { network: "instagram" as const, href: settings.social_instagram },
    { network: "youtube" as const, href: settings.social_youtube },
    { network: "telegram" as const, href: settings.social_telegram },
  ].filter((s) => s.href);

  const columns: FooterColumn[] = [EXPLORE, SERVICE];
  if (categories.length > 0) {
    columns.push({
      title: "Categories",
      links: categories.slice(0, 6).map((c) => ({ label: c.name, href: `/collection?category=${c.slug}` })),
    });
  }

  const iconChip = "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-parchment/10 text-mustard";

  return (
    <footer className="mt-auto pt-6">
      <Bookshelf />

      {/* The shelf board, then the navy. */}
      <div className="relative overflow-hidden border-t-[6px] border-pine-700 bg-pine-900 bg-[radial-gradient(80%_60%_at_0%_0%,rgba(27,70,117,0.6),transparent_65%),radial-gradient(50%_60%_at_100%_100%,rgba(232,176,75,0.09),transparent_60%)] text-parchment">
        {/* Newsletter — admin → Home Page; subscribers appear in admin →
            Messages & Subscribers. */}
        {String(settings.newsletter_enabled ?? "1") !== "0" && (
          <div className="container-shop">
            <div className="flex flex-col gap-6 border-b border-parchment/10 py-11 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mustard/15 text-mustard">
                  <BookOpenIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mustard">Newsletter</p>
                  <h2 className="mt-1 text-[1.4rem] font-semibold leading-snug text-parchment">
                    {String(settings.newsletter_title ?? "").trim() || "Subscribe to our newsletter"}
                  </h2>
                  {String(settings.newsletter_text ?? "").trim() && (
                    <p className="mt-1 text-[13.5px] text-parchment/70">{String(settings.newsletter_text)}</p>
                  )}
                </div>
              </div>
              <NewsletterForm />
            </div>
          </div>
        )}

        <div className="container-shop grid gap-10 pt-12 pb-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2.3fr)] lg:gap-16">
          {/* Brand, contact and socials */}
          <div>
            <Link href="/" aria-label={name} className="inline-block">
              {isBuiltInLogo(logo) ? (
                // The built-in logo, turned white for the green footer. The
                // header has already loaded this file, so it costs nothing.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={BUILT_IN_LOGO}
                  alt={name}
                  loading="lazy"
                  className="h-[84px] w-auto brightness-0 invert"
                  style={{ aspectRatio: LOGO_RATIO }}
                />
              ) : (
                // An uploaded logo may have dark type, so it sits on a white tile.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={name} className="h-[60px] w-auto rounded-lg bg-white p-2" />
              )}
            </Link>
            {!address && settings.site_tagline && (
              <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-parchment/70">{settings.site_tagline}</p>
            )}

            {/* Each line only when it is filled in (admin → Contact). */}
            <ul className="mt-6 space-y-4 text-[13px] leading-relaxed text-parchment/75">
              {phone && (
                <li className="flex items-start gap-3">
                  <span className={iconChip}>
                    <PhoneIcon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-mustard">Need help?</span>
                    <a
                      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                      className="text-[1.25rem] font-semibold text-rose-400 transition-colors hover:text-rose-300"
                    >
                      {phone}
                    </a>
                  </span>
                </li>
              )}
              {hours && (
                <li className="flex items-start gap-3">
                  <span className={iconChip}>
                    <ClockIcon className="h-4 w-4" />
                  </span>
                  <span className="pt-1.5">{hours}</span>
                </li>
              )}
              {email && (
                <li className="flex items-start gap-3">
                  <span className={iconChip}>
                    <MailIcon className="h-4 w-4" />
                  </span>
                  <a href={`mailto:${email}`} className="pt-1.5 font-medium text-parchment transition-colors hover:text-rose-400">
                    {email}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-3">
                  <span className={iconChip}>
                    <MapPinIcon className="h-4 w-4" />
                  </span>
                  <span className="max-w-xs pt-1.5">{address}</span>
                </li>
              )}
            </ul>

            {socials.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-3">
                {socials.map((s) => (
                  <SocialIcon3D key={s.network} network={s.network} href={String(s.href)} />
                ))}
              </div>
            )}
          </div>

          <FooterColumns columns={columns} />
        </div>

        {/* The name as a faint outlined signature, rising from the fine print. */}
        <div aria-hidden className="pointer-events-none relative h-[clamp(1.9rem,7.4vw,6.1rem)] select-none overflow-hidden">
          <p className="absolute inset-x-0 top-0 whitespace-nowrap text-center text-[clamp(2.6rem,10.5vw,8.75rem)] font-semibold leading-[0.8] tracking-[-0.04em] text-transparent [-webkit-text-stroke:1.5px_rgba(232,238,246,0.13)]">
            {signature}
          </p>
        </div>

        <div className="bg-pine-950/70">
          <div className="container-shop flex flex-col items-center justify-between gap-3 py-5 text-center text-[12.5px] text-parchment/60 md:flex-row md:text-left">
            <p>
              © {new Date().getFullYear()} <span className="font-medium text-rose-400">{name}</span>. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-5">
              <Link href="/pages/privacy" className="transition-colors hover:text-rose-400">
                Privacy Policy
              </Link>
              <Link href="/pages/terms" className="transition-colors hover:text-rose-400">
                Terms &amp; Conditions
              </Link>
            </div>
            <p>
              Developed by{" "}
              <a
                href={DEVELOPER.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-parchment transition-colors hover:text-rose-400"
              >
                {DEVELOPER.name}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
