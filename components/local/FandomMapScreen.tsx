"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import PixelMap, { type MapBlock } from "@/components/local/PixelMap";
import { useLocalProfile, useRegions } from "@/components/local/LocalProvider";
import { useLocalResource } from "@/components/local/useLocalResource";
import { useRegionLocator } from "@/components/local/useRegionLocator";
import { LocalError, localButton, localInput } from "@/components/local/LocalStates";
import { loadMapBlocks } from "@/lib/fandomMapData";
import { localApi } from "@/lib/local";
import { MAP_VIEWS } from "@/lib/localMapData";
import { interestLabel, interestProductHref, localHref, localSettingsHref, parseLocalQuery } from "@/utils/local";
import { viewCodeFor, viewTrail } from "@/utils/localMap";
import type { ApiFandomRank, ApiInterest, ApiRegion } from "@/types/api";

const chip = "shrink-0 rounded-full border-2 px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";

export default function FandomMapScreen() {
  const params = useSearchParams();
  const query = parseLocalQuery(params);
  const regions = useRegions();
  const profile = useLocalProfile();
  const catalog = useMemo(() => regions.data ?? [], [regions.data]);
  // URL에 지역이 없으면 저장한 내 동네부터 보여 준다 (빈 값은 "전체"를 고른 상태)
  const focus = query.hasRegion ? query.region : profile.data?.region?.code ?? null;
  const viewCode = viewCodeFor(focus, catalog, MAP_VIEWS);
  const view = MAP_VIEWS[viewCode];
  const selected = focus && focus !== viewCode && view.legend.includes(focus) ? focus : null;
  const byCode = useMemo(() => new Map(catalog.map((region) => [region.code, region])), [catalog]);

  const go = useCallback((region: string | null, interest = query.interest) => {
    window.history.pushState(null, "", localHref(region, "all", interest));
  }, [query.interest]);

  const loadBlocks = useCallback((signal: AbortSignal) => loadMapBlocks(viewCode, view.legend, query.interest, signal), [viewCode, view.legend, query.interest]);
  const blocks = useLocalResource(loadBlocks);
  const loadInterests = useCallback((signal: AbortSignal) => localApi.interests("", undefined, signal), []);
  const interests = useLocalResource(loadInterests);
  const locator = useRegionLocator(catalog);

  const mapBlocks: MapBlock[] = view.legend.map((code) => {
    const data = blocks.data?.find((block) => block.code === code);
    const name = byCode.get(code)?.name ?? code;
    return { code, name, count: data?.count ?? null, pins: data?.pins ?? [], sample: data?.sample ?? false,
      hint: data?.real ? "지도 표시 이웃" : query.interest === null && data?.topInterest ? `${data.topInterest} 팬` : "같은 취향 이웃" };
  });

  const choose = (code: string) => {
    if (MAP_VIEWS[code]) go(code); // 시·구는 지도 안으로
    else go(selected === code ? viewCode || "" : code); // 생활권은 선택/해제
  };
  const trail = viewTrail(viewCode, catalog);
  const interestName = interests.data?.find((item) => item.id === query.interest)?.name;

  return <section className="mx-auto max-w-6xl px-4 pb-10 pt-3 md:px-8 md:pt-4">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <nav aria-label="지도 위치" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-pixel text-sm">
        <button type="button" onClick={() => go("")} className="rounded px-1.5 py-1 text-mint hover:bg-panel">전체</button>
        {trail.map((code) => <span key={code} className="flex items-center gap-1">
          <span aria-hidden="true" className="text-dim">›</span>
          <button type="button" onClick={() => go(code)} aria-current={code === viewCode ? "location" : undefined}
            className="rounded px-1.5 py-1 text-sub hover:bg-panel aria-[current=location]:text-ink">{byCode.get(code)?.name ?? code}</button>
        </span>)}
      </nav>
      <div className="flex w-full gap-2 sm:w-auto">
        <RegionSearch regions={catalog} onPick={go} />
        <button type="button" onClick={() => locator.locate((code) => go(code))} disabled={locator.busy || locator.denied || !catalog.length}
          aria-label="내 위치로 보기 — 누를 때만 위치 권한을 요청하고 좌표는 저장하지 않아요" className={`${localButton} shrink-0 gap-1.5`}>
          <span aria-hidden="true">◎</span><span className="hidden sm:inline">{locator.busy ? "찾는 중…" : "내 위치로 보기"}</span></button>
      </div>
    </div>
    {locator.message && <p role="status" className="mb-3 text-xs text-sub">{locator.message}</p>}

    <div role="group" aria-label="취향 필터" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      <button type="button" onClick={() => go(focus ?? "", null)} aria-pressed={query.interest === null}
        className={`${chip} border-line text-sub aria-pressed:border-lime aria-pressed:bg-lime aria-pressed:text-lime-ink`}>전체 · 동네 인기 취향</button>
      {(interests.data ?? []).map((item: ApiInterest, _, all) => {
        const duplicate = all.filter((other) => other.name === item.name).length > 1;
        return <button key={item.id} type="button" onClick={() => go(focus ?? "", item.id)} aria-pressed={query.interest === item.id}
          className={`${chip} border-line text-sub aria-pressed:border-lime aria-pressed:bg-lime aria-pressed:text-lime-ink`}>
          {duplicate ? interestLabel(item) : item.name}</button>;
      })}
    </div>

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="mx-auto w-full" style={{ maxWidth: `calc((100dvh - 15rem) * ${view.cols / view.rows})` }}>
        {blocks.error ? <LocalError message={blocks.error} onRetry={() => void blocks.refresh()} busy={blocks.loading} /> : (
          <PixelMap view={view} blocks={mapBlocks} selected={selected} seedKey={String(query.interest ?? "all")} onSelect={choose}
            label={`${trail.length ? byCode.get(viewCode)?.name : "서비스 지역 전체"} 픽셀 지도${blocks.loading ? " (불러오는 중)" : ""}`} />
        )}
        <p className="mt-2 text-xs leading-relaxed text-dim">
          지도의 캐릭터는 &lsquo;지도에 내 아바타 표시&rsquo;에 동의한 이웃의 아바타예요. 동의한 이웃이 5명 미만인 동네는 집계 인원만큼 기본 슬라임으로 채우며, 위치는 동네 안에서 무작위로 놓인 장식이에요.
          {mapBlocks.some((block) => block.sample) && <> <span className="text-violet">*</span> 샘플 데이터</>}
        </p>
      </div>
      <PlacePanel code={selected ?? (viewCode || null)} region={byCode.get(selected ?? viewCode) ?? null}
        block={mapBlocks.find((block) => block.code === selected) ?? null} interestName={interestName} interest={query.interest}
        hasChildren={!selected && Boolean(viewCode)} />
    </div>
  </section>;
}

