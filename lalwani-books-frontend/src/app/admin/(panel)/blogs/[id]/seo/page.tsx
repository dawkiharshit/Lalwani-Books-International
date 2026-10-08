"use client";

import { BackLink } from "@/admin/components/BackLink";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { clientApi, ApiError } from "@/admin/lib/api";
import { STOREFRONT_URL } from "@/admin/lib/storefront";
import { Spinner } from "@/admin/components/ui";
import { Select } from "@/admin/components/Select";

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  thumbnail: string | null;
  meta_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  meta_keywords: string | null;
  canonical_url: string | null;
  noindex: boolean;
  nofollow: boolean;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  twitter_card: string | null;
}

interface Seo {
  meta_title: string;
  meta_description: string;
  focus_keyword: string;
  meta_keywords: string;
  canonical_url: string;
  noindex: boolean;
  nofollow: boolean;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_card: string;
}

const s = (v: string | null | undefined) => v ?? "";

/** Green when the count sits in the sweet spot, amber otherwise. */
function Counter({ n, min, max }: { n: number; min: number; max: number }) {
  const ok = n >= min && n <= max;
  return (
    <span className={`text-[10.5px] tabular-nums ${ok ? "text-emerald-600" : "text-amber-600"}`}>
      {n} / {max}
    </span>
  );
}

