import Link from "next/link";
import Image from "@/components/Image";
import { ChevronIcon, PencilIcon, QuillIcon, ShelfIcon, UsersIcon } from "@/components/icons";
import { DottedPaper } from "@/components/home/doodles";

/**
 * Who the institutional service is for — shared by the home band, /institutions
 * and the shop. Each tile opens /collection?for=<slug>: the books of its
 * categories (by slug, as set in admin → Categories), or every book when the
 * list is empty. A slug that no longer exists is simply skipped.
 */
export const INSTITUTION_AUDIENCES = [
  {
    slug: "schools",
    label: "Schools",
    note: "Textbooks, reading lists, class sets",
    Icon: PencilIcon,
    categories: ["children", "academic", "science"],
    // Photos from Unsplash (free to use under the Unsplash License), served
    // resized by Unsplash's image service — see components/Image.
    image: "https://images.unsplash.com/photo-1692269725827-699e04a11cdf?auto=format&fit=crop&w=800&q=70",
  },
  {
    slug: "universities",
    label: "Universities",
    note: "Course books and reference titles",
    Icon: QuillIcon,
    categories: ["academic", "science", "competitive-exams", "business"],
    image: "https://images.unsplash.com/photo-1758270704763-22072a90d3b6?auto=format&fit=crop&w=800&q=70",
  },
  {
    slug: "libraries",
    label: "Libraries",
    note: "New collections and restocking",
    Icon: ShelfIcon,
    categories: [] as string[],
    image: "https://images.unsplash.com/photo-1709924168698-620ea32c3488?auto=format&fit=crop&w=800&q=70",
  },
  {
    slug: "corporates",
    label: "Corporates",
    note: "Training, gifting and office libraries",
    Icon: UsersIcon,
    categories: ["business", "self-help"],
    image: "https://images.unsplash.com/photo-1573164574572-cb89e39749b4?auto=format&fit=crop&w=800&q=70",
  },
];

export type InstitutionAudience = (typeof INSTITUTION_AUDIENCES)[number];

export function audienceBySlug(slug: string | undefined): InstitutionAudience | undefined {
  return slug ? INSTITUTION_AUDIENCES.find((a) => a.slug === slug) : undefined;
}

export const INSTITUTIONS_LINE = "From a single reading list to an entire library, we source, supply and manage books at scale.";

/** One audience tile, linking to its books in the shop. Used on the home band and /institutions. */
export function AudienceTile({ audience: { slug, label, note, Icon }, compact = false }: { audience: InstitutionAudience; compact?: boolean }) {
  return (
    <li>
      <Link
        href={`/collection?for=${slug}`}
        className={`group flex h-full flex-col rounded-2xl bg-white/[0.07] ring-1 ring-white/12 transition-[background-color,box-shadow,translate] duration-300 hover:-translate-y-1 hover:bg-white/[0.12] hover:ring-mustard/60 focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mustard ${
          compact ? "p-4" : "p-4 sm:p-5"
        }`}
      >
        <span className={`flex items-center justify-center rounded-full bg-mustard/15 text-mustard transition-colors group-hover:bg-mustard group-hover:text-rose-800 ${compact ? "h-9 w-9" : "h-10 w-10"}`}>
          <Icon className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} />
        </span>
        <span className={`font-semibold ${compact ? "mt-2.5 text-[14.5px]" : "mt-3 text-[15px]"}`}>{label}</span>
        <span className="mt-1 text-[12px] leading-snug text-parchment/70">{note}</span>
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[12px] font-semibold text-mustard">
          View books
          <ChevronIcon className="h-3 w-3 -rotate-90 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
        </span>
      </Link>
    </li>
  );
}

/**
 * One audience on the home band: its photo under a navy wash (deep where the
 * words sit), icon, name, what they buy and how many books. On hover the
 * photo zooms in, the card lifts and the icon and arrow light up.
 */
function AudienceCard({ audience: { slug, label, note, Icon, image }, books }: { audience: InstitutionAudience; books?: number }) {
  return (
    <li>
      <Link
        href={`/collection?for=${slug}`}
        className="group relative flex h-full min-h-[14rem] flex-col overflow-hidden rounded-2xl bg-rose-700 p-4 text-white shadow-[0_14px_30px_-18px_rgba(4,43,82,0.6)] ring-1 ring-black/5 transition-[translate,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_26px_46px_-18px_rgba(4,43,82,0.65)] focus-visible:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mustard sm:p-5"
      >
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,43,82,0.96)_0%,rgba(4,43,82,0.82)_42%,rgba(4,43,82,0.35)_75%,rgba(4,43,82,0.15)_100%)] transition-opacity duration-500 group-hover:opacity-90"
        />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/35 backdrop-blur-sm transition-colors duration-300 group-hover:bg-mustard group-hover:text-rose-800 group-hover:ring-mustard sm:h-12 sm:w-12">
          <Icon className="h-6 w-6" />
        </span>
        <span className="relative mt-auto pt-8 text-[16px] font-semibold leading-tight [text-shadow:0_2px_10px_rgba(0,0,0,0.35)] sm:text-[17px]">
          {label}
        </span>
        <span className="relative mt-1 text-[12px] leading-snug text-white/90 sm:text-[12.5px]">{note}</span>
        <span className="relative mt-4 flex items-center justify-between gap-2">
          <span className="whitespace-nowrap rounded-full bg-mustard px-2.5 py-1 text-[11.5px] font-bold text-rose-800 sm:px-3 sm:text-[12px]">
            {books ? `${books} ${books === 1 ? "book" : "books"}` : "View books"}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/35 transition-colors duration-300 group-hover:bg-white group-hover:text-rose-700">
            <ChevronIcon className="h-3.5 w-3.5 -rotate-90 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2.4} />
          </span>
        </span>
      </Link>
    </li>
  );
}

