import type { ApiCart, ApiCartItem } from "@/types/api";

export type CartChange =
  | { kind: "update"; productId: number; quantity: number }
  | { kind: "remove"; productId: number };

export function parseQuantityInput(raw: string, max = 99): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const quantity = Number(text);
  return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= Math.min(max, 99) ? quantity : null;
}

export function calculateCart(items: readonly ApiCartItem[]): ApiCart {
  const calculated = items.map((item) => ({ ...item, subtotal: item.product.price * item.quantity }));
  return {
    items: calculated,
    totalQuantity: calculated.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: calculated.reduce((sum, item) => sum + item.subtotal, 0),
  };
}

export function applyCartChanges(cart: ApiCart | null, changes: readonly CartChange[]): ApiCart | null {
  if (!cart || changes.length === 0) return cart;
  let items = cart.items;
  for (const change of changes) {
    items = change.kind === "remove"
      ? items.filter((item) => item.product.id !== change.productId)
      : items.map((item) => item.product.id === change.productId ? { ...item, quantity: change.quantity } : item);
  }
  return calculateCart(items);
}
