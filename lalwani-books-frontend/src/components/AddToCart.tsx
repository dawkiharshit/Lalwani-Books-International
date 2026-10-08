"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { ArrowRight, CheckIcon, MinusIcon, PlusIcon } from "./icons";
import { Spinner } from "./ui";
import { WishlistButton } from "./WishlistButton";
import { startNavigation } from "@/lib/loading-bus";

export function AddToCartIcon({
  productId,
  className = "h-7 w-7",
}: {
  productId: number;
  className?: string;
}) {
  const { addItem } = useCart();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function add(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (state !== "idle") return;
    setState("busy");
    try {
      await addItem(productId, 1);
      setState("done");
      setTimeout(() => setState("idle"), 1400);
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      onClick={add}
      aria-label="Add to cart"
      className={`flex items-center justify-center rounded-full bg-white text-ink shadow-soft transition-all hover:bg-rose-600 hover:text-white ${className}`}
    >
      {state === "busy" ? (
        <Spinner className="h-3 w-3" />
      ) : state === "done" ? (
        <CheckIcon className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.4} />
      ) : (
        <PlusIcon className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  );
}

function CartGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
      <path d="M2.5 3H5l2 12.3a1.4 1.4 0 0 0 1.4 1.1h8.8a1.4 1.4 0 0 0 1.4-1.1L21 7H5.4" />
    </svg>
  );
}

