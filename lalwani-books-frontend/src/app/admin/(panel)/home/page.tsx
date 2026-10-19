"use client";

import { SettingsForm, type SettingField } from "../settings-form";

/** A show/hide switch plus an optional heading for one home-page section. */
const section = (key: string, title?: string): SettingField[] => [
  { key: `home_${key}_enabled`, label: "Show this section", type: "toggle", span: !title },
  ...(title
    ? [{ key: `home_${key}_title`, label: "Heading", placeholder: title, hint: "Leave blank for the default heading." }]
    : []),
];

/**
 * The home page, top to bottom, in the order the sections appear on the site.
 * Each one can be switched off and renamed here; the ones with content of
 * their own (banners, circles, deals, promo band, spotlight, testimonials and
 * the About block) link to the screen that manages them.
 */
export default function AdminHome() {
  return (
    <SettingsForm
      heading="Home Page"
      blurb="Every section of the home page, in the order visitors see them. Switch a section off to hide it, or rename it; sections with their own content link to the screen where you edit it."
      sections={[
        {
          title: "1 · Hero banners",
          note: "The large sliding banners at the top. With none live, the hero shows your Featured books instead.",
          link: { href: "/admin/banners", label: "Edit hero banners" },
          fields: [],
        },
        {
          title: "2 · Author circles",
          note: "The round author shortcuts under the hero: every author with books in the shop (Categories & Authors), each with their photo — or their initials until one is added — linking to that author's books. Hidden while there is nothing to show.",
          link: { href: "/admin/categories?tab=authors", label: "Edit authors" },
          fields: [
            { key: "home_author_circles_enabled", label: "Show the author circles under the hero", type: "toggle", span: true },
          ],
        },
        {
          title: "3 · Bestselling Books",
          note: "Books ticked as Bestseller in Products — the best rated when none are.",
          fields: section("bestsellers", "Bestselling Books"),
        },
        {
          title: "4 · Recently Viewed",
          note: "The books each visitor opened lately, newest first — kept in their own browser, so everyone sees their own, and nothing shows until they have opened a book. Prices and stock are always today’s.",
          fields: section("recent", "Recently Viewed"),
        },
        {
          title: "5 · Promo band",
          note: "The dark promotional band with a button. Switched on and written in its own screen.",
          link: { href: "/admin/cta-banner", label: "Edit promo band" },
          fields: [],
        },
        {
          title: "6 · What's In Trend",
          note: "Books ticked as Featured in Products — the best rated when none are.",
          fields: section("trend", "What's In Trend"),
        },
        {
          title: "7 · Product spotlight",
          note: "One book shown large, with an add-to-cart button. Chosen and switched on in its own screen.",
          link: { href: "/admin/spotlight", label: "Edit product spotlight" },
          fields: [],
        },
        {
          title: "8 · New Arrivals",
          note: "Books ticked as New Arrival in Products — the newest when none are.",
          fields: section("new", "New Arrivals"),
        },
        {
          title: "9 · Browse By Genre",
          note:
            "Books: All Books and eight genres — Fiction, Non-Fiction, Academic, Children, Art & Design, Business, Competitive Exams, Indian Literature — with pictures from Categories. A genre with no category yet (such as Art & Design) says “Coming soon” until you add a category of that name and give it books. Discover: New Arrivals, Bestsellers, The Lalwani Edit (books ticked Featured) and Gift Ideas (books ticked Gift Idea) in Products.",
          link: { href: "/admin/categories", label: "Edit categories" },
          fields: section("genres", "Browse By Genre"),
        },
        {
          title: "10 · Category shelves",
          note: "One shelf per category (up to three), from books ticked as Category Rail in Products.",
          fields: [{ key: "home_rails_enabled", label: "Show this section", type: "toggle", span: true }],
        },
        {
          title: "11 · Popular Authors & Keep Reading",
          note: "Authors come from Categories & Authors — with their photo when one is set — ranked by how many of their books you stock. Keep Reading lists your top-rated books.",
          link: { href: "/admin/categories?tab=authors", label: "Edit authors" },
          fields: [...section("authors", "Popular Authors"), ...section("reading", "Keep Reading")],
        },
        {
          title: "12 · Deals Of The Week",
          note: "Your offers from Deals, sliding one after another every five seconds — each with its own wording, colour and countdown, beside its own reduced books (books whose Compare-at price is higher than their price). Right above the About block.",
          link: { href: "/admin/deals", label: "Edit deals" },
          fields: section("deals", "Deals Of The Week"),
        },
        {
          title: "13 · About block",
          note: "“Who we are” — three photos beside a short story. Edited with the About page; clear its heading there to hide it.",
          link: { href: "/admin/about#home-block", label: "Edit about block" },
          fields: [],
        },
        {
          title: "14 · From The Blog",
          note: "Your latest blog posts.",
          link: { href: "/admin/blogs", label: "Edit blog posts" },
          fields: section("blog", "From The Blog"),
        },
        {
          title: "15 · Testimonials",
          note: "Reader quotes as cards, each with the reader's photo — two rows at a time, sliding on to the next set by itself. The last section of the page, right above the footer; up to twelve live ones are shown.",
          link: { href: "/admin/testimonials", label: "Edit testimonials" },
          fields: section("testimonials", "What readers say"),
        },
        {
          title: "Footer · Newsletter (every page)",
          note: "The sign-up at the top of the footer. Sign-ups appear in Messages & Subscribers.",
          fields: [
            { key: "newsletter_enabled", label: "Show the newsletter sign-up", type: "toggle", span: true },
            { key: "newsletter_title", label: "Heading", placeholder: "Subscribe to our newsletter" },
            { key: "newsletter_text", label: "Text", placeholder: "New arrivals, reading lists and offers — straight to your inbox." },
          ],
        },
      ]}
    />
  );
}
