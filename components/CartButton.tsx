"use client";

import { useCart } from "@/components/CartProvider";

// 헤더의 장바구니 아이콘 + 담은 개수 뱃지
export default function CartButton() {
  const { count } = useCart();

  return (
    <button
      type="button"
      aria-label={count > 0 ? `장바구니, ${count}개 담김` : "장바구니"}
      className="relative grid size-10 place-items-center rounded-lg border border-line bg-white/5 transition-colors hover:border-violet/40"
    >
      <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
        <circle cx="9.5" cy="20" r="1.2" />
        <circle cx="17" cy="20" r="1.2" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 min-w-5 rounded bg-lime px-1 text-center font-pixel text-xs leading-5 text-lime-ink">
          {count}
        </span>
      )}
    </button>
  );
}
