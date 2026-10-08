/**
 * The colourways a Deals Of The Week panel can wear, picked per deal in
 * admin → Deals. Shared by the storefront panel and the admin preview, so the
 * swatch an admin picks is exactly what the shop shows. Classes are written
 * out in full because Tailwind only generates what it finds in the source.
 */
export const DEAL_THEMES = {
  coral: {
    label: "Coral",
    panel: "bg-[linear-gradient(120deg,#f5a48a_0%,#ef8f72_55%,#e9775c_100%)]",
    blobA: "bg-[#9fd8c4]/70",
    blobB: "bg-[#c4552f]/45",
    underline: "text-[#c4382a]",
    timer: "bg-[#ffd44d] text-ink",
    button: "bg-white text-ink hover:bg-ink hover:text-white",
  },
  pine: {
    label: "Pine green",
    panel: "bg-[linear-gradient(120deg,#2b6355_0%,#1d4a40_55%,#12302a_100%)]",
    blobA: "bg-[#e8b04b]/35",
    blobB: "bg-[#f65d4e]/25",
    underline: "text-[#e8b04b]",
    timer: "bg-[#e8b04b] text-[#12302a]",
    button: "bg-[#efe6d6] text-[#12302a] hover:bg-white",
  },
  plum: {
    label: "Plum",
    panel: "bg-[linear-gradient(120deg,#8a6ddb_0%,#6c4fc6_55%,#5136a6_100%)]",
    blobA: "bg-[#ff9ec4]/45",
    blobB: "bg-[#3a2580]/45",
    underline: "text-[#ffd44d]",
    timer: "bg-[#ffd44d] text-ink",
    button: "bg-white text-ink hover:bg-ink hover:text-white",
  },
  ocean: {
    label: "Ocean blue",
    panel: "bg-[linear-gradient(120deg,#3797dc_0%,#2175c0_55%,#165a9c_100%)]",
    blobA: "bg-[#ffd44d]/40",
    blobB: "bg-[#0d3d70]/45",
    underline: "text-[#ffd44d]",
    timer: "bg-[#ffd44d] text-ink",
    button: "bg-white text-ink hover:bg-ink hover:text-white",
  },
} as const;

export type DealTheme = keyof typeof DEAL_THEMES;

/** A deal's colourway, coral for anything unknown. */
export function dealTheme(name: string | null | undefined) {
  return DEAL_THEMES[(name ?? "coral") as DealTheme] ?? DEAL_THEMES.coral;
}
