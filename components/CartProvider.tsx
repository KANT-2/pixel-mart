"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createCartStore } from "@/lib/cart";
import type { ApiCart } from "@/types/api";

interface CartContextValue {
  cart: ApiCart | null;
  loading: boolean;
  error: string | null;
  pendingIds: readonly number[];
  add: (productId: number, quantity: number) => Promise<void>;
  update: (productId: number, quantity: number) => Promise<void>;
  remove: (productId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

interface CartProviderProps { children: React.ReactNode; }

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: CartProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const userId = authLoading ? null : user?.id ?? null;
  // 사용자별 저장소를 분리해 로그아웃 뒤 도착한 응답이 새 상태를 덮지 않게 합니다.
  const store = useMemo(() => createCartStore(userId !== null), [userId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);

  return <CartContext.Provider value={{ ...snapshot, loading: authLoading || snapshot.loading,
    add: store.add, update: store.update, remove: store.remove, refresh: store.refresh }}>
    {children}
  </CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart는 CartProvider 안에서만 사용할 수 있습니다.");
  }
  return context;
}
