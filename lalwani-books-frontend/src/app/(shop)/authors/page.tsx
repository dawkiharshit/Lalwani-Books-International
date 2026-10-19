import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import Link from "next/link";
import Image from "@/components/Image";
import { PageBanner } from "@/components/PageBanner";
import { ChevronIcon } from "@/components/icons";
import { GENRE_TINTS } from "@/components/home/bookory";
import { Doodle, DottedPaper, FoldedPage, OpenBook, Ring, Sparkle } from "@/components/home/doodles";
import { api } from "@/lib/api";
import { initialsOf } from "@/lib/format";
import type { Author } from "@/lib/types";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: "Authors",
    description: "Every author on our shelves at Lalwani Books International, each with all of their books we stock.",
    path: "/authors",
  });
}

export const revalidate = 300;

/**
 * /authors — every author from admin → Categories & Authors, in the order set
 * there, each card leading to that author's shelf in the shop. An author with
 * no live book still appears (the bio is worth reading). Cards show no book
 * count — the owner asked for counts to be hidden.
 */
export default async function AuthorsPage() {
  const authors = await api<{ data: Author[] }>("/authors", { revalidate: 300 })
    .then((r) => r.data)
    .catch(() => [] as Author[]);
  const books = authors.reduce((n, a) => n + a.products_count, 0);

  return (
    <div className="flex flex-col gap-8">
      <PageBanner title="Authors" crumbs={[{ label: "Authors" }]} />

      <AuthorsHero authors={authors} books={books} />

      {authors.length === 0 ? (
        <div className="card px-8 py-16 text-center">
          <p className="font-serif text-[1.4rem] text-ink">No authors yet</p>
          <p className="mt-2 text-[13px] text-cocoa">Authors appear here as books are added to the shop.</p>
        </div>
      ) : (
        <ul data-reveal-stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {authors.map((a, i) => (
            <AuthorCard key={a.id} author={a} index={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The page's opening band: the copy and two figures on the left, a loose,
 * gently floating cluster of author portraits on the right (a tight row of
 * them on phones), over the same warm, doodled backdrop as the home page.
 */
function AuthorsHero({ authors, books }: { authors: Author[]; books: number }) {
  // Portraits first, then monograms, keeping the admin order within each.
  const faces = [...authors].sort((a, b) => Number(Boolean(b.photo)) - Number(Boolean(a.photo))).slice(0, 5);
  const more = authors.length - faces.length;
  // A spot in the cluster for each of the five faces, largest first.
  const spots = [
    { className: "left-[6%] top-[14%] h-28 w-28 lg:h-32 lg:w-32", delay: "-1s", sizes: "128px" },
    { className: "left-[44%] top-0 h-20 w-20 lg:h-24 lg:w-24", delay: "-3s", sizes: "96px" },
    { className: "right-[4%] top-[18%] h-24 w-24 lg:h-28 lg:w-28", delay: "-5s", sizes: "112px" },
    { className: "left-[30%] bottom-[2%] h-16 w-16 lg:h-20 lg:w-20", delay: "-2s", sizes: "80px" },
    { className: "right-[22%] bottom-0 h-14 w-14 lg:h-16 lg:w-16", delay: "-4s", sizes: "64px" },
  ];

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-blush-100">
      <AuthorsBackdrop />
      <div className="relative grid items-center gap-8 px-6 py-9 sm:px-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:py-12">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-rose-600">Our Authors</p>
          <h2 className="mt-2 text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.6rem]">
            The <span className="text-rose-600">writers</span> on our shelves
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-cocoa">
            From the classics to today&rsquo;s bestsellers &mdash; pick an author to see every title of theirs we stock.
          </p>
          {authors.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Figure value={authors.length} label={authors.length === 1 ? "author" : "authors"} />
              <Figure value={books} label={books === 1 ? "book" : "books"} />
            </div>
          )}
          {/* Phones: the faces in a tight row instead of the cluster. */}
          {faces.length > 0 && (
            <div className="mt-6 flex items-center md:hidden">
              <div className="flex -space-x-3">
                {faces.map((a, i) => (
                  <Face key={a.id} author={a} index={i} sizes="44px" className="relative h-11 w-11 ring-2 ring-white" />
                ))}
              </div>
              {more > 0 && <span className="ml-3 text-[12.5px] text-fog">+{more} more</span>}
            </div>
          )}
        </div>

        {faces.length > 0 && (
          <div aria-hidden className="relative hidden h-[280px] md:block">
            <span className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60 blur-2xl" />
            {faces.map((a, i) => (
              <span key={a.id} className={"float-y absolute " + spots[i].className} style={{ animationDelay: spots[i].delay }}>
                <Face author={a} index={i} sizes={spots[i].sizes} className="relative h-full w-full ring-4 ring-white shadow-soft" />
              </span>
            ))}
            {more > 0 && (
              <span className="absolute bottom-[2%] left-[6%] rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink shadow-soft">
                +{more} more
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** One figure in a white pill: the number, then what it counts. */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-white px-4 py-2 shadow-soft">
      <span className="text-[1.15rem] font-semibold text-ink">{value}</span>
      <span className="text-[12.5px] text-fog">{label}</span>
    </span>
  );
}

/** A round portrait, or a tinted monogram when the author has no photo yet. */
function Face({ author: a, index, sizes, className }: { author: Author; index: number; sizes: string; className: string }) {
  const [from, to] = GENRE_TINTS[index % GENRE_TINTS.length];
  const tint = { background: `linear-gradient(135deg, ${from}, ${to})` };
  return (
    <span
      className={"flex items-center justify-center overflow-hidden rounded-full text-[0.9em] font-semibold text-white " + className}
      style={a.photo ? undefined : tint}
    >
      {a.photo ? (
        <Image
          src={a.photo}
          alt=""
          fill
          fixed
          sizes={sizes}
          className="object-cover"
          fallback={<span className="absolute inset-0 flex items-center justify-center" style={tint}>{initialsOf(a.name)}</span>}
        />
      ) : (
        initialsOf(a.name)
      )}
    </span>
  );
}

/** The band's background: warm wash, dotted paper, and a few of the home page's drawings. Decorative only. */
function AuthorsBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* The translucent glow is listed first so it paints on top of the opaque wash. */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(255,255,255,0.7),transparent_70%),radial-gradient(120%_100%_at_0%_100%,#dbe6f3_0%,#eaf0f7_55%,#f6f8fb_100%)]" />
      <DottedPaper dot="rgba(4,43,82,0.12)" />
      <span className="blob-drift absolute -left-20 -top-24 h-64 w-64 rounded-full bg-rose-300/30 blur-3xl" />
      <span className="blob-drift absolute -bottom-24 right-[30%] h-56 w-56 rounded-full bg-[#e8b04b]/20 blur-3xl [animation-delay:-6s]" />
      <Doodle className="left-[46%] top-[8%] w-20 max-md:hidden lg:w-24" delay="-1.5s" viewBox="0 0 160 100">
        <OpenBook stroke="#2b5d92" opacity={0.3} />
      </Doodle>
      <Doodle className="bottom-[10%] left-[38%] w-10 max-lg:hidden" delay="-4s" viewBox="0 0 80 100">
        <g className="origin-center rotate-12">
          <FoldedPage stroke="#0d4377" opacity={0.28} />
        </g>
      </Doodle>
      <Ring className="-bottom-20 -right-16 h-56 w-56" stroke="#042b52" opacity={0.2} />
      <Sparkle className="right-[8%] top-[10%] w-4" delay="-2.5s" fill="#042b52" opacity={0.5} />
      <Sparkle className="left-[2%] bottom-[12%] w-3" delay="-5s" fill="#e8b04b" opacity={0.65} />
      <Sparkle className="right-[36%] bottom-[8%] w-3 max-md:hidden" delay="-3.5s" fill="#2b5d92" opacity={0.45} />
    </div>
  );
}

/** Portrait (or a tinted monogram, as the home page draws it), name and a line of bio. */
/** The little shelf in each card's cover band: heights and colours of its spines. */
const COVER_SPINES = [
  { h: "h-5", tone: "bg-mustard" },
  { h: "h-7", tone: "bg-rose-300" },
  { h: "h-4", tone: "bg-white/80" },
  { h: "h-6", tone: "bg-mustard/70" },
];

/**
 * A profile card: a cover band with the portrait set half over it, the
 * author's name, a line of bio, how many books the shop has by them, and a
 * button to see them.
 *
 * On hover (or keyboard focus) the card lifts, the band turns the logo's navy,
 * a gold-and-blue ring turns around the portrait, a few book spines rise on the
 * band and the button fills in. Transitions only, so it costs nothing to load,
 * and the ring stands still for anyone who has asked for less motion. On touch
 * screens the resting card is complete on its own.
 */
function AuthorCard({ author: a, index }: { author: Author; index: number }) {
  const [from, to] = GENRE_TINTS[index % GENRE_TINTS.length];
  const books = a.products_count;
  const lit = "group-hover:opacity-100 group-focus-visible:opacity-100";

  return (
    <li>
      <Link
        href={`/collection?author=${a.slug}`}
        className="group relative flex h-full flex-col items-center overflow-hidden rounded-[var(--radius-card)] border border-blush-200 bg-white px-6 pb-6 text-center transition-[translate,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1.5 hover:border-rose-200 hover:shadow-lift focus-visible:-translate-y-1.5 focus-visible:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
      >
        {/* Cover band: pale blue at rest, navy when the card is picked out. */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[4.75rem] overflow-hidden">
          <span className="absolute inset-0 bg-[linear-gradient(135deg,#eaf0f7_0%,#d9e4f2_100%)]" />
          <span className={`absolute inset-0 bg-[linear-gradient(135deg,#0d4377_0%,#042b52_100%)] opacity-0 transition-opacity duration-500 ${lit}`} />
          <span className="absolute inset-0 bg-[radial-gradient(rgba(4,43,82,0.14)_1px,transparent_1.3px)] [background-size:11px_11px]" />
          <span className="absolute bottom-0 right-4 flex items-end gap-[3px]">
            {COVER_SPINES.map((s, i) => (
              <span
                key={i}
                className={`w-[7px] rounded-t-[2px] ${s.h} ${s.tone} translate-y-full transition-transform duration-500 ease-out group-hover:translate-y-0 group-focus-visible:translate-y-0`}
                style={{ transitionDelay: `${i * 60}ms` }}
              />
            ))}
          </span>
        </span>

        {/* Portrait in a white frame, with the turning ring behind it. */}
        <span className="relative mt-5 grid h-28 w-28 shrink-0 place-items-center rounded-full bg-white">
          <span
            aria-hidden
            className={`absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#042b52,#8db1dc,#e8b04b,#042b52)] opacity-0 transition-opacity duration-500 group-hover:animate-[spin_6s_linear_infinite] motion-reduce:group-hover:animate-none ${lit}`}
          />
          <span
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-[1.5rem] font-semibold text-white ring-4 ring-white"
            style={a.photo ? undefined : { background: `linear-gradient(135deg, ${from}, ${to})` }}
          >
            {a.photo ? (
              <Image
                src={a.photo}
                alt=""
                fill
                fixed
                sizes="96px"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-110 group-focus-visible:scale-110"
                fallback={
                  <span className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                    {initialsOf(a.name)}
                  </span>
                }
              />
            ) : (
              initialsOf(a.name)
            )}
          </span>
          {books > 0 && (
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-mustard px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-rose-800 shadow-soft ring-2 ring-white">
              {books} {books === 1 ? "book" : "books"}
            </span>
          )}
        </span>

        <span className="mt-5 text-[16px] font-semibold leading-snug text-ink transition-colors group-hover:text-rose-600 group-focus-visible:text-rose-600">
          {a.name}
        </span>
        {a.bio && <span className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-cocoa">{a.bio}</span>}

        <span className="mt-auto pt-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-4 py-2 text-[12.5px] font-semibold text-rose-600 transition-colors duration-300 group-hover:border-rose-600 group-hover:bg-rose-600 group-hover:text-white group-focus-visible:border-rose-600 group-focus-visible:bg-rose-600 group-focus-visible:text-white">
            View books
            <ChevronIcon className="h-3 w-3 -rotate-90 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2.4} />
          </span>
        </span>
      </Link>
    </li>
  );
}
