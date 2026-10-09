import type { Metadata } from "next";
import { Suspense } from "react";
import WishMap from "@/components/local/WishMap";
import { LocalSkeleton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "동네 Wish Map | PIXEL MART" };
export default function WishMapPage() {
  return <section className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14"><header className="mb-8"><p className="stage-kicker mb-3 font-pixel text-sm text-mint">LOCAL WISH MAP</p><h1 className="text-3xl font-extrabold">우리 동네 인기 찜 TOP 10</h1><p className="mt-4 text-sm leading-relaxed text-sub">같은 동네에서 관심을 모으는 아이템을 발견해 보세요.<br />개인의 찜 목록 대신 익명 집계만 보여드려요.</p></header>
    <Suspense fallback={<LocalSkeleton />}><WishMap /></Suspense>
  </section>;
}
