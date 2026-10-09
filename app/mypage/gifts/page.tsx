import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import GiftInbox from "@/components/gifts/GiftInbox";

export const metadata: Metadata = { title: "선물함 | PIXEL MART" };

export default function GiftsPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8">
    <Link href="/mypage" className="text-sm text-sub hover:text-ink">← 마이페이지</Link>
    <p className="stage-kicker mb-3 mt-4 font-pixel text-sm text-mint">GIFT BOX</p>
    <h1 className="text-3xl font-extrabold">선물함</h1>
    <p className="mb-8 mt-3 text-sm text-sub">거래소에서 이웃과 주고받은 선물이에요. 서로 누구인지·주소는 공개되지 않아요.</p>
    <Suspense fallback={<div role="status" aria-label="불러오는 중" className="h-64 animate-pulse rounded-md bg-panel" />}><GiftInbox /></Suspense>
  </section>;
}
