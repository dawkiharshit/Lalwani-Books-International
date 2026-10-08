import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { API_TAG } from "@/lib/api";

/**
 * Clears the storefront's cache on demand.
 *
 * Laravel calls this the moment an admin saves, so the change shows on the very
 * next page load.
 *
 * Both calls are needed. revalidatePath on its own only marks pages *stale*:
 * the next visit is still served the old copy while a new one renders in the
 * background, so the shop owner refreshed after saving and saw nothing change.
 * Expiring the API_TAG with `{ expire: 0 }` (Next docs: "stale content is never
 * served, so the next request is a blocking revalidate") makes the next visit
 * fetch fresh data before it renders.
 *
 * Deliberately not under /api. On the live host the API's folder sits inside
 * this site's public_html as `api/`, so every lalwanibooks.com/api/... request
 * is answered by Laravel and never reaches Next.js — at /api/revalidate this
 * endpoint was unreachable. Keep storefront routes out of /api.
 */
export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;

  // With no secret configured the endpoint stays shut rather than letting
  // anyone on the internet flush the cache in a loop.
  if (!expected) {
    return Response.json({ message: "Revalidation is not configured." }, { status: 503 });
  }

  // Compared in constant time, so a wrong guess takes as long as a near miss.
  const given = Buffer.from(request.headers.get("x-revalidate-secret") ?? "");
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return Response.json({ message: "Not allowed." }, { status: 401 });
  }

  revalidateTag(API_TAG, { expire: 0 });
  // "layout" from the root covers every page beneath it — an admin edit can
  // touch the header, the footer or any section, so nothing narrower is safe.
  revalidatePath("/", "layout");

  return Response.json({ revalidated: true });
}
