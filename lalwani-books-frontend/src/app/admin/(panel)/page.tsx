"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clientApi } from "@/admin/lib/api";
import { money, STATUS_COLORS, STATUS_LABELS } from "@/admin/lib/format";
import { Spinner } from "@/admin/components/ui";
import { CountUp } from "@/admin/components/CountUp";

/*
 * Each section starts a beat after the one above it, and each figure a beat
 * after its neighbour, so the dashboard fills in as a ripple down the page
 * rather than every number firing on the same frame.
 */
const STEP = 70;
const SECTION = { sales: 0, stages: 140, money: 280, cards: 420 } as const;

interface Stats {
  revenue: number;
  orders_count: number;
  customers_count: number;
  products_count: number;
  reviews_count: number;
  subscribers_count: number;
  unread_messages: number;
  top_products: { product_id: number; name: string; sold: string; revenue: string }[];
  recent_orders: {
    order_number: string;
    status: string;
    total: number;
    customer: string;
    email: string;
    items_count: number;
  }[];
  status_breakdown: Record<string, number>;
  sales: { today: number; yesterday: number; week: number; month: number; year: number };
  average_order_value: number;
  payments: {
    cod_orders: number;
    cod_revenue: number;
    cod_uncollected: number;
    prepaid_orders: number;
    prepaid_revenue: number;
  };
  stock: { out_of_stock: number; low_stock: number };
}

