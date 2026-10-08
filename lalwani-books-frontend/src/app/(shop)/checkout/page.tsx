"use client";

import { PageBanner } from "@/components/PageBanner";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clientApi, ApiError } from "@/lib/api";
import { money, TAX_LABEL } from "@/lib/format";
import type { OrderDetail, SavedAddress } from "@/lib/types";
import { addressLine } from "@/components/AddressBook";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui";
import { CheckIcon } from "@/components/icons";
import { PaymentMarks } from "@/components/PaymentMethods";
import type { EnabledMethods } from "@/components/payment-ticker";
import { payWithRazorpay } from "@/lib/razorpay";
import { DEFAULT_SETTINGS, fetchSettingsClient, type StoreSettings } from "@/lib/settings";
import { PageLoader } from "@/components/loading/BookLoader";
import { startNavigation } from "@/lib/loading-bus";

/** What the courier quoted for this cart and PIN. */
interface ShippingQuote {
  charge: number;
  source: "free_over_threshold" | "shiprocket" | "flat_rate" | "not_serviceable";
  courier: string | null;
  days: number | null;
  serviceable: boolean;
}

/** A coupon the shop advertises on checkout (admin → Coupons → "Shown"). */
interface PublicCoupon {
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  expires_at: string | null;
}

interface Form {
  email: string;
  ship_name: string;
  ship_phone: string;
  ship_address1: string;
  ship_address2: string;
  ship_city: string;
  ship_state: string;
  ship_zip: string;
  ship_country: string;
  notes: string;
}

/** Copy a saved address into the checkout form, keeping email and notes. */
function fromSaved(f: Form, a: SavedAddress): Form {
  return {
    ...f,
    ship_name: a.name,
    ship_phone: a.phone,
    ship_address1: a.address1,
    ship_address2: a.address2 ?? "",
    ship_city: a.city,
    ship_state: a.state,
    ship_zip: a.zip,
    ship_country: a.country || "India",
  };
}

