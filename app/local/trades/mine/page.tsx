import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import MyTrades from "@/components/local/MyTrades";
import { TradeNotice } from "@/components/local/TradeStates";
import { LocalSkeleton, localButton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "내 글·이웃 매칭 | PIXEL MART" };
export default function MyTradesPage() {
  return <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14"><header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="stage-kicker mb-3 font-pixel text-sm text-mint">MY TRADES & MATCH</p><h1 className="text-3xl font-extrabold">내 글·이웃 매칭</h1></div><div className="flex flex-wrap gap-2"><Link href="/local/trades" className={localButton}>게시판</Link><Link href="/local/trades/new" className={localButton}>글쓰기</Link></div></header>
    <TradeNotice /><Suspense fallback={<LocalSkeleton />}><MyTrades /></Suspense>
  </section>;
}
