import { getSettings } from "@/lib/settings";

/** Optional storefront banner — text comes from admin Store Settings. */
export async function AnnouncementBar() {
  const settings = await getSettings();
  if (!settings.announcement) return null;

  return (
    <div className="bg-rose-600 px-4 py-2 text-center text-[12.5px] font-medium text-white">
      {settings.announcement}
    </div>
  );
}
