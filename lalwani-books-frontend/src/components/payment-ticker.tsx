import type { ReactNode } from "react";

/**
 * The payment methods the shop accepts, drawn as their own marks and carried
 * past on a never-stopping rail.
 *
 * This is the one source of truth for the marks — the carded block in
 * PaymentMethods.tsx pulls them from here too, so the two can never drift.
 *
 * The rail is pure CSS (see `.pay-ticker` in globals.css): it scrolls the same
 * way on a phone and a desktop, and keeps moving even where a JS loop cannot
 * measure a hidden pane.
 */

function Chip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span
      title={label}
      className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-blush-200 bg-white px-2.5"
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex items-center gap-1">
        {children}
      </span>
    </span>
  );
}

/* Two chevrons, orange over green — the UPI mark. */
const Upi = () => (
  <>
    <svg viewBox="0 0 30 20" className="h-3.5 w-[1.3rem]">
      <path d="M1 1h8l8 9-8 9H1l8-9z" fill="#F58220" />
      <path d="M12 1h8l8 9-8 9h-8l8-9z" fill="#0DA84E" />
    </svg>
    <span className="text-[9.5px] font-bold tracking-tight text-[#1B2A5B]">UPI</span>
  </>
);

/*
 * Google Pay and PhonePe marks used to sit here. They are UPI apps, not
 * methods Razorpay enables on their own, so the UPI chip already covers them
 * and showing all three implied a choice at checkout that never existed.
 */

const Paytm = () => (
  <span className="text-[11px] font-bold tracking-tight">
    <span className="text-[#00BAF2]">pay</span>
    <span className="text-[#012970]">tm</span>
  </span>
);

const Visa = () => (
  <span className="font-serif text-[12px] font-bold italic tracking-tight text-[#1A1F71]">
    VISA
  </span>
);

/* Mastercard — the interlocking discs. */
const Mastercard = () => (
  <svg viewBox="0 0 36 22" className="h-4 w-[1.65rem]">
    <circle cx="14" cy="11" r="9" fill="#EB001B" />
    <circle cx="22" cy="11" r="9" fill="#F79E1B" />
    <path d="M18 4.2a9 9 0 0 0 0 13.6 9 9 0 0 0 0-13.6z" fill="#FF5F00" />
  </svg>
);

const RuPay = () => (
  <span className="text-[11px] font-bold tracking-tight">
    <span className="text-[#E97730]">Ru</span>
    <span className="text-[#0C7C3E]">Pay</span>
  </span>
);

/* Netbanking — a bank front. */
const NetBanking = () => (
  <>
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="#4A5568" strokeWidth="1.5">
      <path d="M2.5 7.5 10 3.5l7.5 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8.5v6M8 8.5v6M12 8.5v6M15.5 8.5v6M2.5 15.5h15" strokeLinecap="round" />
    </svg>
    <span className="text-[9.5px] font-semibold tracking-tight text-[#4A5568]">Netbanking</span>
  </>
);

