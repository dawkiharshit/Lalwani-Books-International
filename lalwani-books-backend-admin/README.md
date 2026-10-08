# Lalwani Books International — backend API

The Laravel API behind the Lalwani Books International online bookstore.
The website **and the admin panel** are one Next.js app, next to this
folder in `../lalwani-books-frontend` — the admin lives at `/admin` there.

| Folder | What it is | Needs |
|---|---|---|
| `backend/` | Laravel API: catalogue, orders, customers, coupons, returns, page content, settings, Razorpay payments, Shiprocket shipping, email | PHP 8.3+, Composer, MySQL or MariaDB |

The admin panel used to be a separate app in `admin/`. It was merged into
the website on 2026-10-05; the old copy is kept, zipped, in
`../archive/admin-standalone-2026-10-05.zip`.

Not included, on purpose: `vendor/` (Composer installs it), any `.env`
file, uploaded images, logs and caches.

## Set up

```bash
cd backend
composer install
cp .env.example .env          # Windows: copy .env.example .env
php artisan key:generate
```

In `.env`:

- `DB_*` — your database (create it first).
- `FRONTEND_URL` — the website's address, e.g. `http://localhost:3000`.
  Google sign-in returns here, order emails link here, admin saves refresh
  it through `/revalidate`, and it is the origin the API accepts browser
  requests from (CORS). The admin panel is on the same address, so it needs
  nothing extra. (In local mode any localhost port is allowed.)
- `ADMIN_URL` — leave empty. Only needed if an admin panel is ever served
  from a different address again.
- `REVALIDATE_SECRET` — any long random string; the website's `.env.local`
  must have the same value.
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — the first admin account.
  Only read once, when the account is created; change the password later in
  the admin panel (Password page).

Then create the tables, the admin account and the starter book catalogue
(8 categories, 26 well-known titles, 2 hero banners):

```bash
php artisan migrate
php artisan db:seed --class=UserSeeder
php artisan db:seed --class=BookSeeder
```

The book catalogue is a starting point: edit or archive anything in the
panel. Ratings start at zero and no reviews or testimonials are invented.
Avoid `php artisan migrate --seed` — `DatabaseSeeder` still loads the old
beauty-shop demo products.

Finally:

```bash
php artisan storage:link      # without it, uploaded images 404
php artisan serve --port=8010
```

Then start the website (see its README) and open
**http://localhost:3000/admin**.

## Good to know

- **Book details.** Every product has Author, Publisher, ISBN, Binding,
  Language, Pages and Published year (admin → Products). Author shows on
  every card and is searchable on the website, as are publisher and ISBN.
- **Tax.** Printed books are GST-exempt, so the default tax rate is 0%. Set
  a rate in admin → Shipping & Tax if you ever sell taxable items; the
  checkout shows the tax line only when a rate is set.
- **Rate limits.** Sign-in, sign-up, checkout, contact and the other public
  forms each have their own limit (named throttles in `routes/api.php`), so
  using one never blocks another.
- **Instant website refresh.** After every admin save the API calls
  `FRONTEND_URL/revalidate` when `REVALIDATE_SECRET` is set.
- **Old categories.** One migration
  (`2026_08_27_140000_convert_categories_to_rashis.php`) creates twelve
  zodiac collections from an earlier version of the shop. `BookSeeder`
  removes them as long as they hold no products.
- **Hosting without SSH.** `backend/.htaccess` sends every request into
  `public/`, for hosts (like Hostinger) whose subdomain points at the app
  folder rather than `public/`. Harmless when the host points at `public/`.