export default function BlogSeoPage() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [seo, setSeo] = useState<Seo | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  /*
   * The site's own origin, for the Google/social previews. Read through
   * useSyncExternalStore because window does not exist during SSR: the server
   * snapshot is an empty string and the client fills it in on hydration,
   * without the effect-then-setState round trip. It never changes, so the
   * subscribe callback has nothing to listen to.
   */
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );

  const load = useCallback(() => {
    clientApi<{ data: Post }>(`/admin/blogs/${id}`)
      .then((res) => {
        const p = res.data;
        setPost(p);
        setSeo({
          meta_title: s(p.meta_title),
          meta_description: s(p.meta_description),
          focus_keyword: s(p.focus_keyword),
          meta_keywords: s(p.meta_keywords),
          canonical_url: s(p.canonical_url),
          noindex: !!p.noindex,
          nofollow: !!p.nofollow,
          og_title: s(p.og_title),
          og_description: s(p.og_description),
          og_image: s(p.og_image),
          twitter_card: p.twitter_card || "summary_large_image",
        });
      })
      .catch(() => setError("Could not load this post."));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof Seo>(k: K, v: Seo[K]) => {
    setSeo((prev) => (prev ? { ...prev, [k]: v } : prev));
    setSaved(false);
  };

  async function save() {
    if (!seo) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await clientApi(`/admin/blogs/${id}/seo`, { method: "PUT", body: seo });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  // Effective values that actually ship — the field, or its fallback.
  const effTitle = seo ? seo.meta_title || post?.title || "" : "";
  const effDesc = seo ? seo.meta_description || post?.excerpt || "" : "";
  const effOgTitle = seo?.og_title || effTitle;
  const effOgDesc = seo?.og_description || effDesc;
  const effOgImage = seo?.og_image || post?.thumbnail || "";
  const url = post ? `${origin}/blog/${post.slug}` : "";

  // On-page analysis against the focus keyword — the real "on-page SEO logic".
  const checks = useMemo(() => {
    if (!seo || !post) return [];
    const kw = seo.focus_keyword.trim().toLowerCase();
    const content = post.content.replace(/<[^>]+>/g, " ").toLowerCase();
    const out: { ok: boolean; label: string }[] = [];
    if (kw) {
      out.push({ ok: effTitle.toLowerCase().includes(kw), label: "Focus keyword in the SEO title" });
      out.push({ ok: effDesc.toLowerCase().includes(kw), label: "Focus keyword in the meta description" });
      out.push({ ok: content.includes(kw), label: "Focus keyword appears in the content" });
      out.push({
        ok: post.slug.toLowerCase().includes(kw.replace(/\s+/g, "-")),
        label: "Focus keyword in the URL slug",
      });
    }
    out.push({ ok: effTitle.length >= 30 && effTitle.length <= 60, label: "SEO title is 30–60 characters" });
    out.push({ ok: effDesc.length >= 70 && effDesc.length <= 160, label: "Meta description is 70–160 characters" });
    return out;
  }, [seo, post, effTitle, effDesc]);

  const passed = checks.filter((c) => c.ok).length;

  if (!seo || !post) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-fog">
        {error ? <span className="text-red-500">{error}</span> : <><Spinner className="h-5 w-5" /> Loading…</>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/admin/blogs" label="Back to blog posts" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="font-serif text-[1.6rem] text-ink">SEO Settings</h1>
          <p className="mt-0.5 text-[12px] text-fog">
            How &ldquo;{post.title}&rdquo; appears in Google and on social media.
          </p>
        </div>
        {saved && <span className="text-[12px] font-medium text-emerald-600">Saved ✓</span>}
        {error && <span className="text-[12px] text-red-500">{error}</span>}
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-2 rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />} Save SEO
        </button>
      </div>

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* ---------- ON-PAGE ---------- */}
          <section className="card p-6">
            <h2 className="font-serif text-[1.2rem] text-ink">On-Page SEO</h2>
            <p className="mt-0.5 text-[11.5px] text-fog">
              What search engines read on this page — the title, description and keywords.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-cocoa">SEO Title</span>
                  <Counter n={(seo.meta_title || post.title).length} min={30} max={60} />
                </span>
                <input
                  value={seo.meta_title}
                  onChange={(e) => set("meta_title", e.target.value)}
                  placeholder={post.title}
                  className="input-base"
                />
                <span className="text-[10.5px] text-fog">Blank = the post title is used.</span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-cocoa">Meta Description</span>
                  <Counter n={(seo.meta_description || post.excerpt || "").length} min={70} max={160} />
                </span>
                <textarea
                  rows={3}
                  value={seo.meta_description}
                  onChange={(e) => set("meta_description", e.target.value)}
                  placeholder={post.excerpt ?? "A short, tempting summary for search results…"}
                  className="input-base resize-none"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-cocoa">Focus Keyword</span>
                  <input
                    value={seo.focus_keyword}
                    onChange={(e) => set("focus_keyword", e.target.value)}
                    placeholder="best books 2026"
                    className="input-base"
                  />
                  <span className="text-[10.5px] text-fog">The one phrase this post should rank for.</span>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-cocoa">Meta Keywords</span>
                  <input
                    value={seo.meta_keywords}
                    onChange={(e) => set("meta_keywords", e.target.value)}
                    placeholder="books, new arrivals, reading list"
                    className="input-base"
                  />
                  <span className="text-[10.5px] text-fog">Comma-separated.</span>
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-cocoa">Canonical URL</span>
                <input
                  value={seo.canonical_url}
                  onChange={(e) => set("canonical_url", e.target.value)}
                  placeholder={url}
                  className="input-base"
                />
                <span className="text-[10.5px] text-fog">
                  Point search engines at the original if this content lives elsewhere too. Blank = this page.
                </span>
              </label>

              <div className="flex flex-col gap-2 rounded-xl bg-blush-50 p-4">
                <span className="text-[11px] font-medium text-cocoa">Search engine visibility</span>
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" checked={seo.noindex} onChange={(e) => set("noindex", e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
                  <span className="text-[12px] text-ink">
                    Noindex <span className="text-fog">— hide this post from Google entirely.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" checked={seo.nofollow} onChange={(e) => set("nofollow", e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
                  <span className="text-[12px] text-ink">
                    Nofollow <span className="text-fog">— don&apos;t pass ranking credit to links in this post.</span>
                  </span>
                </label>
              </div>
            </div>
          </section>

          {/* ---------- OFF-PAGE / SOCIAL ---------- */}
          <section className="card p-6">
            <h2 className="font-serif text-[1.2rem] text-ink">Off-Page &amp; Social SEO</h2>
            <p className="mt-0.5 text-[11.5px] text-fog">
              How the post looks when it&apos;s shared off your site — on WhatsApp, Facebook, X and more.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-cocoa">Social Title (Open Graph)</span>
                <input
                  value={seo.og_title}
                  onChange={(e) => set("og_title", e.target.value)}
                  placeholder={effTitle}
                  className="input-base"
                />
                <span className="text-[10.5px] text-fog">Blank = the SEO title above.</span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-cocoa">Social Description</span>
                <textarea
                  rows={2}
                  value={seo.og_description}
                  onChange={(e) => set("og_description", e.target.value)}
                  placeholder={effDesc}
                  className="input-base resize-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-cocoa">Social Image URL</span>
                <input
                  value={seo.og_image}
                  onChange={(e) => set("og_image", e.target.value)}
                  placeholder="Leave blank — the cover image is used automatically"
                  className="input-base"
                />
                <span className="text-[10.5px] text-fog">
                  Optional. Only paste a URL if you want a <em>different</em> image for social shares
                  (1200×630 works best). Otherwise the post&apos;s cover image is used.
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-cocoa">Twitter / X Card</span>
                <Select
                  value={seo.twitter_card}
                  onChange={(v) => set("twitter_card", v)}
                  options={[
                    { value: "summary_large_image", label: "Large image" },
                    { value: "summary", label: "Small thumbnail" },
                  ]}
                  ariaLabel="Twitter / X Card"
                  variant="field"
                />
              </label>
            </div>
          </section>
        </div>

        {/* ---------- PREVIEWS + ANALYSIS ---------- */}
        <aside className="flex flex-col gap-6">
          <section className="card p-5">
            <h3 className="text-[10px] font-semibold font-accent uppercase tracking-[0.16em] text-fog">Google preview</h3>
            <div className="mt-3 rounded-xl border border-blush-100 p-3">
              <p className="truncate text-[12px] text-emerald-700">{url || "yoursite.com/blog/post"}</p>
              <p className="mt-0.5 line-clamp-1 text-[15px] text-[#1a0dab]">{effTitle || "Your SEO title"}</p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-cocoa">
                {effDesc || "Your meta description shows here — write something that earns the click."}
              </p>
            </div>
          </section>

          <section className="card p-5">
            <h3 className="text-[10px] font-semibold font-accent uppercase tracking-[0.16em] text-fog">Social preview</h3>
            <div className="mt-3 overflow-hidden rounded-xl border border-blush-100">
              <div className="relative aspect-[1200/630] w-full bg-blush-100">
                {effOgImage ? (
                  // Plain img: the URL can be any external host, outside next/image config.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={effOgImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-[11px] text-fog">No image</span>
                )}
              </div>
              <div className="bg-white px-3 py-2">
                <p className="truncate text-[10px] uppercase tracking-wide text-fog">
                  {origin ? origin.replace(/^https?:\/\//, "") : "yoursite.com"}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[12.5px] font-semibold text-ink">{effOgTitle || "Share title"}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-cocoa">{effOgDesc}</p>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h3 className="flex items-center justify-between text-[10px] font-semibold font-accent uppercase tracking-[0.16em] text-fog">
              On-page checks
              <span className="text-cocoa">{passed}/{checks.length}</span>
            </h3>
            {!seo.focus_keyword.trim() && (
              <p className="mt-2 text-[11px] text-amber-600">
                Add a focus keyword above to unlock keyword checks.
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-[11.5px]">
                  <span className={`mt-px shrink-0 ${c.ok ? "text-emerald-600" : "text-amber-500"}`}>
                    {c.ok ? "✓" : "○"}
                  </span>
                  <span className={c.ok ? "text-cocoa" : "text-fog"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </section>

          {STOREFRONT_URL && (
            <a
              href={`${STOREFRONT_URL}/blog/${post.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-[12px] text-rose-600 hover:underline"
            >
              View live post ↗
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}
