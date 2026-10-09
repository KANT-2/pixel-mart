import type { Metadata } from "next";
import { Suspense } from "react";
import GiftCheckout from "@/components/local/GiftCheckout";

export const metadata: Metadata = { title: "이웃에게 선물하기 | PIXEL MART" };

export default function GiftPage() {
  return <section className="mx-auto max-w-5xl px-4 py-10 md:px-8">
    <p className="stage-kicker mb-3 font-pixel text-sm text-mint">SEND A GIFT</p>
    <h1 className="text-3xl font-extrabold">이웃에게 선물하기</h1>
    <p className="mb-8 mt-3 text-sm text-sub">구하던 아이템을 이웃에게 선물해 보세요. 이웃이 받기를 누르면 자기 주소로 배송돼요.</p>
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-96 animate-pulse rounded-md bg-panel" />}><GiftCheckout /></Suspense>
  </section>;
}
