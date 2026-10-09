import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import FandomExplorer from "@/components/local/FandomExplorer";
import { LocalSkeleton, localButton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "PIXEL LOCAL · 덕력지도 | PIXEL MART" };

export default function LocalPage() {
  return <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-2xl"><p className="mb-3 font-pixel text-sm text-mint">PIXEL LOCAL</p>
        <h1 className="text-3xl font-extrabold sm:text-4xl">우리 동네 덕력지도</h1>
        <p className="mt-4 text-sm leading-relaxed text-sub">내 주변에도 나와 같은 것을 좋아하는 사람이 있을까?<br />같은 지역 안에 존재하는 취향을 발견해 보세요.</p>
      </div>
      <Link href="/local/settings" className={localButton}>내 동네·취향 설정 →</Link>
    </header>
    <Suspense fallback={<LocalSkeleton />}><FandomExplorer /></Suspense>
  </section>;
}
