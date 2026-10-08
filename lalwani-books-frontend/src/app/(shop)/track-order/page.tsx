"use client";

import { PageBanner } from "@/components/PageBanner";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clientApi } from "@/lib/api";
import type { OrderDetail } from "@/lib/types";
import { OrderCard } from "@/components/OrderCard";
import { ReturnSection } from "@/components/ReturnSection";
import { Spinner } from "@/components/ui";

function TrackForm() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get("order") ?? "");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOrder(null);
    try {
      const res = await clientApi<{ data: OrderDetail }>("/orders/track", {
        method: "POST",
        body: { order_number: orderNumber, email },
        token: null,
      });
      setOrder(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order not found.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageBanner title="Track Your Order" crumbs={[{ label: "Track Order" }]} />

      <form onSubmit={submit} className="card p-8">
        <h1 className="text-center font-serif text-[1.9rem] text-ink">Track Your Order</h1>
        <p className="mt-1 text-center text-[12.5px] text-fog">
          Enter your order number and the email used at checkout
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Order number</label>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
              placeholder="LBI-20261005-XXXX"
              required
              className="input-base uppercase"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-cocoa">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-base"
            />
          </div>
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-[12px] text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[13.5px] text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {busy && <Spinner className="h-4 w-4" />} Track Order
        </button>
      </form>

      {order && <OrderCard order={order} />}

      {/* Guest returns: request straight from here, verified by the order email. */}
      {order && <ReturnSection order={order} email={email} />}
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense>
      <TrackForm />
    </Suspense>
  );
}
