"use client";

import { useEffect, useState } from "react";
import { isWishlisted, subscribeWishlist, toggleWishlist } from "@/lib/wishlist";
import { HeartIcon, HeartSolid } from "./icons";

export function WishlistButton({
  productId,
  className = "h-9 w-9",
}: {
  productId: number;
  className?: string;
}) {
  const [inList, setInList] = useState(false);

  // Read after mount so server and first client render agree (localStorage
  // isn't available on the server), then follow any later change.
  useEffect(() => {
    const sync = () => setInList(isWishlisted(productId));
    sync();
    return subscribeWishlist(sync);
  }, [productId]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setInList(toggleWishlist(productId));
  }

  return (
    <button
      onClick={toggle}
      aria-label={inList ? "Remove from wishlist" : "Add to wishlist"}
      className={`flex items-center justify-center rounded-full border border-blush-200 bg-white text-cocoa transition-colors hover:text-rose-600 ${className}`}
    >
      {inList ? <HeartSolid className="h-4 w-4 text-rose-600" /> : <HeartIcon className="h-4 w-4" />}
    </button>
  );
}
