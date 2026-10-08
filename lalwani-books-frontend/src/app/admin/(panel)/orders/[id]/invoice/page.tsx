"use client";

import { BackLink } from "@/admin/components/BackLink";
import { use, useEffect, useState } from "react";
import { ApiError, clientApi } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { Invoice, type InvoiceData } from "@/admin/components/Invoice";

export default function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: InvoiceData }>(`/admin/orders/${id}/invoice`)
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load this invoice.")
      );
  }, [id]);

  if (error) return <p className="card px-6 py-8 text-center text-[13px] text-red-600">{error}</p>;

  if (!data)
    return (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> Loading invoice…
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <BackLink href="/admin/orders" label="Back to orders" />
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
