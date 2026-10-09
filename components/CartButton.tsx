"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";

export default function CartButton() {
  const { cart } = useCart();
  const { loading } = useAuth();
  const quantity = cart?.totalQuantity ?? 0;

  return <Link href="/cart"
    aria-label={loading ? "장바구니" : `장바구니, ${quantity}개 담김`}
    className="relative grid size-10 shrink-0 place-items-center btn-pixel transition-colors hover:border-violet/40">
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
      <circle cx="9.5" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" />
    </svg>
    {!loading && quantity > 0 && <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-5 rounded bg-lime px-1 text-center font-pixel text-xs leading-5 text-lime-ink">
      {quantity > 99 ? "99+" : quantity}
    </span>}
  </Link>;
}
