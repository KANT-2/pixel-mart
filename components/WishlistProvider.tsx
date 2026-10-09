"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createWishlistStore, type WishlistSnapshot } from "@/lib/wishlist";

interface WishlistContextValue extends WishlistSnapshot {
  toggle: (productId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

interface WishlistProviderProps { children: React.ReactNode; }

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: WishlistProviderProps) {
  const { user, loading } = useAuth();
  const userId = loading ? null : user?.id ?? null;
  // 아바타 변경은 유지하고, 계정이 바뀌면 이전 요청과 상태를 분리합니다.
  const store = useMemo(() => createWishlistStore(userId !== null), [userId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);

  return <WishlistContext.Provider value={{ ...snapshot, loading: loading || snapshot.loading,
    toggle: store.toggle, refresh: store.refresh }}>
    {children}
  </WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist는 WishlistProvider 안에서만 사용할 수 있습니다.");
  return context;
}
