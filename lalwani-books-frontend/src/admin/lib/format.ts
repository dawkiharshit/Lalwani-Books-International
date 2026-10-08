/**
 * Store currency. Kept in sync with the backend (config/shop.php) — the API
 * echoes these under /settings so both sides format money identically.
 */
export const CURRENCY = "₹";
export const CURRENCY_LOCALE = "en-IN";
export const CURRENCY_DECIMALS = 0;
export const TAX_LABEL = "GST";

/** ₹1,23,456 — Indian digit grouping via the en-IN locale. */
export function money(value: number): string {
  return (
    CURRENCY +
    Number(value).toLocaleString(CURRENCY_LOCALE, {
      minimumFractionDigits: CURRENCY_DECIMALS,
      maximumFractionDigits: CURRENCY_DECIMALS,
    })
  );
}

/**
 * ₹1,23,456.78 — always to the paisa.
 *
 * For invoices only. Rounding to whole rupees there put the figures out of
 * step with the amount in words, which is printed exactly: a ₹4,482.82 total
 * read "₹4,483" beside "…Eighty Two Rupees and Eighty Two Paise".
 */
export function moneyExact(value: number): string {
  return (
    CURRENCY +
    Number(value).toLocaleString(CURRENCY_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gold/15 text-gold",
  processing: "bg-rose-100 text-rose-700",
  shipped: "bg-blush-150 text-maroon-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};
