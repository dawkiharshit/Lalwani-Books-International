"use client";

import { use, useSyncExternalStore } from "react";
import Link from "next/link";
import type { OrderDetail } from "@/lib/types";
import { money, formatDate } from "@/lib/format";
import { CheckIcon } from "@/components/icons";
import { PillLink } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

/*
 * Parsed once and cached, because getSnapshot must return the same reference
 * on every call or useSyncExternalStore re-renders forever.
 */
let stashCache: { raw: string | null; order: OrderDetail | null } = { raw: null, order: null };

function readStashedOrder(orderNumber: string): OrderDetail | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem("lalwani_last_order");
  } catch {
    return null;
  }

  if (raw !== stashCache.raw) {
    let parsed: OrderDetail | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as OrderDetail) : null;
    } catch {
      parsed = null;
    }
    stashCache = { raw, order: parsed };
  }

  // Only show it on the page for the order it actually belongs to.
  return stashCache.order?.order_number === orderNumber ? stashCache.order : null;
}

export default function SuccessPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);
  const { user } = useAuth();
  /*
   * The order the checkout just stashed, read straight from sessionStorage.
   * useSyncExternalStore rather than an effect: sessionStorage does not exist
   * during SSR, so the server snapshot is null and the client fills it in on
   * hydration. The value is written once before this page loads and never
   * changes underneath it, so there is nothing to subscribe to.
   */
  const order = useSyncExternalStore(
    () => () => {},
    () => readStashedOrder(orderNumber),
    () => null
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="card overflow-hidden">
        <div className="bg-[linear-gradient(120deg,#e8eff8_0%,#d5e2f1_100%)] px-8 py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600 shadow-soft">
            <CheckIcon className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 font-serif text-[1.9rem] text-ink">Thank you for your order</h1>
          <p className="mt-1 text-[13px] text-cocoa">
            Order <span className="font-semibold text-ink">{orderNumber}</span> has been placed.
          </p>
        </div>

        <div className="p-8">
          {order ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-blush-50 p-4 text-[12.5px]">
                  <p className="font-semibold text-ink">Delivery to</p>
                  <p className="mt-1 leading-relaxed text-cocoa">
                    {order.shipping_address.name}
                    <br />
                    {order.shipping_address.address1}
                    {order.shipping_address.address2 && <><br />{order.shipping_address.address2}</>}
                    <br />
                    {order.shipping_address.city}, {order.shipping_address.state}{" "}
                    {order.shipping_address.zip}
                  </p>
                </div>
                <div className="rounded-2xl bg-blush-50 p-4 text-[12.5px]">
                  <p className="font-semibold text-ink">Details</p>
                  <p className="mt-1 leading-relaxed text-cocoa">
                    Placed {formatDate(order.placed_at)}
                    <br />
                    Payment: {order.payment_method === "cod" ? "Cash on Delivery" : "Online (Razorpay)"}
                    <br />
                    Status: {order.payment_status === "paid" ? "Paid" : "Payment pending"}
                  </p>
                </div>
              </div>

              <ul className="mt-5 divide-y divide-blush-100">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-2.5 text-[13px]">
                    <span className="text-cocoa">
                      {item.name} <span className="text-fog">× {item.quantity}</span>
                    </span>
                    <span className="font-medium text-ink">{money(item.total)}</span>
                  </li>
                ))}
              </ul>

              <dl className="mt-3 space-y-1.5 border-t border-blush-100 pt-3 text-[12.5px]">
                <div className="flex justify-between"><dt className="text-cocoa">Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-600"><dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt><dd>-{money(order.discount)}</dd></div>
                )}
                <div className="flex justify-between"><dt className="text-cocoa">Shipping</dt><dd>{order.shipping === 0 ? "Free" : money(order.shipping)}</dd></div>
                <div className="flex justify-between"><dt className="text-cocoa">Tax</dt><dd>{money(order.tax)}</dd></div>
                <div className="flex justify-between pt-1 text-[14.5px] font-semibold text-ink"><dt>Total</dt><dd>{money(order.total)}</dd></div>
              </dl>
            </>
          ) : (
            <p className="text-center text-[13px] text-cocoa">
              A confirmation was sent to your email. You can track this order any time.
            </p>
          )}

          <p className="mt-6 rounded-2xl bg-blush-50 px-4 py-3 text-center text-[11.5px] leading-relaxed text-cocoa">
            <span className="font-semibold text-ink">Returns &amp; Replacements:</span> 7 days from
            delivery. If anything arrives damaged or not as described, use{" "}
            <Link href={`/track-order?order=${orderNumber}`} className="text-rose-600 hover:underline">
              Track Order
            </Link>{" "}
            to request a return or replacement with a photo — no account needed.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <PillLink href="/collection" arrow>Continue Shopping</PillLink>
            {/* The invoice lives behind the account, so only offer it to the
                signed-in owner — a guest arriving on this URL would hit a 403. */}
            {user && (
              <PillLink href={`/account/orders/${orderNumber}/invoice`} variant="blush">
                View Invoice
              </PillLink>
            )}
            <PillLink href={`/track-order?order=${orderNumber}`} variant="blush">
              Track Order
            </PillLink>
          </div>
        </div>
      </div>
    </div>
  );
}
