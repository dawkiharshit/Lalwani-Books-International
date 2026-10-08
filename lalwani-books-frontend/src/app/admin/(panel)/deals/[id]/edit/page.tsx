"use client";

import { BackLink } from "@/admin/components/BackLink";
import { use, useEffect, useState } from "react";
import { clientApi } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { DEAL_THEMES, type DealTheme } from "@/lib/deal-themes";
import { DealForm, toLocalInput, type DealFormValues } from "../../form";

interface Row {
  id: number;
  eyebrow: string | null;
  heading: string;
  highlight: string | null;
  description: string | null;
  ends_label: string | null;
  ends_at: string | null;
  button_text: string | null;
  button_url: string | null;
  category: { id: number } | null;
  theme: string;
  is_active: boolean;
  sort_order: number;
}

export default function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<DealFormValues | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: Row }>(`/admin/deals/${id}`)
      .then(({ data: row }) => {
        setInitial({
          eyebrow: row.eyebrow ?? "",
          heading: row.heading,
          highlight: row.highlight ?? "",
          description: row.description ?? "",
          ends_label: row.ends_label ?? "",
          ends_at: toLocalInput(row.ends_at),
          dated: row.ends_at !== null,
          button_text: row.button_text ?? "",
          button_url: row.button_url ?? "",
          category_id: row.category ? String(row.category.id) : "",
          theme: (row.theme in DEAL_THEMES ? row.theme : "coral") as DealTheme,
          sort_order: String(row.sort_order),
          is_active: row.is_active,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this deal."));
  }, [id]);

  if (error) return <p className="card px-6 py-5 text-[13px] text-red-600">{error}</p>;

  if (!initial)
    return (
      <div className="card flex items-center justify-center gap-2 py-20 text-fog">
        <Spinner className="h-5 w-5" /> Loading...
      </div>
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink href="/admin/deals" label="Back to deals" />
        <h1 className="mt-1 font-serif text-[1.6rem] text-ink">Edit Deal</h1>
      </div>

      <DealForm initial={initial} dealId={Number(id)} />
    </div>
  );
}
