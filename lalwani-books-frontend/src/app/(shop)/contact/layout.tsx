import type { Metadata } from "next";

/** The browser-tab title for a page that is itself a client component. */
export const metadata: Metadata = {
  title: "Contact Us",
  description: "Call, email or write to Lalwani Books International — orders, finding a book, bulk and institutional orders.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
