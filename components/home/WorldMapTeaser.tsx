"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import PixelMap, { type MapBlock } from "@/components/local/PixelMap";
import { useLocalResource } from "@/components/local/useLocalResource";
import { loadMapBlocks } from "@/lib/fandomMapData";
import { MAP_VIEWS } from "@/lib/localMapData";
import styles from "./WorldMapTeaser.module.css";

const NAMES: Record<string, string> = { "11": "서울", "28": "인천", "41110": "수원", "41130": "성남", "41460": "용인" };

/** 메인의 월드맵 입구 — 덕력지도와 같은 지도(캐릭터·지역 색·이름표·랜드마크), 지역이나 캐릭터를 누르면 덕력지도로 들어간다 */
interface WorldMapTeaserProps { embedded?: boolean }

export default function WorldMapTeaser({ embedded = false }: WorldMapTeaserProps) {
  const router = useRouter();
  const view = MAP_VIEWS[""];
  // 들어올 때마다 캐릭터 자리를 새로 섞는다 — 무작위 값은 렌더가 아니라 불러올 때 만든다 (메인은 미리 렌더되는 페이지)
  const load = useCallback(async (signal: AbortSignal) => ({
    visit: Math.random().toString(36).slice(2, 8),
    blocks: await loadMapBlocks("", view.legend, null, signal),
  }), [view.legend]);
  const data = useLocalResource(load);
  const blocks: MapBlock[] = view.legend.map((code) => {
    const row = data.data?.blocks.find((block) => block.code === code);
    return { code, name: NAMES[code] ?? code, tag: row?.topInterest ?? undefined, count: row?.count ?? null, pins: (row?.pins ?? []).slice(0, 3),
      sample: row?.sample ?? false, ranked: row?.ranked ?? false, hint: "이웃" };
  });
  const open = (code: string) => router.push(`/local?region=${encodeURIComponent(code)}`);
  // 메인 배너 안에서는 다른 배너와 같은 격자(글자 · 30rem 그림)와 같은 제목 글꼴
  return <div className={`${embedded ? "md:grid-cols-2 md:gap-6" : "pixel-panel p-5 md:grid-cols-[1fr_1.3fr] md:p-8"} grid items-center gap-6 overflow-hidden`}>
    <div>
      <p className="mb-4 font-pixel text-xs tracking-widest text-mint">WORLD MAP · PIXEL LOCAL</p>
      <h2 className={embedded ? "font-pixel text-3xl font-bold leading-tight md:text-4xl" : "text-2xl font-extrabold md:text-3xl"}>우리 동네에도<br /><span className={embedded ? "text-mint" : ""}>같은 덕후가 있을까?</span></h2>
      <p className="mt-3 text-sm leading-relaxed text-sub">픽셀 지도에서 동네를 탐험하고, 같은 취향 이웃의 아바타와 교환글을 만나 보세요.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/local" className="btn-lime inline-flex min-h-11 items-center px-5 py-2 text-sm font-extrabold">월드맵 열기</Link>
        <Link href="/local/trades" className="btn-pixel inline-flex min-h-11 items-center px-5 py-2 text-sm font-bold">동네 교환글</Link>
      </div>
    </div>
    <div className={embedded ? styles.mapBg : "min-w-0"}>
    <PixelMap view={view} blocks={blocks} selected={null} seedKey={`home:${data.data?.visit ?? ""}`} label="PIXEL LOCAL 월드맵 미리보기" hideLabels pinScale={1.2} heat landmarks
        onSelect={open} onPinSelect={(code) => open(code)} />
    </div>
  </div>;
}
