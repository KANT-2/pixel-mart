"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import QuantityInput from "@/components/QuantityInput";
import type { ApiCartItem } from "@/types/api";
import { formatPrice } from "@/utils/formatPrice";

interface CartItemRowProps {
  item: ApiCartItem;
  disabled?: boolean;
}

export default function CartItemRow({ item, disabled = false }: CartItemRowProps) {
  const { update, remove, pendingIds } = useCart();
  const [deleting, setDeleting] = useState(false);
  const { product } = item;

  async function removeItem() {
    setDeleting(true);
    try { await remove(product.id); } catch { /* Provider가 서버 메시지와 되돌린 상태를 표시합니다. */ }
    finally { setDeleting(false); }
  }

  return <li className="pixel-panel p-4 md:p-5">
    <article aria-label={`${product.name} 장바구니 상품`}>
      <div className="flex gap-4">
        <Link href={`/products/${product.id}`} className="w-20 shrink-0 self-start overflow-hidden btn-pixel sm:w-24" aria-label={`${product.name} 상세 보기`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 상품 API 이미지 주소를 최적화 설정 없이 표시합니다. */}
          <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-dim">{product.category}</p>
          <Link href={`/products/${product.id}`} className="font-bold leading-snug hover:text-mint">{product.name}</Link>
          <Link href={`/products/${product.id}`} className="mt-2 block text-sm font-semibold text-sub">단가 {formatPrice(product.price)}</Link>
        </div>
        <button type="button" aria-label={`${product.name} 삭제`} disabled={disabled || deleting} onClick={() => { void removeItem(); }}
          className="self-start rounded-lg px-2 py-1 text-sm text-dim hover:bg-panel-2 hover:text-pink disabled:opacity-50">{deleting ? "삭제 중" : "삭제"}</button>
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
        <QuantityInput label={`${product.name} 수량`} value={item.quantity} disabled={disabled || deleting}
          onChange={(quantity) => { void update(product.id, quantity).catch(() => undefined); }} />
        <div className="ml-auto text-right">
          <p className="mb-1 text-xs text-dim">소계</p>
          <p className="text-lg font-extrabold text-ink">{formatPrice(item.subtotal)}</p>
          <p className="mt-1 min-h-4 text-xs text-dim">{pendingIds.includes(product.id) ? "저장 중…" : ""}</p>
        </div>
      </div>
    </article>
  </li>;
}
