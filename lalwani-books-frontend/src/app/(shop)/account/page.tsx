"use client";

import { PageBanner } from "@/components/PageBanner";
import { AccountDetails } from "@/components/AccountDetails";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/api";
import { formatDate, money, STATUS_LABELS } from "@/lib/format";
import type { OrderSummary } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddressBook } from "@/components/AddressBook";
import { ArrowRight, BookOpenIcon, CloseIcon, PencilIcon } from "@/components/icons";
import { ProductImage } from "@/components/ProductImage";
import { PageLoader } from "@/components/loading/BookLoader";

export default function AccountPage() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState("");
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  /**
   * The name, email, mobile and password forms stay folded away until
   * "Edit profile" is pressed, so the account page opens on orders and
   * addresses rather than on a wall of empty password boxes.
   */
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const editPanel = useRef<HTMLElement>(null);

  // Opening the panel puts the caret in its first field, for keyboard users.
  useEffect(() => {
    if (editing) editPanel.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [editing]);

  function closeEditor() {
    setEditing(false);
    // The panel is going away; put focus back on the button that opened it.
    editButton.current?.focus();
  }

  // `ready` guards the redirect: the token is restored from localStorage after
  // first paint, so redirecting before then would bounce a signed-in shopper.
  //
  // `hadUser` separates arriving signed out (send to sign-in) from signing out
  // while here (send home). Both leave `user` null, and treating a deliberate
  // sign-out like a missing session landed people on a sign-in form offering
  // to take them straight back into the account they had just left.
  const hadUser = useRef(false);
  useEffect(() => {
    if (user) hadUser.current = true;
    if (ready && !user) router.replace(hadUser.current ? "/" : "/login?next=/account");
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    clientApi<{ data: OrderSummary[] }>("/orders")
      .then((r) => !cancelled && setOrders(r.data ?? []))
      .catch(() => !cancelled && setError("Could not load your orders."));
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!ready || !user) {
    return (
      <PageLoader label="Loading your account…" />
    );
  }

  return (
    <>
    <PageBanner title="My Account" crumbs={[{ label: "My Account" }]} />
    <div className="mx-auto w-full max-w-4xl">

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-accent uppercase tracking-[0.25em] text-rose-500">Your Account</p>
          <h1 className="mt-1 font-serif text-[1.9rem] text-ink">{user.name}</h1>
          <p className="text-[12.5px] text-fog">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={editButton}
            type="button"
            onClick={() => (editing ? closeEditor() : setEditing(true))}
            aria-expanded={editing}
            aria-controls="edit-profile"
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium transition-colors ${
              editing
                ? "border border-blush-200 text-cocoa hover:bg-blush-100 hover:text-ink"
                : "bg-ink text-white hover:bg-rose-600"
            }`}
          >
            {editing ? <CloseIcon className="h-3.5 w-3.5" /> : <PencilIcon className="h-3.5 w-3.5" />}
            {editing ? "Close" : "Edit profile"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingSignOut(true)}
            className="cursor-pointer rounded-full border border-blush-200 px-4 py-2 text-[12px] font-medium text-cocoa transition-colors hover:bg-blush-100 hover:text-ink"
          >
            Sign out
          </button>
        </div>

      </header>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out?"
        body={
          <>
            You will be signed out of <span className="font-medium text-ink">{user.email}</span> on
            this device. Your cart and wishlist are kept.
          </>
        }
        confirmLabel="Sign out"
        busy={signingOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={async () => {
          setSigningOut(true);
          await logout();
          router.push("/");
        }}
      />

      {editing && (
        <section
          id="edit-profile"
          ref={editPanel}
          aria-labelledby="edit-profile-title"
          className="mt-6 rounded-[var(--radius-card)] bg-blush-50 p-4 [animation:heroIn_0.45s_cubic-bezier(0.22,1,0.36,1)_both] sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="edit-profile-title" className="text-[1.15rem] font-semibold text-ink">
                Edit profile
              </h2>
              <p className="mt-0.5 text-[12.5px] text-fog">Update your name, email and mobile, or change your password.</p>
            </div>
            <button
              type="button"
              onClick={closeEditor}
              className="cursor-pointer rounded-full border border-blush-200 bg-white px-4 py-1.5 text-[12px] font-medium text-cocoa transition-colors hover:bg-blush-100 hover:text-ink"
            >
              Done
            </button>
          </div>
          <AccountDetails user={user} className="mt-4" />
        </section>
      )}

      {!user.email_verified && (
        <p className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-blush-100 px-4 py-3 text-[12px] text-cocoa">
          Your email is not confirmed yet.
          <Link href="/verify-email" className="font-medium text-rose-600 underline-offset-4 hover:underline">
            Confirm it now
          </Link>
        </p>
      )}

      <nav className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/wishlist", label: "Wishlist", sub: "Saved for later" },
          { href: "/collection", label: "Shop", sub: "Browse everything" },
          { href: "/track-order", label: "Track an order", sub: "By number + email" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="card group flex items-center justify-between p-4 transition-shadow hover:shadow-lift"
          >
            <span>
              <span className="block text-[13px] font-medium text-ink">{l.label}</span>
              <span className="block text-[11px] text-fog">{l.sub}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-rose-500 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </nav>

      <AddressBook />

      <section className="mt-8">
        <h2 className="font-serif text-[1.3rem] text-ink">Order history</h2>

        {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

        {!orders && !error && (
          <PageLoader label="Loading your orders…" size="sm" className="mt-4 py-8" />
        )}

        {orders?.length === 0 && (
          <div className="card mt-4 p-8 text-center">
            <p className="text-[13px] text-cocoa">You have not placed an order yet.</p>
            <Link
              href="/collection"
              className="mt-3 inline-flex rounded-full bg-rose-600 px-5 py-2.5 text-[12.5px] font-medium text-white hover:bg-rose-700"
            >
              Start shopping
            </Link>
          </div>
        )}

        {orders && orders.length > 0 && (
          <ul className="mt-4 space-y-3">
            {orders.map((o) => {
              // The books in the order: up to three covers fanned out, and the
              // first title with "+ 2 more" for the rest.
              const books = o.items ?? [];
              const first = books[0];
              const more = Math.max(0, (o.lines_count ?? books.length) - 1);
              return (
              <li key={o.id}>
                <Link
                  href={`/account/orders/${o.order_number}`}
                  className="card flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4 transition-shadow hover:shadow-lift"
                >
                  {/* Phones: the books and title take the whole row, status and price drop below it. */}
                  <span className="flex w-full min-w-0 items-center gap-4 sm:w-auto sm:flex-1">
                    {books.length > 0 && (
                      <span aria-hidden className="flex shrink-0 -space-x-5">
                        {books.map((b, i) => (
                          <span
                            key={b.id}
                            className="relative h-16 w-12 overflow-hidden rounded-md bg-blush-100 shadow-soft ring-2 ring-white"
                            style={{ zIndex: books.length - i }}
                          >
                            {b.product ? (
                              <ProductImage product={b.product} sizes="48px" showLabel={false} />
                            ) : (
                              <BookOpenIcon className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-rose-300" />
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink">{o.order_number}</span>
                      {first && (
                        <span className="mt-0.5 block truncate text-[12.5px] text-cocoa">
                          {first.name}
                          {first.quantity > 1 && <span className="text-fog"> × {first.quantity}</span>}
                          {more > 0 && <span className="text-fog"> + {more} more</span>}
                        </span>
                      )}
                      <span className="block text-[11px] text-fog">
                        {formatDate(o.placed_at)} · {o.items_count} item{o.items_count === 1 ? "" : "s"}
                      </span>
                    </span>
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-blush-100 px-3 py-1 text-[10.5px] font-medium uppercase tracking-wide text-cocoa">
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                    <span className="text-[13px] font-medium text-ink">{money(o.total)}</span>
                  </span>
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
    </>
  );
}
