"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clientApi } from "@/lib/api";
import type { Cart } from "@/lib/types";
import { useAuth } from "./AuthContext";

interface CartState {
  cart: Cart | null;
  count: number;
  busy: boolean;
  addItem: (productId: number, quantity?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  lastAdded: string | null;
  /** The slide-in cart drawer — opened when something is added. */
  drawerOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { token, ready } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openCart = useCallback(() => setDrawerOpen(true), []);
  const closeCart = useCallback(() => setDrawerOpen(false), []);

  const refresh = useCallback(async () => {
    try {
      const res = await clientApi<{ data: Cart }>("/cart");
      setCart(res.data);
    } catch {
      /* API offline - keep silent */
    }
  }, []);

  /*
   * Load the cart once auth settles, and again if the token changes (sign in,
   * sign out). The fetch is inlined rather than calling refresh() so the
   * setState plainly happens in a promise callback, and so the reply can be
   * dropped if the token changes again before it lands.
   */
  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    clientApi<{ data: Cart }>("/cart")
      .then((res) => {
        if (!cancelled) setCart(res.data);
      })
      .catch(() => {
        /* API offline - keep silent */
      });

    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  const run = useCallback(
    async (fn: () => Promise<{ data: Cart }>) => {
      setBusy(true);
      try {
        const res = await fn();
        setCart(res.data);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const addItem = useCallback(
    async (productId: number, quantity = 1) => {
      await run(() =>
        clientApi<{ data: Cart }>("/cart/items", {
          method: "POST",
          body: { product_id: productId, quantity },
        })
      );
      setLastAdded(`${productId}-${Date.now()}`);
    },
    [run]
  );

  const updateItem = useCallback(
    (itemId: number, quantity: number) =>
      run(() =>
        clientApi<{ data: Cart }>(`/cart/items/${itemId}`, {
          method: "PUT",
          body: { quantity },
        })
      ),
    [run]
  );

  const removeItem = useCallback(
    (itemId: number) =>
      run(() => clientApi<{ data: Cart }>(`/cart/items/${itemId}`, { method: "DELETE" })),
    [run]
  );

  const clear = useCallback(
    () => run(() => clientApi<{ data: Cart }>("/cart", { method: "DELETE" })),
    [run]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        count: cart?.items_count ?? 0,
        busy,
        addItem,
        updateItem,
        removeItem,
        clear,
        refresh,
        lastAdded,
        drawerOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