type Cover = { image: string | null; name: string };

/**
 * Home page band for bulk buyers, on a light ground so it does not stack a
 * second dark block under the About band: the promise, a quote button (and
 * the shop's phone number for those who would rather call), a fan of real
 * covers that opens out on hover, and a card per audience leading to its books.
 */
export function InstitutionsBand({
  covers = [],
  counts = {},
  phone = "",
}: {
  /** Up to three covers for the fan; ones without a picture are skipped. */
  covers?: Cover[];
  /** Books per audience slug, shown on the cards. */
  counts?: Record<string, number>;
  phone?: string;
}) {
  const fan = covers.filter((c): c is { image: string; name: string } => Boolean(c.image)).slice(0, 3);
  const slots = [
    "left-[4%] top-[12%] -rotate-[9deg] group-hover/fan:-translate-x-5 group-hover/fan:-rotate-[14deg]",
    "left-[30%] top-0 z-10 rotate-[1deg] group-hover/fan:-translate-y-3",
    "left-[56%] top-[14%] rotate-[10deg] group-hover/fan:translate-x-5 group-hover/fan:rotate-[15deg]",
  ];
  const tel = phone.replace(/[^\d+]/g, "");

  return (
    <section className="container-shop pt-16 lg:pt-20" aria-labelledby="institutions-band">
      <div
        data-reveal
        className="relative overflow-hidden rounded-[var(--radius-hero)] bg-[linear-gradient(135deg,#eef3f9_0%,#e3ebf5_100%)] px-6 py-10 sm:px-10 lg:px-14 lg:py-14"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(45%_70%_at_88%_10%,rgba(232,176,75,0.22),transparent_70%),radial-gradient(40%_60%_at_0%_100%,rgba(255,255,255,0.8),transparent_70%)]" />
          <DottedPaper dot="rgba(4,43,82,0.1)" />
        </div>

        <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div>
            <p className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-rose-500">
              <span aria-hidden className="h-[2px] w-8 rounded-full bg-mustard" />
              Books for Institutions
            </p>
            <h2
              id="institutions-band"
              className="mt-4 max-w-xl text-[clamp(1.8rem,3.8vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.02em] text-ink"
            >
              From a single reading list to an{" "}
              <span className="relative inline-block whitespace-nowrap">
                entire library
                <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-1.5 left-0 h-3 w-full text-mustard">
                  <path d="M3 8c40-6 110-8 194-3" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            </h2>
            <p className="mt-5 max-w-lg text-[14.5px] leading-relaxed text-cocoa">
              We source, supply and manage books at scale for schools, universities, libraries and corporates.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/institutions#quote"
                className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-7 py-3.5 text-[12.5px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_12px_24px_-12px_rgba(4,43,82,0.6)] transition-colors hover:bg-rose-700"
              >
                Request a quote
                <ChevronIcon className="h-3.5 w-3.5 -rotate-90" strokeWidth={2.4} />
              </Link>
              {tel && (
                <a href={`tel:${tel}`} className="text-[13px] text-cocoa">
                  or call <span className="font-semibold text-ink underline decoration-mustard decoration-2 underline-offset-4">{phone}</span>
                </a>
              )}
            </div>
          </div>

          {fan.length > 0 && (
            <div aria-hidden className="group/fan relative mx-auto hidden aspect-[5/4] w-full max-w-[22rem] sm:block lg:max-w-none">
              {fan.map((c, i) => (
                <span
                  key={c.image}
                  className={`absolute aspect-[2/3] w-[42%] overflow-hidden rounded-xl bg-white shadow-[0_24px_40px_-18px_rgba(4,43,82,0.55)] ring-4 ring-white transition-transform duration-500 ease-out ${slots[i]}`}
                >
                  <Image src={c.image} alt="" fill sizes="(min-width: 1024px) 180px, 140px" className="object-cover" />
                </span>
              ))}
              <span className="absolute -bottom-1 right-[4%] z-20 flex h-[5.5rem] w-[5.5rem] rotate-[-8deg] flex-col items-center justify-center rounded-full bg-mustard text-center text-rose-800 shadow-[0_14px_28px_-14px_rgba(4,43,82,0.6)] ring-4 ring-white">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em]">Bulk</span>
                <span className="text-[15px] font-bold leading-none">orders</span>
                <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em]">any size</span>
              </span>
            </div>
          )}
        </div>

        <ul className="relative mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-12 lg:grid-cols-4">
          {INSTITUTION_AUDIENCES.map((a) => (
            <AudienceCard key={a.slug} audience={a} books={counts[a.slug]} />
          ))}
        </ul>
      </div>
    </section>
  );
}
