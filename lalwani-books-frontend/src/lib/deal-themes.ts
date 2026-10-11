/**
 * The colourways a Deals Of The Week panel can wear, picked per deal in
 * admin → Deals. Shared by the storefront panel and the admin preview, so the
 * swatch an admin picks is exactly what the shop shows. Classes are written
 * out in full because Tailwind only generates what it finds in the source.
 */
export const DEAL_THEMES = {
  // The keys are stored with each deal, so they stay as they were; the
  // colourways follow the navy logo (they used to be coral, pine, plum, ocean).
  coral: {
    label: "Sky blue",
    panel: "bg-[linear-gradient(120deg,#5b8fcf_0%,#4677b8_55%,#33609c_100%)]",
    blobA: "bg-[#c9d6e6]/50",
    blobB: "bg-[#042b52]/35",
    underline: "text-[#e8b04b]",
    timer: "bg-[#e8b04b] text-[#042b52]",
    button: "bg-white text-ink hover:bg-ink hover:text-white",
  },
  pine: {
    label: "Navy",
    panel: "bg-[linear-gradient(120deg,#0d4377_0%,#08365f_55%,#042b52_100%)]",
    blobA: "bg-[#e8b04b]/35",
    blobB: "bg-[#8db1dc]/25",
    underline: "text-[#e8b04b]",
    timer: "bg-[#e8b04b] text-[#042b52]",
    button: "bg-[#e8eef6] text-[#042b52] hover:bg-white",
  },
  plum: {
    label: "Steel blue",
    panel: "bg-[linear-gradient(120deg,#6a87a6_0%,#557290_55%,#425d78_100%)]",
    blobA: "bg-[#c9d6e6]/45",
    blobB: "bg-[#042b52]/40",
    underline: "text-[#e8b04b]",
    timer: "bg-[#e8b04b] text-[#042b52]",
    button: "bg-white text-ink hover:bg-ink hover:text-white",
  },
  ocean: {
    label: "Ocean blue",
    panel: "bg-[linear-gradient(120deg,#3797dc_0%,#2175c0_55%,#165a9c_100%)]",
    blobA: "bg-[#e8b04b]/40",
    blobB: "bg-[#0d3d70]/45",
    underline: "text-[#e8b04b]",
    timer: "bg-[#e8b04b] text-[#042b52]",
    button: "bg-white text-ink hover:bg-ink hover:text-white",
  },
} as const;

export type DealTheme = keyof typeof DEAL_THEMES;

/** A deal's colourway, the first (sky blue) for anything unknown. */
export function dealTheme(name: string | null | undefined) {
  return DEAL_THEMES[(name ?? "coral") as DealTheme] ?? DEAL_THEMES.coral;
}
