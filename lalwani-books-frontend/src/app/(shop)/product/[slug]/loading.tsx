import { BookLoader } from "@/components/loading/BookLoader";

/**
 * A book page on its way — one not yet pre-rendered, such as a book added
 * since the last build. Shaped like the page itself (cover on the left, the
 * details card on the right) so nothing jumps when it arrives, with the
 * shop's book-spine loader sitting on the cover.
 */
export default function ProductLoading() {
  return (
    <div role="status" aria-live="polite" className="grid items-start gap-8 lg:grid-cols-2">
      <section className="card relative p-6 sm:p-10">
        <div className="skeleton relative mx-auto w-full max-w-[380px] overflow-hidden rounded-xl pb-[140%]">
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-fog">
            <BookLoader size="md" />
            <p className="text-[13px] font-medium">Opening the book…</p>
          </div>
        </div>
      </section>

      <section aria-hidden className="card flex flex-col p-6 sm:p-9">
        <div className="skeleton h-6 w-20 rounded" />
        <div className="skeleton mt-5 h-9 w-4/5 rounded-full" />
        <div className="skeleton mt-4 h-3.5 w-1/2 rounded-full" />
        <hr className="my-6 border-blush-200" />
        <div className="skeleton h-8 w-40 rounded-full" />
        <div className="skeleton mt-4 h-3.5 w-3/5 rounded-full" />
        <hr className="my-6 border-blush-200" />
        <div className="skeleton h-11 w-40 rounded-full" />
        <div className="skeleton mt-4 h-14 w-full rounded-full" />
        <div className="skeleton mt-3 h-14 w-full rounded-full" />
        <div className="skeleton mt-6 h-24 w-full rounded-2xl" />
      </section>
    </div>
  );
}
