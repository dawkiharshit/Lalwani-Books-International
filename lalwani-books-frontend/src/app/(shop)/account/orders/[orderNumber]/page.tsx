"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/api";
import type { OrderDetail } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { OrderCard } from "@/components/OrderCard";
import { ReturnSection } from "@/components/ReturnSection";
import { ArrowRight } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { PageLoader } from "@/components/loading/BookLoader";

export default function AccountOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);
  const { user, ready } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");

  async function cancel() {
    if (!confirm("Cancel this order? The items go back into stock.")) return;
    setCancelling(true);
    setCancelMsg("");
    try {
      const res = await clientApi<{ message: string; data: OrderDetail }>(
        `/orders/${orderNumber}/cancel`,
        { method: "POST", body: { reason: "Cancelled by customer" } }
      );
      setOrder(res.data);
      setCancelMsg(res.message);
    } catch (err) {
      setCancelMsg(err instanceof Error ? err.message : "Could not cancel this order.");
    } finally {
      setCancelling(false);
    }
  }

  // Signing out from here clears `user` exactly as arriving signed out does.
  // `hadUser` tells the two apart, so a deliberate sign-out goes home rather
  // than to a sign-in form that would lead straight back to this order.
  const hadUser = useRef(false);
  useEffect(() => {
    if (user) hadUser.current = true;
    if (!ready) return;
    if (!user) {
      router.replace(hadUser.current ? "/" : `/login?next=/account/orders/${orderNumber}`);
      return;
    }
    clientApi<{ data: OrderDetail }>(`/orders/${orderNumber}`)
      .then((res) => setOrder(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Order not found."));
  }, [ready, user, orderNumber, router]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link href="/account" className="text-[12px] text-fog hover:text-rose-600">
        ← Back to account
      </Link>
      {error && <p className="card px-6 py-5 text-[13px] text-red-600">{error}</p>}
      {!order && !error && (
        <PageLoader label="Loading your order…" className="card py-16" />
      )}
      {order && <OrderCard order={order} />}

      {/* Where the parcel is — drawn only once a courier has been booked. */}
      {order?.shipment && (
        <section className="card p-6" aria-label="Shipment">
          {/* A courier booked by hand leaves the order "processing" until it ships. */}
          <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-fog">
            {order.status === "processing" ? "Courier booked" : order.status === "delivered" ? "Delivered" : "On its way"}
          </p>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {order.shipment.courier_name && (
              <span className="font-serif text-[1.15rem] text-ink">
                {order.shipment.courier_name}
              </span>
            )}
            <span className="font-mono text-[12.5px] text-cocoa">
              AWB {order.shipment.awb_code}
            </span>
          </div>

          {order.shipment.shipped_at && (
            <p className="mt-1 text-[11.5px] text-fog">
              Dispatched{" "}
              {new Date(order.shipment.shipped_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}

          {order.shipment.tracking_url && (
            <a
              href={order.shipment.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-maroon-800 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-maroon-900"
            >
              Track your parcel
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </a>
          )}
        </section>
      )}

      {/* Return / replacement — the form while eligible, else the live status. */}
      {order && <ReturnSection order={order} />}

      {order && (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/account/orders/${orderNumber}/invoice`}
            className="rounded-full bg-maroon-800 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-maroon-900"
          >
            View invoice
          </Link>

          {/* Cancelling is only offered while nothing has left the atelier. */}
          {!["shipped", "delivered", "cancelled"].includes(order.status) && (
            <button
              onClick={cancel}
              disabled={cancelling}
              className="flex items-center gap-2 rounded-full border border-blush-200 px-6 py-2.5 text-[13px] text-cocoa transition-colors hover:bg-blush-100 disabled:opacity-60"
            >
              {cancelling && <Spinner className="h-3.5 w-3.5" />} Cancel order
            </button>
          )}
        </div>
      )}

      {cancelMsg && (
        <p className="rounded-xl bg-blush-50 px-4 py-2.5 text-[12px] text-cocoa">{cancelMsg}</p>
      )}
    </div>
  );
}
