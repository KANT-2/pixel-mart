import type { Metadata } from "next";
import Link from "next/link";
import CheckoutContents from "@/components/orders/CheckoutContents";

export const metadata: Metadata = { title: "주문하기 | PIXEL MART" };

export default function CheckoutPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8">
        <Link href="/cart" className="mb-6 inline-block text-sm text-sub hover:text-ink">← 장바구니</Link>
        <p className="stage-kicker mb-2 font-pixel text-sm text-mint">READY TO EQUIP</p>
        <h1 className="text-3xl font-extrabold">주문하기</h1>
        <p className="mt-3 text-sm text-sub">장바구니 전체를 주문합니다. 실제 결제와 배송은 이루어지지 않아요.</p>
      </header>
      <CheckoutContents />
    </section>
  );
}
