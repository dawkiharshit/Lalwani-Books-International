"use client";

import { PageBanner } from "@/components/PageBanner";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { money, TAX_LABEL } from "@/lib/format";
import { ProductThumb } from "@/components/ProductCard";
import { MinusIcon, PlusIcon, CloseIcon, BagIcon } from "@/components/icons";
import { PillLink } from "@/components/ui";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, fetchSettingsClient, type StoreSettings } from "@/lib/settings";
import { PageLoader } from "@/components/loading/BookLoader";

export default function CartPage() {
  const { cart, busy, updateItem, removeItem, clear } = useCart();
  const { user } = useAuth();
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    fetchSettingsClient().then(setSettings);
  }, []);
  const FREE_SHIPPING = settings.free_shipping_threshold;
  const FLAT_SHIP = settings.flat_shipping;
  const TAX = settings.tax_rate;
  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const remaining = Math.max(0, FREE_SHIPPING - subtotal);

  if (cart && items.length === 0) {
    return (
      <div className="card flex flex-col items-center px-8 py-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blush-100 text-rose-500">
          <BagIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-5 font-serif text-[1.8rem] text-ink">Your cart is empty</h1>
        <p className="mt-2 max-w-sm text-[13px] text-cocoa">
          Nothing here yet. Browse the shop and find your next read.
        </p>
        <div className="mt-6">
          <PillLink href="/collection" arrow>Explore Collection</PillLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBanner title="Shopping Cart" crumbs={[{ label: "Cart" }]} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card divide-y divide-blush-100 px-6">
          {!cart && (
            <PageLoader label="Loading your bag…" className="py-16" />
          )}
          {items.map((item) => (
            <article key={item.id} className="flex flex-wrap items-center gap-3 py-5 sm:flex-nowrap sm:gap-4">
              <Link href={`/product/${item.product.slug}`} className="block shrink-0">
                <ProductThumb product={item.product} className="h-20 w-20 rounded-xl" />
              </Link>

              <div className="min-w-[140px] flex-1">
                <Link
                  href={`/product/${item.product.slug}`}
                  className="block truncate text-[14px] font-medium text-ink hover:text-rose-600"
                >
                  {item.product.name}
                </Link>
                <p className="mt-1 text-[12px] text-fog">{money(item.unit_price)} each</p>
              </div>

              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <div className="flex items-center rounded-full border border-blush-200">
                <button
                  onClick={() => updateItem(item.id, item.quantity - 1)}
                  disabled={busy}
                  className="flex h-8 w-8 items-center justify-center text-cocoa hover:text-ink disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <MinusIcon className="h-3 w-3" />
                </button>
                <span className="w-7 text-center text-[13px]">{item.quantity}</span>
                <button
                  onClick={() => updateItem(item.id, item.quantity + 1)}
                  disabled={busy}
                  className="flex h-8 w-8 items-center justify-center text-cocoa hover:text-ink disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <PlusIcon className="h-3 w-3" />
                </button>
              </div>

              <p className="w-20 text-right text-[14px] font-medium text-ink">
                {money(item.line_total)}
              </p>

              <button
                onClick={() => removeItem(item.id)}
                disabled={busy}
                aria-label={`Remove ${item.product.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-fog transition-colors hover:bg-blush-100 hover:text-rose-600"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
              </div>
            </article>
          ))}
          {items.length > 0 && (
            <div className="flex justify-between py-4">
              <button onClick={() => clear()} disabled={busy} className="text-[12px] text-fog hover:text-rose-600">
                Clear bag
              </button>
              <Link href="/collection" className="text-[12px] text-rose-600 hover:underline">
                Continue shopping
              </Link>
            </div>
          )}
        </section>

        <aside className="card sticky top-6 p-6">
          <h2 className="font-serif text-[1.25rem] text-ink">Order Summary</h2>

          {remaining > 0 ? (
            <div className="mt-4 rounded-2xl bg-blush-50 p-4">
              <p className="text-[11.5px] text-cocoa">
                You&apos;re <span className="font-semibold text-rose-600">{money(remaining)}</span> away from free shipping
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blush-150">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all"
                  style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-[11.5px] text-emerald-700">
              You&apos;ve unlocked free shipping ✨
            </p>
          )}

          <dl className="mt-5 space-y-2.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-cocoa">Subtotal</dt>
              <dd className="font-medium text-ink">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cocoa">Shipping</dt>
              <dd className="text-fog">{subtotal >= FREE_SHIPPING ? "Free" : money(FLAT_SHIP)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-cocoa">{TAX_LABEL} ({Math.round(TAX * 100)}%)</dt>
              <dd className="text-fog">{money(subtotal * TAX)}</dd>
            </div>
          </dl>
          <hr className="my-4 border-blush-100" />
          <div className="flex justify-between text-[15px] font-semibold text-ink">
            <span>Estimated total</span>
            <span>{money(subtotal + (subtotal >= FREE_SHIPPING ? 0 : FLAT_SHIP) + subtotal * TAX)}</span>
          </div>
          <p className="mt-1 text-[10.5px] text-fog">Coupons are applied at checkout.</p>

          {/* Signed out, checkout sends them to sign in first, then back. */}
          <PillLink
            href="/checkout"
            arrow
            className={`mt-5 w-full ${items.length === 0 ? "pointer-events-none opacity-50" : ""}`}
          >
            Proceed to Checkout
          </PillLink>
          {!user && (
            <p className="mt-2 text-center text-[10.5px] text-fog">
              You&apos;ll sign in before placing your order.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
