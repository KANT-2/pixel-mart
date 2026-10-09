import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import WishMap from "@/components/local/WishMap";
import LocalPageHeader from "@/components/local/LocalPageHeader";
import { LocalSkeleton, localButton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "위시맵 | PIXEL MART" };
export default function WishMapPage() {
  return <section className="mx-auto max-w-6xl px-4 pb-10 pt-4 md:px-8">
    <LocalPageHeader kicker="WISH MAP" title="위시맵" description="동네 이웃이 갖고 싶은 아이템을 지도에서 찾고, 선물해 보세요."
      actions={<Link href="/local/trades/new?kind=want" className={localButton}>내 WISH 올리기</Link>} />
    <Suspense fallback={<LocalSkeleton />}><WishMap /></Suspense>
  </section>;
}
