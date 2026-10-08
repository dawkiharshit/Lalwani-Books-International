# Lalwani Books International

Online bookstore: a Next.js shop with its admin panel, and a Laravel API.

| Folder | What it is | Read |
|---|---|---|
| `lalwani-books-frontend/` | The website customers use, plus the admin panel at `/admin` (Next.js 16, React 19, Tailwind 4) | [README](lalwani-books-frontend/README.md) |
| `lalwani-books-backend-admin/backend/` | The API: catalogue, orders, customers, payments (Razorpay), shipping (Shiprocket), email (Laravel 13, PHP 8.3+, MySQL/MariaDB) | [README](lalwani-books-backend-admin/README.md) |

Secrets live only in each app's `.env` (never committed); the `.env.example` /
`.env.production.example` files list every setting with placeholder values.
Payment, courier and Google keys are entered in the admin panel and stored
encrypted in the database.
