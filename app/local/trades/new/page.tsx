import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import TradeForm from "@/components/local/TradeForm";
import { TradeNotice } from "@/components/local/TradeStates";
import { LocalSkeleton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "거래·교환 글쓰기 | PIXEL MART" };
export default function NewTradePage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14"><header className="mb-6"><Link href="/local/trades" className="mb-5 inline-block min-h-11 py-2 text-sm text-sub">← 거래·교환 게시판</Link><p className="stage-kicker mb-3 font-pixel text-sm text-mint">SHARE YOUR ITEM</p><h1 className="text-3xl font-extrabold">거래·교환 글쓰기</h1></header>
    <TradeNotice /><Suspense fallback={<LocalSkeleton />}><TradeForm /></Suspense>
  </section>;
}