const EMPTY: Form = {
  email: "",
  ship_name: "",
  ship_phone: "",
  ship_address1: "",
  ship_address2: "",
  ship_city: "",
  ship_state: "",
  ship_zip: "",
  ship_country: "India",
  notes: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, refresh } = useCart();
  const { user, ready } = useAuth();
  const [form, setForm] = useState<Form>(EMPTY);
  const [payment, setPayment] = useState<"cod" | "razorpay">("cod");
  const [pay, setPay] = useState<{
    razorpay_enabled: boolean;
    razorpay_key_id: string | null;
    cod_enabled: boolean;
    methods?: EnabledMethods;
  }>({
    razorpay_enabled: false,
    razorpay_key_id: null,
    // Assume on until the config says otherwise — the common case, so COD does
    // not flash out for the shops that keep it.
    cod_enabled: true,
  });

  // Placing an order needs an account (the API refuses guests too), so a
  // signed-out shopper is sent to sign in and brought back here.
  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/checkout");
  }, [ready, user, router]);

  // With no Razorpay keys configured that option never appears; with COD
  // switched off in admin, its option goes too.
  useEffect(() => {
    clientApi<{
      data: {
        razorpay_enabled: boolean;
        razorpay_key_id: string | null;
        cod_enabled: boolean;
        methods?: EnabledMethods;
      };
    }>("/payments/config", { token: null, cartToken: null })
      .then((r) => {
        setPay(r.data);
        // Land the selection on a method that is actually offered.
        if (!r.data.cod_enabled) setPayment(r.data.razorpay_enabled ? "razorpay" : "cod");
      })
      .catch(() => {});
  }, []);
  const noPaymentMethod = !pay.cod_enabled && !pay.razorpay_enabled;
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [publicCoupons, setPublicCoupons] = useState<PublicCoupon[]>([]);
  // Collapsed on phones to save scroll; the sidebar (lg+) shows them open.
  const [offersOpen, setOffersOpen] = useState(false);

  // Offers the shop chose to advertise — shown under the coupon box so a
  // shopper can tap one instead of hunting for a code.
  useEffect(() => {
    clientApi<{ data: PublicCoupon[] }>("/coupons", { token: null, cartToken: null })
      .then((r) => setPublicCoupons(r.data))
      .catch(() => setPublicCoupons([]));
  }, []);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Flips true once the order is placed, so a late abandoned-checkout ping
  // can't re-create the record the server just cleared.
  const placedRef = useRef(false);

  /*
   * Prefill from the signed-in user, but never overwrite something typed.
   * Adjusted during render rather than in an effect so the fields are filled
   * on first paint; the sentinel makes it run once per user, not per render.
   */
  const [prefilledFor, setPrefilledFor] = useState<number | null>(null);
  if (user && prefilledFor !== user.id) {
    setPrefilledFor(user.id);
    setForm((f) => ({
      ...f,
      email: f.email || user.email,
      ship_name: f.ship_name || user.name,
      ship_phone: f.ship_phone || user.phone || "",
    }));
  }

  /*
   * Saved addresses for a signed-in customer. The default fills the form —
   * unless they've already started typing an address — and the rest are one
   * tap away. `chosen` is the saved address the fields currently match; it
   * clears as soon as they edit one by hand.
   */
  const [saved, setSaved] = useState<SavedAddress[] | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [defaultApplied, setDefaultApplied] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    clientApi<{ data: SavedAddress[] }>("/addresses")
      .then((r) => !cancelled && setSaved(r.data))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Same render-time adjustment as the profile prefill above: once the list
  // arrives, fill in the default — but only into an empty address.
  if (saved && !defaultApplied) {
    setDefaultApplied(true);
    const def = saved.find((a) => a.is_default) ?? saved[0];
    if (def && !form.ship_address1.trim()) {
      setChosen(def.id);
      setForm(fromSaved(form, def));
    }
  }

  function pickSaved(a: SavedAddress) {
    setChosen(a.id);
    setForm((f) => fromSaved(f, a));
  }

  function pickNewAddress() {
    setChosen(null);
    setForm((f) => ({
      ...f,
      ship_address1: "",
      ship_address2: "",
      ship_city: "",
      ship_state: "",
      ship_zip: "",
      ship_country: "India",
    }));
  }

  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  /*
   * The courier quote, stored with the PIN and payment method it was priced
   * for. Keeping the key alongside the answer means an incomplete PIN simply
   * stops matching — nothing has to be cleared from inside an effect — and a
   * slow reply for an old PIN can never overwrite a newer one.
   */
  const [quoted, setQuoted] = useState<{ key: string; data: ShippingQuote | null }>({
    key: "",
    data: null,
  });
  const [quoting, setQuoting] = useState(false);
  useEffect(() => {
    fetchSettingsClient().then(setSettings);
  }, []);

  const subtotal = cart?.subtotal ?? 0;
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const base = Math.max(subtotal - discount, 0);

  // A complete PIN is all the courier needs to price the parcel.
  const pin = form.ship_zip.trim();
  const quotableKey =
    /^\d{6}$/.test(pin) && cart?.items.length ? `${pin}|${payment}` : "";
  const quote = quotableKey && quoted.key === quotableKey ? quoted.data : null;

  // The cart can clear the free-shipping bar without a PIN; a zero threshold
  // means "no free shipping", so it must be > 0 — the same rule the server uses.
  const freeByThreshold =
    settings.free_shipping_threshold > 0 && base >= settings.free_shipping_threshold;
  // The server decides the real charge; this stands in until a PIN is typed.
  const shipping =
    quote?.serviceable === false
      ? 0
      : (quote?.charge ?? (freeByThreshold ? 0 : settings.flat_shipping));
  // A real shipping figure only exists once a PIN has been quoted — unless the
  // cart is already free by threshold. Until then the summary asks for the PIN
  // rather than showing a misleading "Free".
  const shippingKnown = quote !== null || freeByThreshold;
  // Shipping is taxed along with the goods — the same rule the server applies.
  const taxableValue = base + shipping;
  const tax = taxableValue * settings.tax_rate;
  const total = taxableValue + tax;

  useEffect(() => {
    // Nothing to price yet; `quote` above already reads as null.
    if (!quotableKey) return;

    let cancelled = false;

    // Wait for typing to settle rather than firing on every digit.
    const t = setTimeout(() => {
      setQuoting(true);
      clientApi<{ data: ShippingQuote }>("/shipping/quote", {
        method: "POST",
        body: { pin: quotableKey.split("|")[0], cod: payment === "cod" },
      })
        .then((res) => !cancelled && setQuoted({ key: quotableKey, data: res.data }))
        .catch(() => !cancelled && setQuoted({ key: quotableKey, data: null }))
        .finally(() => !cancelled && setQuoting(false));
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [quotableKey, payment]);

  // Abandoned-checkout capture: once there's a way to reach the shopper (a
  // valid email or a full 10-digit phone), quietly save what they've entered
  // so the admin can follow up if they leave. Debounced; the server wipes it
  // the moment the order is placed.
  useEffect(() => {
    if (placedRef.current) return;
    const emailOk = /.+@.+\..+/.test(form.email);
    const phoneOk = form.ship_phone.replace(/\D/g, "").length >= 10;
    if (!emailOk && !phoneOk) return;

    const t = setTimeout(() => {
      if (placedRef.current) return;
      clientApi("/checkout/abandon", {
        method: "POST",
        body: {
          email: form.email || undefined,
          ship_name: form.ship_name || undefined,
          ship_phone: form.ship_phone || undefined,
          ship_address1: form.ship_address1 || undefined,
          ship_city: form.ship_city || undefined,
          ship_state: form.ship_state || undefined,
          ship_zip: form.ship_zip || undefined,
        },
      }).catch(() => {});
    }, 1500);

    return () => clearTimeout(t);
  }, [
    form.email,
    form.ship_name,
    form.ship_phone,
    form.ship_address1,
    form.ship_city,
    form.ship_state,
    form.ship_zip,
  ]);

  function set(key: keyof Form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    // Hand-editing an address field means it's no longer that saved address.
    if (key !== "email" && key !== "notes") setChosen(null);
  }

  async function applyCoupon(codeArg?: string) {
    const code = (codeArg ?? couponInput).trim();
    setCouponMsg("");
    if (!code) return;
    setCouponInput(code.toUpperCase());
    try {
      const res = await clientApi<{ data: { code: string; discount: number } }>(
        "/coupons/validate",
        { method: "POST", body: { code, subtotal } }
      );
      setCoupon(res.data);
      setCouponMsg(`Coupon ${res.data.code} applied — you save ${money(res.data.discount)}.`);
    } catch (err) {
      setCoupon(null);
      setCouponMsg(err instanceof Error ? err.message : "Invalid coupon.");
    }
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const res = await clientApi<{ data: OrderDetail }>("/checkout", {
        method: "POST",
        body: {
          ...form,
          ship_address2: form.ship_address2 || undefined,
          notes: form.notes || undefined,
          payment_method: payment,
          coupon_code: coupon?.code,
        },
      });
      // The order exists now; the server has cleared this session's abandoned
      // record. Stop any further capture pings from re-creating it.
      placedRef.current = true;
      // The order exists either way; an online payment happens against it and
      // only a verified signature marks it paid.
      if (payment === "razorpay" && pay.razorpay_enabled) {
        try {
          await payWithRazorpay(res.data.order_number);
        } catch (payErr) {
          setError(
            payErr instanceof Error
              ? payErr.message
              : "Payment did not complete. Your order is saved as unpaid."
          );
          setBusy(false);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }

      sessionStorage.setItem("lalwani_last_order", JSON.stringify(res.data));
      await refresh();
      startNavigation(`/checkout/success/${res.data.order_number}`);
      router.push(`/checkout/success/${res.data.order_number}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrors(err.errors ?? {});
      } else {
        setError("Could not place the order. Please try again.");
      }
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Wait for the auth check to settle; a signed-out shopper only sees this
  // while being sent to sign in.
  if (!ready || !user) {
    return (
      <PageLoader label={ready ? "Taking you to sign in…" : "Loading checkout…"} className="card py-24" />
    );
  }

  if (cart && cart.items.length === 0) {
    return (
      <div className="card px-8 py-16 text-center">
        <h1 className="font-serif text-[1.8rem] text-ink">Nothing to check out</h1>
        <p className="mt-2 text-[13px] text-cocoa">Your cart is empty.</p>
        <Link href="/collection" className="mt-5 inline-block rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white">
          Explore Collection
        </Link>
      </div>
    );
  }

  const fieldError = (k: string) => errors[k]?.[0];

  const field = (
    key: keyof Form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) => (
    <div>
      <label htmlFor={key} className="mb-1 block text-[11px] font-medium text-cocoa">{label}</label>
      {/* id + name + a real autocomplete token let the browser offer its saved
          contact/address and fill the whole group from one pick. */}
      <input
        id={key}
        name={key}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className="input-base"
        {...props}
      />
      {fieldError(key) && <p className="mt-1 text-[11px] text-red-500">{fieldError(key)}</p>}
    </div>
  );

  return (
    <form onSubmit={placeOrder} className="flex flex-col gap-6">
      <PageBanner title="Checkout" crumbs={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
      {error && (
        <p className="rounded-2xl bg-red-50 px-5 py-3.5 text-[13px] text-red-600">{error}</p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <section className="card p-7">
            <h2 className="font-serif text-[1.25rem] text-ink">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("email", "Email address", { type: "email", required: true, autoComplete: "email" })}
              {/* type=tel brings up the number pad; the courier rings this. */}
              {field("ship_phone", "Phone", {
                required: true,
                type: "tel",
                inputMode: "numeric",
                autoComplete: "tel",
                placeholder: "10-digit mobile",
              })}
            </div>
            <p className="mt-3 text-[11.5px] text-fog">
              Ordering as <span className="text-ink">{user.email}</span> — your orders appear under{" "}
              <Link href="/account" className="text-rose-600 hover:underline">
                My Account
              </Link>
              .
            </p>
          </section>

          <section className="card p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-[1.25rem] text-ink">Shipping Address</h2>
              {saved && saved.length > 0 && (
                <Link href="/account" className="text-[11.5px] text-rose-600 hover:underline">
                  Manage addresses
                </Link>
              )}
            </div>

            {saved && saved.length > 0 && (
              <div role="radiogroup" aria-label="Saved addresses" className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {saved.map((a) => {
                  const active = chosen === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickSaved(a)}
                      className={`rounded-2xl border-2 p-3.5 text-left transition-colors ${
                        active ? "border-rose-500 bg-blush-50" : "border-blush-150 hover:border-blush-300"
                      }`}
                    >
                      <span className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-ink">
                        {a.label || a.name}
                        {a.is_default && (
                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700">
                            Default
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-cocoa">
                        {addressLine(a)}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="radio"
                  aria-checked={chosen === null}
                  onClick={pickNewAddress}
                  className={`rounded-2xl border-2 border-dashed p-3.5 text-left text-[12.5px] font-medium transition-colors ${
                    chosen === null ? "border-rose-500 bg-blush-50 text-ink" : "border-blush-200 text-cocoa hover:border-blush-300"
                  }`}
                >
                  + Use a different address
                  <span className="mt-0.5 block text-[11px] font-normal text-fog">
                    It will be saved to your account after you order.
                  </span>
                </button>
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("ship_name", "Full name", { required: true, autoComplete: "name" })}
              {field("ship_address1", "Address line 1", { required: true, autoComplete: "address-line1" })}
              {field("ship_address2", "Address line 2 (optional)", { autoComplete: "address-line2" })}
              {field("ship_city", "City", { required: true, autoComplete: "address-level2" })}
              {field("ship_state", "State", { required: true, autoComplete: "address-level1" })}
              {field("ship_zip", "PIN code", { required: true, inputMode: "numeric", maxLength: 6, autoComplete: "postal-code" })}
              {field("ship_country", "Country", { required: true, autoComplete: "country-name" })}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-cocoa">
                  Delivery notes (optional)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={2}
                  className="input-base resize-none"
                />
              </div>
            </div>
          </section>

          <section className="card p-7">
            <h2 className="font-serif text-[1.25rem] text-ink">Payment</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pay.cod_enabled && (
                <button
                  type="button"
                  onClick={() => setPayment("cod")}
                  className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                    payment === "cod" ? "border-rose-500 bg-blush-50" : "border-blush-150 hover:border-blush-300"
                  }`}
                >
                  <p className="text-[13px] font-semibold text-ink">Cash on Delivery</p>
                  <p className="mt-1 text-[11.5px] text-fog">Pay in cash when your books arrive.</p>
                </button>
              )}
              {pay.razorpay_enabled && (
                <button
                  type="button"
                  onClick={() => setPayment("razorpay")}
                  className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                    payment === "razorpay"
                      ? "border-rose-500 bg-blush-50"
                      : "border-blush-150 hover:border-blush-300"
                  }`}
                >
                  <p className="text-[13px] font-semibold text-ink">Pay Online</p>
                  <p className="mt-1 text-[11.5px] text-fog">Secured by Razorpay.</p>
                  {/* The marks say which methods far faster than the sentence did. */}
                  <PaymentMarks methods={pay.methods} className="mt-2.5" />
                </button>
              )}
            </div>
            {payment === "razorpay" && (
              <p className="mt-3 rounded-xl bg-blush-50 px-4 py-3 text-[11.5px] text-cocoa">
                You&apos;ll finish the payment in the Razorpay window. The order is confirmed only
                once the payment succeeds.
              </p>
            )}
            {noPaymentMethod ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[11.5px] leading-relaxed text-amber-800">
                No payment method is available right now. Please contact us to place your order.
              </p>
            ) : (
              !pay.razorpay_enabled &&
              pay.cod_enabled && (
                <p className="mt-3 text-[11px] text-fog">
                  Online payment is not switched on yet — orders are cash on delivery for now.
                </p>
              )
            )}
          </section>
        </div>

        <aside className="card sticky top-6 p-6">
          <h2 className="font-serif text-[1.25rem] text-ink">Your Order</h2>
          <ul className="mt-4 space-y-2.5">
            {(cart?.items ?? []).map((item) => (
              <li key={item.id} className="flex justify-between text-[12.5px]">
                <span className="text-cocoa">
                  {item.product.name} <span className="text-fog">× {item.quantity}</span>
                </span>
                <span className="font-medium text-ink">{money(item.line_total)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              className="input-base flex-1 uppercase"
            />
            <button
              type="button"
              onClick={() => applyCoupon()}
              className="rounded-xl bg-maroon-800 px-4 text-[12px] text-white hover:bg-maroon-900"
            >
              Apply
            </button>
          </div>
          {couponMsg && (
            <p className={`mt-2 text-[11.5px] ${coupon ? "text-emerald-600" : "text-red-500"}`}>
              {couponMsg}
            </p>
          )}

          {/* Coupons the shop advertises (admin → Coupons → "Shown") — tap to
              apply without knowing the code. Hidden once one is applied.
              Collapsed on phones to save scroll; open in the sidebar (lg+). */}
          {!coupon && publicCoupons.length > 0 && (
            <div className="mt-3">
              {/* Phone/tablet: a tappable header that folds the offers away. */}
              <button
                type="button"
                onClick={() => setOffersOpen((o) => !o)}
                aria-expanded={offersOpen}
                className="flex w-full items-center gap-2 py-1 text-left lg:hidden"
              >
                <span className="text-[10px] font-semibold font-accent uppercase tracking-[0.14em] text-fog">
                  Available offers
                </span>
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-600">
                  {publicCoupons.length}
                </span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`ml-auto h-4 w-4 shrink-0 text-rose-500 transition-transform duration-300 ${offersOpen ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Desktop: a plain label — the offers below always show there. */}
              <p className="hidden text-[10px] font-semibold font-accent uppercase tracking-[0.14em] text-fog lg:block">
                Available offers
              </p>

              <div className={`space-y-2 ${offersOpen ? "mt-2 block" : "hidden"} lg:mt-2 lg:block`}>
              {publicCoupons.map((pc) => {
                const eligible = subtotal >= pc.min_order;
                const label =
                  pc.type === "percent" ? `${pc.value}% off` : `${money(pc.value)} off`;
                return (
                  <div
                    key={pc.code}
                    className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-rose-200 bg-blush-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-ink">
                        {pc.code} <span className="text-rose-600">· {label}</span>
                      </p>
                      <p className="text-[10.5px] text-fog">
                        {pc.min_order > 0
                          ? eligible
                            ? `On orders over ${money(pc.min_order)}`
                            : `Add ${money(pc.min_order - subtotal)} more to unlock`
                          : "On any order"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyCoupon(pc.code)}
                      disabled={!eligible}
                      className="shrink-0 rounded-full border border-rose-300 px-3 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:border-blush-200 disabled:text-fog disabled:hover:bg-transparent disabled:hover:text-fog"
                    >
                      Apply
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          <dl className="mt-4 space-y-2 text-[13px]">
            <div className="flex justify-between"><dt className="text-cocoa">Subtotal</dt><dd className="text-ink">{money(subtotal)}</dd></div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600"><dt>Discount</dt><dd>-{money(discount)}</dd></div>
            )}
            <div className="flex justify-between">
              <dt className="text-cocoa">Shipping</dt>
              <dd className="text-ink">
                {quoting ? (
                  <span className="text-fog">Checking…</span>
                ) : !shippingKnown ? (
                  <span className="text-fog">Enter PIN code</span>
                ) : shipping === 0 ? (
                  "Free"
                ) : (
                  money(shipping)
                )}
              </dd>
            </div>
            {/* Where the number came from — a live courier rate is worth saying. */}
            {quote?.source === "shiprocket" && (
              <p className="text-[11px] text-fog">
                {quote.courier ?? "Courier"}
                {quote.days ? ` · about ${quote.days} days` : ""}
              </p>
            )}
            {quote?.serviceable === false && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                No courier delivers to this PIN code yet. Try another address, or write to us and
                we will arrange it.
              </p>
            )}
            {/* Books are GST-exempt by default; the row only appears when a rate is set. */}
            {settings.tax_rate > 0 && (
              <div className="flex justify-between"><dt className="text-cocoa">{TAX_LABEL} ({Math.round(settings.tax_rate * 100)}%)</dt><dd className="text-ink">{money(tax)}</dd></div>
            )}
          </dl>
          <hr className="my-4 border-blush-100" />
          <div className="flex justify-between text-[15px] font-semibold text-ink">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <button
            type="submit"
            disabled={busy || !cart || cart.items.length === 0 || noPaymentMethod}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-[13.5px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
          >
            {busy ? <Spinner className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" strokeWidth={2.2} />}
            {busy ? "Placing Order..." : `Place Order · ${money(total)}`}
          </button>
          <p className="mt-3 text-center text-[10.5px] text-fog">
            Secure checkout · Returns on damaged or wrong books
          </p>
        </aside>
      </div>
    </form>
  );
}
