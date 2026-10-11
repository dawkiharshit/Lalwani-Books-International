import { clientApi } from "@/lib/api";
import { noteSubmit } from "@/lib/loading-bus";

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface StartResponse {
  key_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  order_number: string;
  name: string;
  prefill: { name: string; email: string; contact: string };
}

interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

/** Load Razorpay's checkout.js once and reuse it on later attempts. */
function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("No window"));
    if (window.Razorpay) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Razorpay failed to load")));
      return;
    }

    const el = document.createElement("script");
    el.src = SCRIPT;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Razorpay failed to load. Check your connection."));
    document.body.appendChild(el);
  });
}

/**
 * Open the Razorpay modal for an order we already created, then have the
 * server verify the signature. Resolves only once the payment is verified —
 * a dismissed modal rejects so the caller can leave the order unpaid.
 */
export async function payWithRazorpay(orderNumber: string): Promise<void> {
  await loadScript();

  // Sends the signed-in token: the server only starts a payment for an order
  // that belongs to the caller.
  const { data } = await clientApi<{ data: StartResponse }>("/payments/razorpay/start", {
    method: "POST",
    body: { order_number: orderNumber },
  });

  await new Promise<void>((resolve, reject) => {
    const Ctor = window.Razorpay;
    if (!Ctor) return reject(new Error("Razorpay is unavailable."));

    const rzp = new Ctor({
      key: data.key_id,
      amount: data.amount,
      currency: data.currency,
      name: data.name,
      description: `Order ${data.order_number}`,
      order_id: data.razorpay_order_id,
      prefill: data.prefill,
      notes: { order_number: data.order_number },
      theme: { color: "#042b52" },
      modal: {
        ondismiss: () => reject(new Error("Payment was cancelled — your order is saved as unpaid.")),
      },
      handler: (res: RazorpayResult) => {
        // Confirming the payment is part of placing the order: keep the shop's
        // "Please wait…" screen up until it is done.
        noteSubmit();
        clientApi("/payments/razorpay/verify", { method: "POST", body: res, token: null })
          .then(() => resolve())
          .catch(() =>
            reject(new Error("Payment went through but could not be verified. We'll confirm shortly."))
          );
      },
    });

    rzp.open();
  });
}
