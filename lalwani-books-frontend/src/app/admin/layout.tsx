import type { Metadata } from "next";
import { AuthProvider } from "@/admin/context/AuthContext";
import { getSettings } from "@/lib/settings";

/**
 * The admin panel lives inside the storefront app at /admin. It keeps its own
 * sign-in (AuthProvider from src/admin, with its own session keys), so an
 * admin session and a customer session never overwrite each other.
 * Nothing here is for search engines.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = settings.site_name || "Lalwani Books International";
  return {
    // absolute: the storefront root layout would otherwise append "| <name>".
    title: { absolute: `${name} Admin`, template: `%s | ${name} Admin` },
    robots: { index: false, follow: false },
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
