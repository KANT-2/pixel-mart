import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import TradesBoard from "@/components/local/TradesBoard";
import { TradeNotice } from "@/components/local/TradeStates";
import { LocalSkeleton, localButton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "동네 거래·교환 | PIXEL MART" };
export default function TradesPage() {
  return <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-5"><div><p className="stage-kicker mb-3 font-pixel text-sm text-mint">TRADING POST</p><h1 className="text-3xl font-extrabold">동네 거래소</h1><p className="mt-3 text-sm text-sub">이웃이 내놓은 아이템을 둘러보고, 가진 아이템과 교환해 보세요. (연락처·결제 없는 시연용 거래소)</p></div><div className="flex flex-wrap gap-2"><Link href="/local/trades/mine" className={localButton}>내 글·매칭</Link><Link href="/local/trades/new" className="inline-flex min-h-11 items-center btn-lime px-5 py-3 text-sm font-bold text-lime-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">글쓰기</Link></div></header>
    <TradeNotice /><Suspense fallback={<LocalSkeleton />}><TradesBoard /></Suspense>
  </section>;
}
