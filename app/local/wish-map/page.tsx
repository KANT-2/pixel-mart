import type { Metadata } from "next";
import { Suspense } from "react";
import WishMap from "@/components/local/WishMap";
import { LocalSkeleton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "위시맵 | PIXEL MART" };
export default function WishMapPage() {
  return <section className="mx-auto max-w-6xl px-4 pb-10 pt-3 md:px-8 md:pt-4">
    <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="stage-kicker font-pixel text-sm text-mint">LOCAL WISH MAP</p>
      <h1 className="text-xl font-extrabold">동네 이웃이 갖고 싶은 아이템</h1>
    </header>
    <Suspense fallback={<LocalSkeleton />}><WishMap /></Suspense>
  </section>;
}
