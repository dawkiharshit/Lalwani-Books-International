import { CheckoutMarks, PaymentTicker } from "./payment-ticker";
import type { EnabledMethods } from "./payment-ticker";

/**
 * The payment block on a product and the marks at checkout.
 *
 * The marks themselves, and the rail that carries them, live in
 * payment-ticker.tsx — one source of truth for both spots. What shows still
 * follows the gateway that is switched on: with Razorpay off the shop can
 * only take cash, so only cash is shown.
 *
 * `methods` narrows it further, to what that gateway will genuinely accept.
 * Leave it out and a conservative default shows rather than nothing.
 */

/**
 * Just the marks, no card around them — for tight spots like the payment
 * choice at checkout, where the full block would shout.
 */
export function PaymentMarks({
  methods,
  className = "",
}: {
  methods?: EnabledMethods | null;
  className?: string;
}) {
  return <CheckoutMarks methods={methods} className={className} />;
}

export function PaymentMethods({
  online,
  methods,
  className = "",
}: {
  /** Razorpay is switched on, so online methods are genuinely available. */
  online: boolean;
  /** Exactly which of them this account accepts. */
  methods?: EnabledMethods | null;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-blush-200 bg-blush-50/60 p-4 ${className}`}>
      <p className="text-[10px] font-semibold font-accent uppercase tracking-[0.18em] text-fog">
        {online ? "Pay securely with" : "Payment on delivery"}
      </p>

      <PaymentTicker online={online} methods={methods} className="mt-2.5" />
    </div>
  );
}
