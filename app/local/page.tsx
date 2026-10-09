import type { Metadata } from "next";
import { Suspense } from "react";
import FandomMapScreen from "@/components/local/FandomMapScreen";

export const metadata: Metadata = { title: "PIXEL LOCAL · 덕력지도 | PIXEL MART" };

function MapSkeleton() {
  return <div role="status" aria-label="덕력지도 불러오는 중" className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
    <div className="mb-3 h-11 animate-pulse rounded-lg bg-panel" />
    <div className="aspect-[4/3] max-h-[calc(100dvh-15rem)] animate-pulse rounded-2xl bg-panel" />
  </div>;
}

export default function LocalPage() {
  return <>
    <h1 className="sr-only">PIXEL LOCAL 덕력지도</h1>
    <Suspense fallback={<MapSkeleton />}><FandomMapScreen /></Suspense>
  </>;
}
