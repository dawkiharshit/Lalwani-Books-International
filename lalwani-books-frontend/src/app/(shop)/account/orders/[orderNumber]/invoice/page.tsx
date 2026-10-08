"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, clientApi } from "@/lib/api";
import { Invoice, type InvoiceData } from "@/components/Invoice";
import { PageLoader } from "@/components/loading/BookLoader";

export default function InvoicePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: InvoiceData }>(`/orders/${orderNumber}/invoice`)
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(
          err instanceof ApiError && err.status === 403
            ? "This invoice belongs to another account."
            : "Could not load this invoice."
        )
      );
  }, [orderNumber]);

  if (error) return <p className="card px-6 py-10 text-center text-[13px] text-red-600">{error}</p>;

  if (!data)
    return (
      <PageLoader label="Loading invoice…" className="card py-20" />
    );

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar is hidden by the print stylesheet */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/account/orders" className="text-[12.5px] text-rose-600 hover:underline">
          &larr; Back to orders
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-full bg-rose-600 px-6 py-2.5 text-[13px] text-white transition-colors hover:bg-rose-700"
        >
          Print / Save as PDF
        </button>
      </div>

      <Invoice data={data} />
    </div>
  );
}
