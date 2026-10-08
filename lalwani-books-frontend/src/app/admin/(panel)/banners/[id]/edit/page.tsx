"use client";

import { BackLink } from "@/admin/components/BackLink";
import { use, useEffect, useState } from "react";
import { clientApi } from "@/admin/lib/api";
import { Spinner } from "@/admin/components/ui";
import { BannerForm, type BannerFormValues } from "../../form";

interface Row {
  id: number;
  image: string | null;
  /** Front, left, right — null where a slot is empty. */
  covers?: (string | null)[];
  title: string | null;
  subtitle: string | null;
  badge_text: string | null;
  description: string | null;
  button_text: string | null;
  button_url: string | null;
  is_active: boolean;
  show_text: boolean;
  sort_order: number;
}

export default function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [initial, setInitial] = useState<BannerFormValues | null>(null);
  const [covers, setCovers] = useState<(string | null)[]>([null, null, null]);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<{ data: Row }>(`/admin/banners/${id}`)
      .then(({ data: row }) => {
        setCovers(row.covers ?? [row.image, null, null]);
        setInitial({
          title: row.title ?? "",
          subtitle: row.subtitle ?? "",
          badge_text: row.badge_text ?? "",
          description: row.description ?? "",
          button_text: row.button_text ?? "",
          button_url: row.button_url ?? "",
          sort_order: row.sort_order != null ? String(row.sort_order) : "",
          is_active: row.is_active,
          show_text: row.show_text !== false,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this banner."));
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
        <BackLink href="/admin/banners" label="Back to banners" />
        <h1 className="mt-1 font-serif text-[1.6rem] text-ink">Edit Banner</h1>
      </div>

      <BannerForm initial={initial} bannerId={Number(id)} currentCovers={covers} />
    </div>
  );
}
