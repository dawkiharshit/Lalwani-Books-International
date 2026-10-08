import Link from "next/link";
import { Brand } from "@/components/Brand";
import { getSettings } from "@/lib/settings";

export const revalidate = 30;

export const metadata = {
  title: "Under Maintenance",
};

/** Shown across the storefront while the admin has maintenance mode switched on. */
export default async function MaintenancePage() {
  const settings = await getSettings();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-blush-50 px-6 py-16 text-center">
      <Link href="/" aria-label={settings.site_name}>
        <Brand logo={settings.site_logo} name={settings.site_name} height={120} heightClass="h-[120px]" />
      </Link>

      <div className="max-w-md">
        <p className="text-[11px] font-accent uppercase tracking-[0.3em] text-rose-500">Under maintenance</p>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight text-ink sm:text-[2.6rem]">
          We&apos;ll be right back
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-cocoa">
          {settings.site_name} is getting a little polish right now. We&apos;re making things
          better and will be back very soon — thank you for your patience.
        </p>
      </div>

      {settings.support_email && (
        <p className="text-[12.5px] text-fog">
          Need help?{" "}
          <a href={`mailto:${settings.support_email}`} className="text-rose-600 hover:underline">
            {settings.support_email}
          </a>
        </p>
      )}
    </main>
  );
}
