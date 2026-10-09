"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PixelMap, { type MapBlock } from "@/components/local/PixelMap";
import { MAP_VIEWS } from "@/lib/localMapData";

const NAMES: Record<string, string> = { "11": "서울", "28": "인천", "41110": "수원", "41130": "성남", "41460": "용인" };

/** 메인의 월드맵 입구 — 장식용 슬라임만 올린 전체 지도, 지역을 누르면 덕력지도로 들어간다 */
export default function WorldMapTeaser() {
  const router = useRouter();
  const view = MAP_VIEWS[""];
  const blocks: MapBlock[] = view.legend.map((code) => ({ code, name: NAMES[code] ?? code, count: null, pins: [null, null], sample: false, hint: "이웃" }));
  return <div className="pixel-panel grid items-center gap-6 overflow-hidden p-5 md:grid-cols-[1fr_1.3fr] md:p-8">
    <div>
      <p className="mb-3 font-pixel text-xs tracking-widest text-mint">▶ WORLD MAP · PIXEL LOCAL</p>
      <h2 className="text-2xl font-extrabold md:text-3xl">우리 동네에도<br />같은 덕후가 있을까?</h2>
      <p className="mt-3 text-sm leading-relaxed text-sub">픽셀 지도에서 동네를 탐험하고, 같은 취향 이웃의 아바타와 교환글을 만나 보세요.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/local" className="btn-lime inline-flex min-h-11 items-center px-5 py-2 text-sm font-extrabold">월드맵 열기</Link>
        <Link href="/local/trades" className="btn-pixel inline-flex min-h-11 items-center px-5 py-2 text-sm font-bold">동네 교환글</Link>
      </div>
    </div>
    <PixelMap view={view} blocks={blocks} selected={null} seedKey="home" label="PIXEL LOCAL 월드맵 미리보기" namesOnly
      onSelect={(code) => router.push(`/local?region=${encodeURIComponent(code)}`)} />
  </div>;
}
