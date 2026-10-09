"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import QuantityInput from "@/components/QuantityInput";
import { safeNextPath } from "@/utils/safeNextPath";

interface AddToCartButtonProps {
  productId: number;
}

export default function AddToCartButton({ productId }: AddToCartButtonProps) {
  const { cart, add, refresh, loading: cartLoading, error: cartError } = useCart();
  const { user, loading: authLoading, pending: authPending } = useAuth();
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [quantityValid, setQuantityValid] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const currentQuantity = cart?.items.find((item) => item.product.id === productId)?.quantity ?? 0;
  const remaining = 99 - currentQuantity;
  const quantity = Math.max(1, Math.min(selectedQuantity, remaining));
  const unavailable = Boolean(user && (!cart || cartLoading));
  const disabled = authLoading || authPending || adding || unavailable || remaining <= 0 || !quantityValid;

  async function handleClick() {
    if (disabled) return;
    if (!user) {
      const next = safeNextPath(window.location.pathname + window.location.search + window.location.hash);
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setAdding(true);
    setError(null);
    setAdded(false);
    try {
      await add(productId, quantity);
      setAdded(true);
      setSelectedQuantity(1);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "장바구니에 담지 못했어요. 다시 시도해 주세요.");
    } finally { setAdding(false); }
  }

  return <div className="min-w-0 flex-1">
    {remaining > 0 && <div className="mb-4 flex flex-wrap items-end gap-3">
      <QuantityInput label="담을 수량" value={quantity} max={remaining} disabled={authLoading || authPending || adding || unavailable}
        onValidityChange={setQuantityValid}
        onChange={(nextQuantity) => { setSelectedQuantity(nextQuantity); setAdded(false); setError(null); }} />
      {currentQuantity > 0 && <p className="pb-2 text-xs text-dim">이미 {currentQuantity}개 담았어요 · {remaining}개 더 담을 수 있어요</p>}
    </div>}
    <button type="button" onClick={() => { void handleClick(); }} disabled={disabled}
      className="w-full rounded-lg bg-lime px-6 py-4 font-extrabold text-lime-ink shadow-lg shadow-lime/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
      {adding ? "담는 중…" : "장바구니 담기"}
    </button>
    {remaining <= 0 && <p role="status" className="mt-3 text-sm text-sub">최대 수량을 담았어요</p>}
    {user && !cart && cartError && <div role="alert" className="mt-3 text-sm text-pink"><p>{cartError}</p><button type="button" disabled={cartLoading} onClick={() => { void refresh().catch(() => undefined); }} className="mt-2 font-semibold underline underline-offset-4">장바구니 다시 확인</button></div>}
    {error && <p role="alert" className="mt-3 text-sm text-pink">{error}</p>}
    {added && <p role="status" className="mt-3 text-sm text-mint">담았어요 · <Link href="/cart" className="font-bold underline underline-offset-4">장바구니 보기</Link></p>}
  </div>;
}
