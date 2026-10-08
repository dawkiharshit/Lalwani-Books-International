import type { Metadata } from "next";

/** The browser-tab title for a page that is itself a client component. */
export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Check where your Lalwani Books International order is with your order number and email.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
