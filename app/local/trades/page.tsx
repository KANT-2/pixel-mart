import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import TradesBoard from "@/components/local/TradesBoard";
import LocalPageHeader from "@/components/local/LocalPageHeader";
import { LocalSkeleton, localButton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "동네 거래·교환 | PIXEL MART" };
export default function TradesPage() {
  return <section className="mx-auto max-w-6xl px-4 pb-10 pt-4 md:px-8">
    <LocalPageHeader kicker="TRADING POST" title="거래·교환" description="이웃이 내놓은 아이템을 둘러보고 가진 아이템과 바꿔 보세요. 연락처·정확한 장소는 적을 수 없어요."
      actions={<><Link href="/local/trades/mine" className={localButton}>내 글·매칭</Link><Link href="/local/trades/new" className="btn-lime inline-flex min-h-11 items-center px-5 text-sm font-bold">글쓰기</Link></>} />
    <Suspense fallback={<LocalSkeleton />}><TradesBoard /></Suspense>
  </section>;
}
