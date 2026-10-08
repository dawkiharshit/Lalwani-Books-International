"use client";

import { PageBanner } from "@/components/PageBanner";
import { BackLink } from "@/components/BackLink";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/api";
import type { ProductCard as ProductCardType } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { PillLink } from "@/components/ui";
import { HeartIcon } from "@/components/icons";
import { getWishlist, subscribeWishlist } from "@/lib/wishlist";
import { PageLoader } from "@/components/loading/BookLoader";

export default function WishlistPage() {
  const [items, setItems] = useState<ProductCardType[] | null>(null);

  useEffect(() => {
    const load = () => {
      const ids = getWishlist();
      if (ids.length === 0) {
        setItems([]);
        return;
      }
      clientApi<{ data: ProductCardType[] }>(
        `/products?ids=${ids.join(",")}&per_page=48`,
        { token: null, cartToken: null }
      )
        .then((res) => {
          // Show them in the order they were saved.
          const byId = new Map(res.data.map((p) => [p.id, p]));
          setItems(ids.map((id) => byId.get(id)).filter((p): p is ProductCardType => Boolean(p)));
        })
        .catch(() => setItems([]));
    };
    load();
    // Re-load when a heart is toggled anywhere (including on this page).
    return subscribeWishlist(load);
  }, []);

  // The back link sits outside the loading branch: the wishlist is read from
  // localStorage after hydration, so the loading card is what a visitor sees
  // first, and it should not be a dead end.
  if (items === null) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/collection" label="Continue shopping" />
        <PageLoader label="Loading your wishlist…" className="card py-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageBanner title="Wishlist" crumbs={[{ label: "Wishlist" }]} />
      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="card flex flex-col items-center px-8 py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blush-100 text-rose-500">
            <HeartIcon className="h-7 w-7" />
          </span>
          <p className="mt-5 font-serif text-[1.5rem] text-ink">Nothing saved yet</p>
          <p className="mt-2 max-w-sm text-[13px] text-cocoa">
            Tap the heart on any product to keep it here for later — no account needed.
          </p>
          <div className="mt-6">
            <PillLink href="/collection" arrow>Browse Collection</PillLink>
          </div>
        </div>
      )}
    </div>
  );
}
