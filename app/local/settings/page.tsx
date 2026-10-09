import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import LocalSettings from "@/components/local/LocalSettingsForm";
import { LocalSkeleton } from "@/components/local/LocalStates";

export const metadata: Metadata = { title: "내 동네·취향 설정 | PIXEL MART" };

export default function LocalSettingsPage() {
  return <section className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
    <header className="mb-8">
      <Link href="/local" className="mb-6 inline-block min-h-11 py-2 text-sm text-sub hover:text-ink">← 덕력지도</Link>
      <p className="stage-kicker mb-3 font-pixel text-sm text-mint">MY LOCAL</p>
      <h1 className="text-3xl font-extrabold">내 동네·취향 설정</h1>
      <p className="mt-4 text-sm leading-relaxed text-sub">동네는 직접 고르고, 취향은 자유롭게 선택하세요.<br />정확한 위치나 주소를 수집하지 않아요.</p>
    </header>
    <Suspense fallback={<LocalSkeleton label="내 설정 불러오는 중" />}><LocalSettings /></Suspense>
  </section>;
}
