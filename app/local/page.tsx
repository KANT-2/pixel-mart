import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import FandomMapScreen from "@/components/local/FandomMapScreen";
import LocalPageHeader from "@/components/local/LocalPageHeader";
import { localButton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "PIXEL LOCAL · 덕력지도 | PIXEL MART" };

function MapSkeleton() {
  return <div role="status" aria-label="덕력지도 불러오는 중">
    <div className="mb-3 h-14 animate-pulse rounded-lg bg-panel" />
    <div className="aspect-[4/3] max-h-[calc(100dvh-15rem)] animate-pulse rounded-2xl bg-panel" />
  </div>;
}

export default function LocalPage() {
  return <section className="mx-auto max-w-6xl px-4 pb-10 pt-4 md:px-8">
    <LocalPageHeader kicker="FANDOM MAP" title="덕력지도" description="우리 동네 이웃들이 좋아하는 캐릭터·작품을 지도에서 찾아보세요."
      actions={<Link href="/local/settings" className={localButton}>내 동네·취향 설정</Link>} />
    <Suspense fallback={<MapSkeleton />}><FandomMapScreen /></Suspense>
  </section>;
}