/** Lightning bolt — the "buy it now" fast lane. */
function BoltGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function AddToCartPanel({
  productId,
  stock,
  showWishlist = false,
}: {
  productId: number;
  stock: number;
  showWishlist?: boolean;
}) {
  const { addItem, openCart } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const max = Math.min(stock, 10);
  // Local busy — the cart's shared `busy` made this button flash a spinner
  // whenever the cart changed elsewhere (e.g. the drawer's quantity steppers).
  const busy = adding || buying;

  async function add() {
    if (adding) return;
    setAdding(true);
    try {
      await addItem(productId, qty);
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
      openCart();
    } catch {
      /* cart error already surfaced via state */
    } finally {
      setAdding(false);
    }
  }

  // Add the chosen quantity, then go straight to checkout — the button says
  // "Go to checkout", and it used to stop at the cart page instead.
  async function buyNow() {
    if (buying) return;
    setBuying(true);
    try {
      await addItem(productId, qty);
      startNavigation("/checkout");
      router.push("/checkout");
    } catch {
      setBuying(false);
    }
  }

  if (stock < 1) {
    return (
      <div className="rounded-full bg-blush-100 px-6 py-3 text-center text-[13px] text-fog">
        Out of stock — back soon
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Quantity + wishlist beside it */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-fit items-center rounded-full border border-blush-200 bg-white">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-9 w-9 items-center justify-center text-cocoa hover:text-ink"
            aria-label="Decrease quantity"
          >
            <MinusIcon className="h-3.5 w-3.5" />
          </button>
          <span className="w-7 text-center text-[14px] font-medium">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            className="flex h-9 w-9 items-center justify-center text-cocoa hover:text-ink"
            aria-label="Increase quantity"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        {showWishlist && (
          <div className="flex items-center gap-2">
            <WishlistButton productId={productId} className="h-10 w-10" />
            <span className="text-[11.5px] text-fog">Add to Wishlist</span>
          </div>
        )}
      </div>

      {/* Add to Cart — filled */}
      <button
        onClick={add}
        disabled={busy}
        className="group relative flex items-center justify-center rounded-full bg-rose-600 px-12 py-3.5 text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
      >
        <span className="absolute left-5 flex h-9 w-9 items-center justify-center">
          {adding ? <Spinner className="h-4 w-4" /> : added ? <CheckIcon className="h-5 w-5" strokeWidth={2.2} /> : <CartGlyph className="h-5 w-5" />}
        </span>
        <span className="text-center">
          <span className="block text-[15px] font-semibold leading-tight">{added ? "Added to Cart" : "Add to Cart"}</span>
          <span className="block text-[11px] font-accent uppercase tracking-[0.16em] text-white/70">Keep shopping</span>
        </span>
        <ArrowRight className="absolute right-5 h-4 w-4 text-white/90 transition-transform group-hover:translate-x-0.5" />
      </button>

      {/* Buy It Now — outline (skips straight to checkout) */}
      <button
        onClick={buyNow}
        disabled={busy || buying}
        className="group relative flex items-center justify-center rounded-full border border-ink bg-white px-12 py-3.5 text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-60"
      >
        <span className="absolute left-5 flex h-9 w-9 items-center justify-center">
          {buying ? <Spinner className="h-4 w-4" /> : <BoltGlyph className="h-5 w-5" />}
        </span>
        <span className="text-center">
          <span className="block text-[15px] font-semibold leading-tight">Buy It Now</span>
          <span className="block text-[11px] font-accent uppercase tracking-[0.16em] opacity-60">Go to checkout</span>
        </span>
        <ArrowRight className="absolute right-5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

/** Full-width "Add to Cart" bar used on product cards — slides up on hover. */
export function AddToCartBar({
  productId,
  className = "",
  label = "Add to Cart",
  solid = false,
}: {
  productId: number;
  className?: string;
  label?: string;
  solid?: boolean;
}) {
  const { addItem } = useCart();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function add(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (state !== "idle") return;
    setState("busy");
    try {
      await addItem(productId, 1);
      setState("done");
      setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("idle");
    }
  }

  const tone = solid
    ? "bg-maroon-800 text-white hover:bg-maroon-900"
    : "bg-white/95 text-ink shadow-lift backdrop-blur hover:bg-rose-600 hover:text-white";

  return (
    <button
      onClick={add}
      aria-label={label}
      className={`flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[11.5px] font-semibold font-accent uppercase tracking-[0.1em] transition-colors ${tone} ${className}`}
    >
      {state === "busy" ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : state === "done" ? (
        <>
          <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.4} /> Added
        </>
      ) : (
        label
      )}
    </button>
  );
}

/**
 * Product-card control: an "Add to Cart" button that turns into a −/+ quantity
 * stepper once the item is in the cart, showing how many are in the bag. Used
 * on mobile cards (no hover). It lives inside the card's <Link>, so every
 * control stops the click from navigating to the product page.
 */
export function CardQuantityControl({
  productId,
  label = "Add to Cart",
}: {
  productId: number;
  label?: string;
}) {
  const { cart, addItem, updateItem, removeItem, openCart } = useCart();
  // Local busy — the cart's shared `busy` flips for every card at once, so one
  // tap made all the steppers on the page blink. This keeps the spinner and the
  // disabled state on the card that was actually tapped.
  const [busy, setBusy] = useState(false);
  const item = cart?.items.find((i) => i.product.id === productId);
  const qty = item?.quantity ?? 0;

  async function run(e: React.MouseEvent, action: () => Promise<unknown>) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  if (qty === 0) {
    return (
      <button
        onClick={(e) =>
          run(e, async () => {
            await addItem(productId, 1);
            openCart();
          })
        }
        disabled={busy}
        aria-label={label}
        className="flex w-full items-center justify-center gap-1.5 rounded-full border border-rose-600 py-2.5 text-[12.5px] font-semibold text-rose-600 transition-colors hover:bg-rose-600 hover:text-white disabled:opacity-70"
      >
        {busy ? <Spinner className="h-3.5 w-3.5" /> : label}
      </button>
    );
  }

  return (
    <div
      className={`flex w-full items-center justify-between rounded-full bg-rose-600 text-white transition-opacity ${
        busy ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={(e) =>
          run(e, () =>
            !item ? Promise.resolve() : qty <= 1 ? removeItem(item.id) : updateItem(item.id, qty - 1)
          )
        }
        disabled={busy}
        aria-label="Decrease quantity"
        className="flex h-10 w-12 items-center justify-center rounded-l-full transition-colors hover:bg-rose-700 disabled:opacity-60"
      >
        <MinusIcon className="h-3.5 w-3.5" />
      </button>
      {/* The number stays put — no spinner swap — so nothing flickers. */}
      <span className="min-w-8 text-center text-[13px] font-semibold tabular-nums">{qty}</span>
      <button
        onClick={(e) => run(e, () => (item ? updateItem(item.id, qty + 1) : addItem(productId, 1)))}
        disabled={busy}
        aria-label="Increase quantity"
        className="flex h-10 w-12 items-center justify-center rounded-r-full transition-colors hover:bg-rose-700 disabled:opacity-60"
      >
        <PlusIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
