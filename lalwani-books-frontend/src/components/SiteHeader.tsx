import { api } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import type { Category } from "@/lib/types";
import { Header } from "./Header";

/**
 * Server half of the header: settings and categories are fetched here (cached)
 * so the client header renders its Categories menu without a request of its own.
 */
export async function SiteHeader() {
  const [settings, categories] = await Promise.all([
    getSettings(),
    api<{ data: Category[] }>("/categories", { revalidate: 300 })
      .then((r) => r.data)
      .catch(() => [] as Category[]),
  ]);

  return (
    <Header logo={settings.site_logo} siteName={settings.site_name} categories={categories} />
  );
}