/* Cash on delivery — a rupee note. */
const Cod = () => (
  <>
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="#2E6B4F" strokeWidth="1.5">
      <rect x="1.75" y="5" width="16.5" height="10" rx="1.75" />
      <path d="M7.5 8h5M7.5 10h5M11.5 8c1 0 1.6.7 1.6 1.6 0 1-.7 1.6-1.9 1.6H8.4l3 2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className="text-[9.5px] font-semibold tracking-tight text-[#2E6B4F]">Cash</span>
  </>
);

interface Mark {
  label: string;
  node: ReactNode;
}

/** What /payments/config reports the gateway will actually accept. */
export interface EnabledMethods {
  upi?: boolean;
  netbanking?: boolean;
  wallets?: string[];
  card_networks?: string[];
}

/**
 * Shown when the gateway is on but the method lookup gave nothing — an older
 * API, or Razorpay unreachable. Deliberately the conservative set that every
 * Indian Razorpay account has: never a brand that has to be switched on.
 */
const FALLBACK_MARKS: Mark[] = [
  { label: "UPI", node: <Upi /> },
  { label: "Visa", node: <Visa /> },
  { label: "Mastercard", node: <Mastercard /> },
  { label: "Netbanking", node: <NetBanking /> },
];

/**
 * The marks for exactly what this account accepts.
 *
 * Previously a fixed list, which meant the shop advertised Paytm on an account
 * where that wallet was never switched on — a customer picking it would have
 * found nothing there.
 *
 * Google Pay and PhonePe are gone on purpose rather than because they are
 * unavailable: they are UPI *apps*, not methods Razorpay enables separately,
 * so the UPI mark already covers them. Showing all three implied a choice at
 * checkout that does not exist.
 */
export function onlineMarks(methods?: EnabledMethods | null): Mark[] {
  if (!methods || Object.keys(methods).length === 0) return FALLBACK_MARKS;

  const nets = methods.card_networks ?? [];
  const wallets = methods.wallets ?? [];
  const marks: Mark[] = [];

  if (methods.upi) marks.push({ label: "UPI", node: <Upi /> });
  if (nets.includes("VISA")) marks.push({ label: "Visa", node: <Visa /> });
  if (nets.includes("MC")) marks.push({ label: "Mastercard", node: <Mastercard /> });
  if (nets.includes("RUPAY")) marks.push({ label: "RuPay", node: <RuPay /> });
  if (methods.netbanking) marks.push({ label: "Netbanking", node: <NetBanking /> });
  // The one wallet we have a mark for; appears only if it is really enabled.
  if (wallets.includes("paytm")) marks.push({ label: "Paytm", node: <Paytm /> });

  return marks.length ? marks : FALLBACK_MARKS;
}

const COD_MARK: Mark = { label: "Cash on delivery", node: <Cod /> };

function Row({ marks, hidden = false }: { marks: Mark[]; hidden?: boolean }) {
  // A trailing gap on the row keeps the space even where copy A meets copy B.
  return (
    <span className="flex items-center gap-2 pr-2" aria-hidden={hidden || undefined}>
      {marks.map((m, i) => (
        <Chip key={`${m.label}-${i}`} label={m.label}>
          {m.node}
        </Chip>
      ))}
    </span>
  );
}

/**
 * The rail itself. Two or more marks stream past on the CSS loop; a single
 * mark has nothing to scroll, so it just sits centred.
 */
function Strip({ marks, className = "" }: { marks: Mark[]; className?: string }) {
  if (marks.length < 2) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        {marks.map((m) => (
          <Chip key={m.label} label={m.label}>
            {m.node}
          </Chip>
        ))}
      </div>
    );
  }

  // ~2.4s per mark keeps the pace even however many there are.
  const duration = `${(marks.length * 2.4).toFixed(1)}s`;

  return (
    <div className={`pay-ticker overflow-hidden ${className}`}>
      <div className="pay-ticker__track" style={{ animationDuration: duration }}>
        <Row marks={marks} />
        <Row marks={marks} hidden />
      </div>
    </div>
  );
}

/**
 * Accepted-payment marks on the autoscrolling rail. With `online` off the shop
 * can only take cash, so a lone Cash chip shows; with it on, the full set —
 * UPI, cards, netbanking and cash — streams past.
 */
export function PaymentTicker({
  online,
  methods,
  className = "",
}: {
  online: boolean;
  methods?: EnabledMethods | null;
  className?: string;
}) {
  const marks = online ? [...onlineMarks(methods), COD_MARK] : [COD_MARK];
  return <Strip marks={marks} className={className} />;
}

/** Just the online marks, streaming past — for the Pay Online choice at checkout. */
export function CheckoutMarks({
  methods,
  className = "",
}: {
  methods?: EnabledMethods | null;
  className?: string;
}) {
  return <Strip marks={onlineMarks(methods)} className={className} />;
}
