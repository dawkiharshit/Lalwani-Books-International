import { money } from "@/lib/format";
import { TruckIcon, RefreshIcon, ShieldIcon } from "./icons";

/**
 * The delivery strip under the buy buttons.
 *
 * The reference design puts a PIN-code serviceability check here. This shows
 * the real shipping terms instead: /shipping/quote prices an existing cart, so
 * on a product page — before anything is in the bag — it cannot answer, and a
 * box that always said "enter a PIN" would be decoration pretending to be a
 * feature. Swap it in once the endpoint can quote a single product.
 */
export function DeliveryPromise({
  freeOver,
  flat,
  className = "",
}: {
  freeOver: number;
  flat: number;
  className?: string;
}) {
  const rows = [
    { icon: TruckIcon, text: `Free delivery over ${money(freeOver)} · flat ${money(flat)} below` },
    { icon: RefreshIcon, text: "Returns on damaged, misprinted or wrong books" },
    { icon: ShieldIcon, text: "Genuine editions, packed securely" },
  ];

  return (
    <ul className={`space-y-2 rounded-xl border border-blush-200 px-4 py-3.5 ${className}`}>
      {rows.map((r) => (
        <li key={r.text} className="flex items-center gap-2.5 text-[12px] text-cocoa">
          <r.icon className="h-4 w-4 shrink-0 text-rose-500" />
          {r.text}
        </li>
      ))}
    </ul>
  );
}
