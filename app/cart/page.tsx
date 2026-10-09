import type { Metadata } from "next";
import CartContents from "@/components/cart/CartContents";

export const metadata: Metadata = { title: "장바구니 | PIXEL MART" };

export default function CartPage() {
  return <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <div className="mb-8">
      <p className="stage-kicker mb-2 font-pixel text-sm text-mint">YOUR INVENTORY</p>
      <h1 className="text-3xl font-extrabold md:text-4xl">장바구니</h1>
      <p className="mt-3 text-sm text-sub">마음에 드는 아이템을 한곳에 모아 보세요.</p>
    </div>
    <CartContents />
  </section>;
}
