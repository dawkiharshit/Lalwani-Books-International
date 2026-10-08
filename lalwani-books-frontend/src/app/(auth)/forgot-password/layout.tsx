import type { Metadata } from "next";

/** The browser-tab title for a page that is itself a client component. */
export const metadata: Metadata = {
  title: "Forgot Password",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
