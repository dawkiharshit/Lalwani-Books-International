"use client";

import { BackLink } from "@/admin/components/BackLink";
import { BannerForm, EMPTY_BANNER } from "../form";

export default function NewBannerPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink href="/admin/banners" label="Back to banners" />
        <h1 className="mt-1 font-serif text-[1.6rem] text-ink">New Banner</h1>
        <p className="mt-1 text-[12px] text-fog">
          Two or more live banners turn the home hero into an auto-playing slider.
        </p>
      </div>

      <BannerForm initial={EMPTY_BANNER} />
    </div>
  );
}
