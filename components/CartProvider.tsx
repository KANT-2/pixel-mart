"use client";

import { createContext, useCallback, useContext, useState } from "react";

// 도전 과제 B: 장바구니 담기 개수를 앱 전체에서 공유하는 전역 상태
interface CartContextValue {
  count: number;
  addToCart: () => void;
  resetCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const addToCart = () => setCount((prev) => prev + 1);
  const resetCart = useCallback(() => setCount(0), []);

  return <CartContext.Provider value={{ count, addToCart, resetCart }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart는 CartProvider 안에서만 사용할 수 있습니다.");
  }
  return context;
}
