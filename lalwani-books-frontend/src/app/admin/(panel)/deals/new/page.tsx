"use client";

import { BackLink } from "@/admin/components/BackLink";
import { DealForm, EMPTY_DEAL } from "../form";

export default function NewDealPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <BackLink href="/admin/deals" label="Back to deals" />
        <h1 className="mt-1 font-serif text-[1.6rem] text-ink">New Deal</h1>
        <p className="mt-1 text-[12px] text-fog">Two or more live deals slide one after another every five seconds on the home page.</p>
      </div>

      <DealForm initial={EMPTY_DEAL} />
    </div>
  );
}
