import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

/** The title, description and share preview for a page that is itself a client component. */
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Track Your Order",
    description: "Check where your Lalwani Books International order is with your order number and email.",
    path: "/track-order",
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
