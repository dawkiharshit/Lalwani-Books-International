"use client";

import { moneyExact } from "@/admin/lib/format";

export interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  order_number: string;
  order_date: string;
  status: string;
  payment_status: string;
  payment_method: string;
  place_of_supply: string;
  tax_type: "intra" | "inter";
  seller: {
    name: string;
    address: string;
    state: string;
    gstin: string;
    email: string;
    phone: string;
  };
  buyer: { name: string; email: string; phone: string; address: string[] };
  items: {
    name: string;
    /** Required on a GST invoice; null until it is set on the product. */
    hsn_code?: string | null;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
  totals: {
    subtotal: number;
    discount: number;
    coupon_code: string | null;
    shipping: number;
    taxable_value: number;
    tax_lines: { label: string; amount: number }[];
    tax: number;
    total: number;
    total_in_words: string;
  };
  notes: string;
}

/**
 * Print-ready tax invoice. There is no PDF library involved — the browser's
 * own "Print → Save as PDF" produces the file, and the print stylesheet in
 * globals.css strips the site chrome away.
 */
export function Invoice({ data }: { data: InvoiceData }) {
  const s = data.seller;
  const t = data.totals;

  return (
    <div className="invoice-sheet mx-auto w-full max-w-3xl rounded-[1.25rem] bg-white p-8 shadow-soft sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-blush-100 pb-6">
        <div>
          <p className="text-[10px] font-accent uppercase tracking-[0.3em] text-rose-500">Tax Invoice</p>
          <h1 className="mt-1 font-serif text-[1.7rem] leading-tight text-ink">{s.name}</h1>
          {s.address && (
            <p className="mt-1.5 whitespace-pre-line text-[11.5px] leading-relaxed text-cocoa">
              {s.address}
            </p>
          )}
          <p className="mt-1.5 text-[11.5px] text-cocoa">
            {s.phone}
            {s.phone && s.email && " · "}
            {s.email}
          </p>
          {s.gstin && (
            <p className="mt-1 text-[11.5px] text-ink">
              GSTIN: <span className="font-mono">{s.gstin}</span>
            </p>
          )}
        </div>

        <div className="text-right text-[11.5px] text-cocoa">
          <p>
            Invoice No.
            <br />
            <span className="font-mono text-[13px] text-ink">{data.invoice_number}</span>
          </p>
          <p className="mt-2">
            Invoice date
            <br />
            <span className="text-ink">{data.invoice_date}</span>
          </p>
          <p className="mt-2">
            Order
            <br />
            <span className="font-mono text-ink">{data.order_number}</span>
            <br />
            <span className="text-fog">{data.order_date}</span>
          </p>
        </div>
      </header>

      <section className="grid gap-6 border-b border-blush-100 py-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-accent uppercase tracking-[0.2em] text-fog">Billed to</p>
          <p className="mt-1.5 text-[13px] font-semibold text-ink">{data.buyer.name}</p>
          {data.buyer.address.map((line) => (
            <p key={line} className="text-[11.5px] leading-relaxed text-cocoa">
              {line}
            </p>
          ))}
          <p className="mt-1 text-[11.5px] text-cocoa">{data.buyer.phone}</p>
          <p className="text-[11.5px] text-cocoa">{data.buyer.email}</p>
        </div>

        <div className="sm:text-right">
          <p className="text-[10px] font-accent uppercase tracking-[0.2em] text-fog">Details</p>
          <p className="mt-1.5 text-[11.5px] text-cocoa">
            Place of supply: <span className="text-ink">{data.place_of_supply}</span>
          </p>
          <p className="text-[11.5px] text-cocoa">
            Payment: <span className="text-ink">{data.payment_method}</span>
          </p>
          <p className="text-[11.5px] text-cocoa">
            Status:{" "}
            <span className={data.payment_status === "paid" ? "text-emerald-600" : "text-ink"}>
              {data.payment_status === "paid" ? "Paid" : "Payment pending"}
            </span>
          </p>
          {/* Rule 46 wants this stated either way, not left to be inferred. */}
          <p className="text-[11.5px] text-cocoa">
            Reverse charge: <span className="text-ink">No</span>
          </p>
        </div>
      </section>

      {/* Fixed widths so the columns don't drift with each order's content, and
          the totals live in the same table so their labels and figures sit
          exactly under the Rate → Amount columns. */}
      <table className="w-full table-fixed border-collapse text-left text-[12px] tabular-nums">
        <colgroup>
          <col className="w-[44%]" />
          <col className="w-[14%]" />
          <col className="w-[16%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-blush-100 text-[10px] uppercase tracking-wide text-fog">
            <th className="py-2 pr-3 font-medium">Item</th>
            <th className="py-2 pr-3 font-medium">HSN</th>
            <th className="py-2 pr-3 text-right font-medium">Rate</th>
            <th className="py-2 pr-3 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={`${item.name}-${i}`} className="border-b border-blush-50">
              <td className="py-2.5 pr-3 text-ink">{item.name}</td>
              <td className="py-2.5 pr-3 font-mono text-[11px] text-cocoa">
                {item.hsn_code || "—"}
              </td>
              <td className="py-2.5 pr-3 text-right text-cocoa">{moneyExact(item.unit_price)}</td>
              <td className="py-2.5 pr-3 text-right text-cocoa">{item.quantity}</td>
              <td className="py-2.5 text-right text-ink">{moneyExact(item.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {/* Spacer between the items and the totals. */}
          <tr aria-hidden>
            <td colSpan={5} className="h-4" />
          </tr>
          <TotalRow label="Subtotal" value={moneyExact(t.subtotal)} />
          {t.discount > 0 && (
            <TotalRow
              label={`Discount${t.coupon_code ? ` (${t.coupon_code})` : ""}`}
              value={`-${moneyExact(t.discount)}`}
              valueClass="text-rose-600"
            />
          )}
          <TotalRow label="Shipping" value={t.shipping > 0 ? moneyExact(t.shipping) : "Free"} />
          <TotalRow label="Taxable value" value={moneyExact(t.taxable_value)} divider="border-blush-100" />
          {t.tax_lines.map((line) => (
            <TotalRow key={line.label} label={line.label} value={moneyExact(line.amount)} />
          ))}
          <TotalRow label="Total" value={moneyExact(t.total)} divider="border-blush-200" grand />
        </tfoot>
      </table>
    </div>
  );
}

/**
 * One totals line, spanning the Rate and Qty columns for its label and the
 * Amount column for its figure. The divider is drawn on the cells, not the
 * row, so it runs only across the totals block.
 */
function TotalRow({
  label,
  value,
  valueClass = "text-ink",
  divider,
  grand = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  divider?: string;
  grand?: boolean;
}) {
  const edge = divider ? `border-t ${divider}` : "";
  const pad = grand ? "py-2.5" : divider ? "pb-1 pt-2" : "py-1";
  const size = grand ? "font-serif text-[15px]" : "";
  return (
    <tr>
      <td colSpan={2} />
      <td colSpan={2} className={`${edge} ${pad} ${size} ${grand ? "text-ink" : "text-cocoa"}`}>
        {label}
      </td>
      <td className={`${edge} ${pad} ${size} text-right ${grand ? "text-ink" : valueClass}`}>
        {value}
      </td>
    </tr>
  );
}
