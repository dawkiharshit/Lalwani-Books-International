"use client";

import { SettingsForm } from "../settings-form";

/**
 * Every photo and line of copy on /about, in the order the page shows them,
 * and then the About block on the home page. Each section keeps its image
 * right next to the words it belongs with, so it is clear which picture goes
 * where. Blank a field to hide that line, blank an image to fall back to the
 * built-in one.
 */
export default function AdminAbout() {
  return (
    <SettingsForm
      heading="About Page"
      blurb="The whole /about page, top to bottom, and the About block on the home page. Text saves with the button at the bottom; images save the moment you upload them."
      sections={[
        {
          title: "1 · Top of the page",
          note: "Text on the left, a photo on the right.",
          images: [
            {
              settingKey: "about_hero_image",
              label: "Photo",
              hint: "Shown on the right in a 5:4 frame, 1000×800px or larger. Max 4MB. With no photo, a stack of featured book covers is shown.",
            },
          ],
          fields: [
            { key: "about_hero_eyebrow", label: "Small line above the title", placeholder: "Our Story" },
            { key: "about_hero_title", label: "Title", placeholder: "Books for Every Reader" },
            {
              key: "about_hero_highlight",
              label: "Highlight words (shown in coral)",
              placeholder: "Every Reader",
              hint: "If these words appear in the title, they are picked out in coral.",
              span: true,
            },
            { key: "about_hero_subtitle", label: "Description", type: "textarea", rows: 4 },
            { key: "about_hero_note", label: "Closing paragraph", type: "textarea", rows: 2 },
          ],
        },
        {
          title: "2 · Stat cards",
          note: "Four cards under the top section — total books, authors, categories and delivery — counted live from your catalogue, or your own numbers from Stats Counter.",
          link: { href: "/admin/stats", label: "Edit the numbers" },
          fields: [{ key: "about_stats_enabled", label: "Show the stat cards", type: "toggle", span: true }],
        },
        {
          title: "3 · The four cards",
          note: "A small line, a heading and four value cards under the stat cards. Blank a card's title and text to drop it; blank both heading lines to show the cards alone.",
          fields: [
            { key: "about_values_eyebrow", label: "Small line above the cards", placeholder: "Why choose us" },
            { key: "about_values_title", label: "Heading above the cards", placeholder: "What every order gets", span: true },
            { key: "about_value_1_title", label: "Card 1 — title", placeholder: "Genuine Editions" },
            { key: "about_value_1_body", label: "Card 1 — text", type: "textarea", rows: 2 },
            { key: "about_value_2_title", label: "Card 2 — title", placeholder: "Wide Catalogue" },
            { key: "about_value_2_body", label: "Card 2 — text", type: "textarea", rows: 2 },
            { key: "about_value_3_title", label: "Card 3 — title", placeholder: "Careful Packing" },
            { key: "about_value_3_body", label: "Card 3 — text", type: "textarea", rows: 2 },
            { key: "about_value_4_title", label: "Card 4 — title", placeholder: "Bulk & Institutional Orders" },
            { key: "about_value_4_body", label: "Card 4 — text", type: "textarea", rows: 2 },
          ],
        },
        {
          title: "4 · Testimonials",
          note: "Every testimonial from Testimonials, as cards under the four value cards. The heading is the Home Page's testimonials title.",
          link: { href: "/admin/testimonials", label: "Edit testimonials" },
          fields: [{ key: "about_testimonials_enabled", label: "Show the testimonials", type: "toggle", span: true }],
        },
        {
          title: "5 · Founder",
          note: "The founder block at the bottom. Leave the name, heading and story all blank to hide it entirely.",
          images: [
            {
              settingKey: "about_founder_image",
              label: "Founder portrait",
              aspect: "square",
              hint: "The portrait beside the founder story. Square photo, 600×600px or larger. Max 4MB. Empty shows a book icon instead.",
            },
          ],
          fields: [
            { key: "about_founder_name", label: "Name", placeholder: "Arpita" },
            { key: "about_founder_role", label: "Role / tagline", placeholder: "Founder & Director" },
            { key: "about_founder_eyebrow", label: "Small line above the heading", placeholder: "The Founder" },
            { key: "about_founder_heading", label: "Heading", placeholder: "Meet the Founder" },
            {
              key: "about_founder_highlight",
              label: "Highlight words (in coral)",
              placeholder: "Founder",
              span: true,
            },
            {
              key: "about_founder_story",
              label: "Bio / story (HTML allowed)",
              type: "textarea",
              rows: 10,
              hint: "Wrap paragraphs in <p> tags. <strong>, <em>, <h3>, <ul> and links also work.",
            },
          ],
        },
        {
          id: "home-block",
          title: "Home page · About block",
          note: "The “Who we are” block on the home page: three book-shaped photos side by side, with the text beside them. With no photos, three book covers are shown.",
          images: [
            { settingKey: "about_home_image_1", label: "Photo 1", aspect: "portrait", hint: "Portrait, book-cover shape (5:7), 600×840px or larger. Max 4MB." },
            { settingKey: "about_home_image_2", label: "Photo 2 (set slightly lower)", aspect: "portrait", hint: "Portrait, book-cover shape (5:7), 600×840px or larger. Max 4MB." },
            { settingKey: "about_home_image_3", label: "Photo 3", aspect: "portrait", hint: "Portrait, book-cover shape (5:7), 600×840px or larger. Max 4MB." },
          ],
          fields: [
            { key: "about_home_eyebrow", label: "Small line above the heading", placeholder: "Who we are" },
            { key: "about_home_title", label: "Heading", placeholder: "About Lalwani Books International", hint: "Clear the heading to hide this block from the home page." },
            { key: "about_home_body1", label: "First paragraph", type: "textarea", rows: 3 },
            { key: "about_home_body2", label: "Second paragraph", type: "textarea", rows: 3 },
            { key: "about_pillar_1_value", label: "Figure 1 — value", placeholder: "12" },
            { key: "about_pillar_1_label", label: "Figure 1 — label", placeholder: "Subjects covered" },
            { key: "about_pillar_2_value", label: "Figure 2 — value", placeholder: "100%" },
            { key: "about_pillar_2_label", label: "Figure 2 — label" },
            { key: "about_pillar_3_value", label: "Figure 3 — value", placeholder: "100%" },
            { key: "about_pillar_3_label", label: "Figure 3 — label" },
          ],
        },
      ]}
    />
  );
}
