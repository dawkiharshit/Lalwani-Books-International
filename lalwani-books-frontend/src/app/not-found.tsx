import { GoHome } from "@/components/GoHome";

/**
 * Any unmatched URL — or a page that calls notFound() (a missing product, blog
 * post or page) — sends the visitor on to the home page instead of showing a
 * 404 screen.
 *
 * The move happens in the browser. A server redirect() here threw while
 * rendering, and Next renders this boundary alongside every page, so each page
 * carried a thrown component that the dev overlay reported as "1 Issue" (a
 * negative timestamp in React's timing tracks). Answering 404 before moving on
 * also tells search engines the address is gone, where the redirect claimed it
 * was the home page.
 */
export default function NotFound() {
  return <GoHome />;
}
