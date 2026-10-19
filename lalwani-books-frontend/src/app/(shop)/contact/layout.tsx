import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";

/** The contact page's title, description, one address for search engines and its share preview. */
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Contact Us",
    description: "Call, email or write to Lalwani Books International — orders, finding a book, bulk and institutional orders.",
    path: "/contact",
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
