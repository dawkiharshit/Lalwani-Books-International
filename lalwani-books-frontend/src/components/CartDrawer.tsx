"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { money } from "@/lib/format";
import { ProductThumb } from "./ProductCard";
import { BagIcon, CloseIcon, MinusIcon, PlusIcon } from "./icons";

/**
 * Slide-in cart. Opens from the right whenever something is added, so the
 * shopper sees their bag fill up without leaving the page.
 */
export function CartDrawer() {
  const { cart, drawerOpen, closeCart, updateItem, removeItem, busy, count } = useCart();

  // Lock the page behind the drawer and close on Escape while it's open.
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen, closeCart]);

  const items = cart?.items ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        aria-hidden
        className="fixed inset-0 z-[70] bg-maroon-900/40 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? "auto" : "none" }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Shopping cart"
        aria-hidden={!drawerOpen}
        className="fixed inset-y-0 right-0 z-[71] flex w-[88vw] max-w-md flex-col bg-white shadow-lift transition-transform duration-300 ease-out"
        style={{ transform: drawerOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between border-b border-blush-100 px-5 py-4">
          <h2 className="font-serif text-[1.3rem] text-ink">
            Your Cart {count > 0 && <span className="text-[1rem] text-fog">({count})</span>}
          </h2>
          <button
            onClick={closeCart}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blush-100 text-ink transition-colors hover:bg-blush-150"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blush-100 text-rose-500">
              <BagIcon className="h-7 w-7" />
            </span>
            <p className="font-serif text-[1.3rem] text-ink">Your cart is empty</p>
            <p className="text-[13px] text-cocoa">Add a product to get started.</p>
            <Link
              href="/collection"
              onClick={closeCart}
              className="mt-2 rounded-full bg-ink px-6 py-2.5 text-[12.5px] font-semibold font-accent uppercase tracking-[0.1em] text-white transition-colors hover:bg-maroon-900"
            >
              Browse Collection
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <ul className="flex flex-col gap-4">
              {items.map((it) => (
                <li key={it.id} className="flex gap-3">
                  <Link href={`/product/${it.product.slug}`} onClick={closeCart} className="shrink-0">
                    <ProductThumb product={it.product} className="h-20 w-16 rounded-xl" />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/product/${it.product.slug}`}
                      onClick={closeCart}
                      className="line-clamp-1 text-[13.5px] font-medium text-ink hover:text-rose-600"
                    >
                      {it.product.name}
                    </Link>
                    <span className="text-[12px] text-fog">{money(it.unit_price)}</span>

                    <div className="mt-auto flex items-center justify-between pt-1.5">
                      <div className="flex items-center rounded-full border border-blush-200">
                        <button
                          onClick={() =>
                            it.quantity <= 1 ? removeItem(it.id) : updateItem(it.id, it.quantity - 1)
                          }
                          disabled={busy}
                          aria-label="Decrease quantity"
                          className="flex h-7 w-7 items-center justify-center text-cocoa hover:text-ink"
                        >
                          <MinusIcon className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-[12.5px] font-medium tabular-nums">
                          {it.quantity}
                        </span>
                        <button
                          onClick={() => updateItem(it.id, it.quantity + 1)}
                          disabled={busy}
                          aria-label="Increase quantity"
                          className="flex h-7 w-7 items-center justify-center text-cocoa hover:text-ink"
                        >
                          <PlusIcon className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-[13px] font-medium text-ink">{money(it.line_total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(it.id)}
                    disabled={busy}
                    aria-label={`Remove ${it.product.name}`}
                    className="self-start text-fog transition-colors hover:text-rose-600"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <div className="border-t border-blush-100 px-5 py-4">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-cocoa">Subtotal</span>
              <span className="font-semibold text-ink">{money(cart?.subtotal ?? 0)}</span>
            </div>
            <p className="mt-1 text-[11px] text-fog">Shipping &amp; taxes calculated at checkout.</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/checkout"
                onClick={closeCart}
                className="flex items-center justify-center rounded-full bg-maroon-800 py-3 text-[13px] font-semibold font-accent uppercase tracking-[0.1em] text-white transition-colors hover:bg-maroon-900"
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                onClick={closeCart}
                className="flex items-center justify-center rounded-full border border-blush-200 py-2.5 text-[12.5px] text-cocoa transition-colors hover:bg-blush-50"
              >
                View Cart
              </Link>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