/** The five order states, in the order an order moves through them. */
const PIPELINE = ["pending", "processing", "shipped", "delivered", "cancelled"] as const;

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: Stats }>("/admin/stats")
      .then((res) => setStats(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load stats."));
  }, []);

  if (error) return <p className="card px-6 py-5 text-[13px] text-red-600">{error}</p>;
  if (!stats)
    return (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> Loading dashboard...
      </div>
    );

  // Numbers rather than pre-formatted strings, so each can count up to itself.
  const cards: { label: string; value: number; kind: "money" | "count"; href: string }[] = [
    { label: "Total Revenue", value: stats.revenue, kind: "money", href: "/admin/orders" },
    { label: "Avg Order Value", value: stats.average_order_value, kind: "money", href: "/admin/orders" },
    { label: "Orders", value: stats.orders_count, kind: "count", href: "/admin/orders" },
    { label: "Customers", value: stats.customers_count, kind: "count", href: "/admin/orders" },
    { label: "Products", value: stats.products_count, kind: "count", href: "/admin/products" },
    { label: "Reviews", value: stats.reviews_count, kind: "count", href: "/admin/reviews" },
    { label: "Subscribers", value: stats.subscribers_count, kind: "count", href: "/admin/inbox" },
    { label: "Unread Messages", value: stats.unread_messages, kind: "count", href: "/admin/inbox" },
  ];

  const periods = [
    { label: "Today", value: stats.sales.today },
    { label: "Yesterday", value: stats.sales.yesterday },
    { label: "This week", value: stats.sales.week },
    { label: "This month", value: stats.sales.month },
    { label: "This year", value: stats.sales.year },
  ];

  const actions = [
    { href: "/admin/products/new", label: "+ New Product" },
    { href: "/admin/blogs", label: "+ New Post" },
    { href: "/admin/banners", label: "+ New Banner" },
    { href: "/admin/orders", label: "View Orders" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Sales over time — the question asked every single morning. */}
      <section className="card p-5 sm:p-6">
        <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-fog">Sales</p>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {periods.map((p, i) => (
            <div key={p.label}>
              <p className="text-[10.5px] font-accent uppercase tracking-[0.14em] text-fog">{p.label}</p>
              <p className="mt-1 font-serif text-[1.5rem] leading-none text-ink">
                <CountUp value={p.value} kind="money" delay={SECTION.sales + i * STEP} />
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Where every order currently sits */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-fog">Orders by stage</p>
          <Link href="/admin/orders" className="text-[12px] text-rose-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PIPELINE.map((s, i) => (
            <Link
              key={s}
              href={`/admin/orders?status=${s}`}
              className="rounded-2xl bg-blush-50 px-4 py-3.5 transition-colors hover:bg-blush-100"
            >
              <p className="font-serif text-[1.5rem] leading-none text-ink">
                <CountUp value={stats.status_breakdown[s] ?? 0} delay={SECTION.stages + i * STEP} />
              </p>
              <p
                className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  STATUS_COLORS[s] ?? "bg-blush-100 text-fog"
                }`}
              >
                {STATUS_LABELS[s] ?? s}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Money split, and what the courier still owes you */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-fog">Payment method</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10.5px] font-accent uppercase tracking-[0.14em] text-fog">
                Prepaid · {stats.payments.prepaid_orders} orders
              </p>
              <p className="mt-1 font-serif text-[1.4rem] leading-none text-ink">
                <CountUp value={stats.payments.prepaid_revenue} kind="money" delay={SECTION.money} />
              </p>
            </div>
            <div>
              <p className="text-[10.5px] font-accent uppercase tracking-[0.14em] text-fog">
                COD · {stats.payments.cod_orders} orders
              </p>
              <p className="mt-1 font-serif text-[1.4rem] leading-none text-ink">
                <CountUp value={stats.payments.cod_revenue} kind="money" delay={SECTION.money + STEP} />
              </p>
            </div>
          </div>
          {stats.payments.cod_uncollected > 0 && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-800">
              <span className="font-semibold">{money(stats.payments.cod_uncollected)}</span> of COD
              is not marked collected yet — that is cash the courier still holds.
            </p>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-fog">Stock</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Link href="/admin/products" className="group">
              <p className="text-[10.5px] font-accent uppercase tracking-[0.14em] text-fog">Out of stock</p>
              <p
                className={`mt-1 font-serif text-[1.9rem] leading-none ${
                  stats.stock.out_of_stock > 0 ? "text-red-600" : "text-ink"
                }`}
              >
                <CountUp value={stats.stock.out_of_stock} delay={SECTION.money} />
              </p>
            </Link>
            <Link href="/admin/products" className="group">
              <p className="text-[10.5px] font-accent uppercase tracking-[0.14em] text-fog">Running low</p>
              <p
                className={`mt-1 font-serif text-[1.9rem] leading-none ${
                  stats.stock.low_stock > 0 ? "text-amber-700" : "text-ink"
                }`}
              >
                <CountUp value={stats.stock.low_stock} delay={SECTION.money + STEP} />
              </p>
            </Link>
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-fog">
            {stats.stock.out_of_stock > 0
              ? "Out-of-stock products are losing sales right now."
              : "Nothing is sold out."}
          </p>
        </section>
      </div>

      {/*
        Two to a row on a 360–375px phone leaves each card 114–121px inside,
        and a revenue figure at 1.8rem is 107px at ₹31,640 and 130px at
        ₹1,23,456 — so the figure steps down to 1.5rem (108px) until sm.
      */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((c, i) => (
          <Link key={c.label} href={c.href} className="card p-5 transition-shadow hover:shadow-md sm:p-6">
            <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-fog">{c.label}</p>
            <p className="mt-2 font-serif text-[1.5rem] text-ink sm:text-[1.8rem]">
              <CountUp value={c.value} kind={c.kind} delay={SECTION.cards + i * STEP} />
            </p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {actions.map((a, i) => (
          <Link
            key={a.href}
            href={a.href}
            className={`rounded-full px-5 py-2 text-[12.5px] transition-colors ${
              i === actions.length - 1
                ? "border border-blush-200 bg-white text-cocoa hover:bg-blush-100"
                : "bg-maroon-800 text-white hover:bg-maroon-900"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/*
        grid-cols-1 and minmax(0,1fr), not a bare `grid` or `1fr`: either of
        those lets the column grow to the table's full width, which pushed the
        whole panel sideways on a phone instead of letting the table scroll
        inside its card. Side by side only from xl — at lg the column beside a
        360px panel is too narrow for the table to read.
      */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card p-5 sm:p-6">
          <h2 className="font-serif text-[1.3rem] text-ink">Recent Orders</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-blush-100 text-[10.5px] uppercase tracking-wide text-fog">
                  <th className="pb-2 pr-3">Order</th>
                  <th className="hidden pb-2 pr-3 sm:table-cell">Customer</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blush-50">
                {stats.recent_orders.map((o) => (
                  <tr key={o.order_number}>
                    <td className="py-2.5 pr-3">
                      {/* nowrap: an order number broken at its hyphens is hard to read back. */}
                      <Link href="/admin/orders" className="whitespace-nowrap font-medium text-ink hover:text-rose-600">
                        {o.order_number}
                      </Link>
                      {/* On a phone the Customer column is dropped so the table
                          fits the screen; the name moves under the number. */}
                      <span className="mt-0.5 block text-[11.5px] text-cocoa sm:hidden">{o.customer}</span>
                    </td>
                    <td className="hidden py-2.5 pr-3 text-cocoa sm:table-cell">{o.customer}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[o.status] ?? "bg-blush-100 text-cocoa"}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-medium text-ink">{money(o.total)}</td>
                  </tr>
                ))}
                {stats.recent_orders.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-fog">No orders yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="card p-5 sm:p-6">
            <h2 className="font-serif text-[1.2rem] text-ink">Top Products</h2>
            <ul className="mt-3 divide-y divide-blush-50">
              {stats.top_products.map((p) => (
                <li key={p.name} className="flex items-start justify-between gap-3 py-2.5 text-[12.5px]">
                  {/* A long name wraps; the figures stay on one line beside it. */}
                  <span className="min-w-0 text-cocoa">{p.name}</span>
                  <span className="shrink-0 whitespace-nowrap text-right text-fog">
                    {p.sold} sold · {money(Number(p.revenue))}
                  </span>
                </li>
              ))}
              {stats.top_products.length === 0 && (
                <li className="py-4 text-center text-[12px] text-fog">No sales yet.</li>
              )}
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