interface RegionSearchProps { regions: ApiRegion[]; onPick: (code: string) => void; }

function RegionSearch({ regions, onPick }: RegionSearchProps) {
  const [text, setText] = useState("");
  const keyword = text.trim();
  const matches = keyword ? regions.filter((region) => region.fullName.includes(keyword)).slice(0, 6) : [];
  const pick = (code: string) => { onPick(code); setText(""); };
  return <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
    <label htmlFor="region-search" className="sr-only">동네 검색</label>
    <input id="region-search" value={text} onChange={(event) => setText(event.target.value.slice(0, 20))} placeholder="동네 검색 (예: 판교)"
      autoComplete="off" role="combobox" aria-expanded={matches.length > 0} aria-controls="region-search-list"
      onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) { event.preventDefault(); pick(matches[0].code); } if (event.key === "Escape") setText(""); }}
      className={localInput} />
    {matches.length > 0 && <ul id="region-search-list" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-panel shadow-xl">
      {matches.map((region) => <li key={region.code} role="option" aria-selected={false}>
        <button type="button" onClick={() => pick(region.code)} className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2">{region.fullName}</button>
      </li>)}
    </ul>}
  </div>;
}

interface PlacePanelProps {
  code: string | null;
  region: ApiRegion | null;
  block: MapBlock | null;
  interest: number | null;
  interestName?: string;
  hasChildren: boolean;
}

function PlacePanel({ code, region, block, interest, interestName, hasChildren }: PlacePanelProps) {
  const loadRanking = useCallback((signal: AbortSignal) => code ? localApi.ranking(code, "all", signal) : Promise.resolve([] as ApiFandomRank[]), [code]);
  const ranking = useLocalResource(loadRanking);
  if (!code || !region) {
    return <aside className="rounded-xl border-2 border-line bg-panel p-5">
      <p className="font-pixel text-xs text-mint">PIXEL LOCAL</p>
      <h2 className="mt-2 text-lg font-extrabold">어느 동네로 가 볼까요?</h2>
      <p className="mt-2 text-sm leading-relaxed text-sub">지도의 지역을 누르면 안으로 들어가고, 동네를 고르면 같은 취향 이웃과 교환글을 볼 수 있어요.</p>
      <Link href="/local/settings" className={`${localButton} mt-4 w-full`}>내 동네·취향 설정</Link>
    </aside>;
  }
  const top = (ranking.data ?? []).slice(0, 3);
  return <aside aria-label={`${region.fullName} 정보`} className="rounded-xl border-2 border-line bg-panel p-5">
    <p className="font-pixel text-xs text-mint">{hasChildren ? "AREA" : "NEIGHBORHOOD"}</p>
    <h2 className="mt-1 break-keep text-lg font-extrabold">{region.fullName}</h2>
    {block && <p className="mt-3 text-sm">
      {block.count ? <><strong className="text-lime">{block.count}명</strong>의 {block.hint === "지도 표시 이웃" ? "이웃이 지도에 아바타를 보여 주고" : `${interestName ? `${interestName} 팬` : block.hint ?? "이웃"}이`} 있어요</> : "아직 소수의 이웃이 있어요"}
      {block.sample && <span className="ml-1 text-xs text-violet">· 샘플</span>}
    </p>}
    {top.length > 0 && <div className="mt-4">
      <p className="mb-2 text-xs text-dim">이 동네 인기 취향</p>
      <ol className="space-y-1.5">{top.map((row) => <li key={row.interestId} className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate"><span className="mr-2 font-pixel text-violet">{row.rank}</span>{row.interest}</span>
        <span className="shrink-0 text-xs text-sub">{row.count}명{row.isSample ? " · 샘플" : ""}</span>
      </li>)}</ol>
    </div>}
    <div className="mt-5 grid gap-2">
      <Link href={`/local/trades?region=${encodeURIComponent(code)}${interest ? `&interestId=${interest}` : ""}`} className={localButton}>이 동네 교환글 보기</Link>
      <Link href={interestProductHref(interestName)} className={localButton}>{interestName ? `${interestName} 관련 상품` : "상품 둘러보기"}</Link>
      <Link href={localSettingsHref(code)} className={localButton}>여기를 내 동네로</Link>
    </div>
  </aside>;
}
