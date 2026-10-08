import type { OrderDetail } from "@/admin/lib/types";
import { formatDate, money, STATUS_COLORS, STATUS_LABELS } from "@/admin/lib/format";

const STEPS = ["pending", "processing", "shipped", "delivered"];

export function OrderCard({ order }: { order: OrderDetail }) {
  const stepIndex = STEPS.indexOf(order.status);

  return (
    <div className="card p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-serif text-[1.3rem] text-ink">{order.order_number}</p>
          <p className="text-[11.5px] text-fog">Placed {formatDate(order.placed_at)}</p>
        </div>
        <span
          className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold ${STATUS_COLORS[order.status] ?? "bg-blush-100 text-cocoa"}`}
        >
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
      </div>

      {order.status !== "cancelled" && (
        <div className="mt-6">
          <div className="flex items-center">
            {STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 items-center last:flex-none">
                <span
                  className={`flex h-3 w-3 shrink-0 rounded-full ${
                    i <= stepIndex ? "bg-rose-500" : "bg-blush-150"
                  }`}
                />
                {i < STEPS.length - 1 && (
                  <span
                    className={`h-0.5 flex-1 ${i < stepIndex ? "bg-rose-500" : "bg-blush-150"}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-fog">
            {STEPS.map((s) => (
              <span key={s}>{STATUS_LABELS[s]}</span>
            ))}
          </div>
        </div>
      )}

      {/* Enough to pack the box from: photo, code, size, and the maths. */}
      <ul className="mt-6 divide-y divide-blush-100 border-t border-blush-100">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-blush-50">
              {item.product?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.product.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-ink">{item.name}</span>
              <span className="mt-0.5 block text-[11px] text-fog">
                {item.product?.sku && <span className="font-mono">{item.product.sku}</span>}
                {item.product?.sku && item.product?.size_ml ? " · " : ""}
                {item.product?.size_ml ? `${item.product.size_ml} ml` : ""}
              </span>
              <span className="mt-0.5 block text-[11px] text-cocoa">
                {money(item.unit_price)} × {item.quantity}
              </span>
            </span>

            <span className="shrink-0 text-[13px] font-medium text-ink">{money(item.total)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-3 space-y-1.5 border-t border-blush-100 pt-3 text-[12.5px]">
        <div className="flex justify-between"><dt className="text-cocoa">Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
        {order.discount > 0 && (
          <div className="flex justify-between text-emerald-600">
            <dt>Discount{order.coupon_code ? ` (${order.coupon_code})` : ""}</dt>
            <dd>-{money(order.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between"><dt className="text-cocoa">Shipping</dt><dd>{order.shipping === 0 ? "Free" : money(order.shipping)}</dd></div>
        <div className="flex justify-between"><dt className="text-cocoa">Tax</dt><dd>{money(order.tax)}</dd></div>
        <div className="flex justify-between pt-1 text-[14.5px] font-semibold text-ink"><dt>Total</dt><dd>{money(order.total)}</dd></div>
      </dl>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-blush-50 p-4 text-[12px]">
          <p className="font-semibold text-ink">Shipping address</p>
          <p className="mt-1 leading-relaxed text-cocoa">
            {order.shipping_address.name} · {order.shipping_address.phone}
            <br />
            {order.shipping_address.address1}
            {order.shipping_address.address2 && <><br />{order.shipping_address.address2}</>}
            <br />
            {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
            <br />
            {order.shipping_address.country}
          </p>
        </div>
        <div className="rounded-2xl bg-blush-50 p-4 text-[12px]">
          <p className="font-semibold text-ink">Payment</p>
          <p className="mt-1 leading-relaxed text-cocoa">
            {order.payment_method === "cod" ? "Cash on Delivery" : "Online (Razorpay)"}
            <br />
            Status: {order.payment_status}
            {order.notes && (
              <>
                <br />
                Notes: {order.notes}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
