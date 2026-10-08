# Lalwani Books International — storefront

The public online bookstore, in the style of the Bookory book-store theme:
coral accent (the logo's coral), Sora type, peach hero, book shelves and a
dark footer. It reads everything from the Laravel API in
`../lalwani-books-backend-admin/backend`, so books, categories, banners,
prices, contact details and page copy are all managed in the admin panel.

Next.js 16 · React 19 · Tailwind 4 · Node.js 20.9+

## Run it locally

The API must be running first (see the backend README). Then:

```bash
npm install
cp .env.production.example .env.local   # then point it at the local API
npm run dev                             # http://localhost:3000
```

`.env.local` for local work:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8010/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REVALIDATE_SECRET=<same value as REVALIDATE_SECRET in the API's .env>
```

Production: `npm run build` then `npm start`. The build uses webpack on
purpose (Hostinger's build sandbox fails with Turbopack).

## Admin panel

The admin panel is part of this app — one project to run, build and deploy.

- Shop: `http://localhost:3000` — Admin: `http://localhost:3000/admin`
  (sign in at `/admin/login`, or on the normal `/login` page: an admin
  account signing in there lands in the panel).
- Admins see an **Admin** button in the website header.
- Pages: `src/app/admin/` — `(panel)` is everything behind sign-in,
  `(auth)` the sign-in page. The admin's own components, API client and
  sign-in context live in `src/admin/`, apart from the website's, so the two
  can change independently.
- The admin keeps its own session (separate browser-storage keys), so an
  admin and a customer session in the same browser never overwrite each
  other.

## What comes from where

| On the site | Managed in admin |
|---|---|
| Hero slides (title, coral-underlined phrase, button) | Banners — the *subtitle* is the phrase that gets underlined |
| Bestselling Books | Products → tick **Bestseller** |
| New Arrivals | Products → tick **New Arrival** (newest books if none ticked) |
| What's In Trend, About page covers | Products → tick **Featured** |
| Deals Of The Week | Any book with a **Compare-at price** above its price |
| Browse By Genre, Categories menu | Categories (only categories with books show) |
| Popular Authors, stats cards | Counted from the books' **Author** field |
| Collection circles under the hero | Collection Circles |
| Dark promo band | Promo Bands — switch on, add a heading |
| Book of the month | Product Spotlight — switch on, pick a book |
| One shelf per category | Products → tick **Category Rail** (top 3 categories) |
| "Who we are" block | About Page → home section |
| Stat cards | Stats Counter — when on, its values replace the live counts |
| Instagram grid | Instagram — hidden until a post exists |
| Testimonials band | Testimonials — hidden until one exists |
| From The Blog | Blog — hidden until a post exists |
| Top bar phone, footer contact, socials | Settings / Social & Contact |
| Logo, site name, favicon | Branding |

A book without a photo gets a drawn cover in its own colours with its
title and author, so the shop looks complete before photos are uploaded.

## Notes

- The weekly deal countdown runs to Sunday 23:59 IST and restarts each week.
- Checkout requires a customer account (the API enforces it).
- After an admin save the API calls `/revalidate` here so pages refresh
  straight away; this needs `REVALIDATE_SECRET` to match on both sides.
