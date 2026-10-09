"use client";

import PixelIcon from "@/components/PixelIcon";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocalSelection } from "@/components/local/useLocalSelection";
import { useLocalResource } from "@/components/local/useLocalResource";
import CompactRegionSelect from "@/components/local/CompactRegionSelect";
import TradeCard from "@/components/local/TradeCard";
import Pagination from "@/components/Pagination";
import { LocalError, LocalSkeleton, localButton, localToolbar } from "@/components/local/LocalStates";
import { localApi } from "@/lib/local";
import { changeTradeQuery, parseTradeQuery, tradeHref, tradeProximity, tradeQueryParams, TRADE_KINDS, type TradeQuery } from "@/utils/localTrades";
import type { ApiRegion, TradeKind } from "@/types/api";
import { TRADE_KIND_GAME } from "@/utils/gameItem";

export default function TradesBoard() {
  const params = useSearchParams(), router = useRouter();
  const parsed = parseTradeQuery(params);
  // 위시(want)는 위시맵 탭에서 — 거래·교환 탭은 HAVE·SELL만
  const query = parsed.kind === "want" ? { ...parsed, kind: undefined } : parsed;
  const selection = useLocalSelection(query);
  const { catalog, profile, selected, loading, invalid } = selection;
  if (catalog.error) return <LocalError message={catalog.error} onRetry={() => void catalog.refresh()} />;
  if (loading || !catalog.data) return <LocalSkeleton label="거래 게시판 준비 중" />;
  const effective = { ...query, region: selected?.code ?? null, hasRegion: true };
  function change(patch: Partial<TradeQuery>) { router.push(tradeHref(changeTradeQuery(effective, patch)), { scroll: false }); }
  return <div className="space-y-6">
    {profile.error && <LocalError message={`내 동네 조회에 실패했어요. 지역을 직접 선택할 수 있어요. ${profile.error}`} onRetry={() => void profile.refresh()} />}
    {/* 거래소 도구 막대 — 지역 · 종류를 한 줄에 */}
    <section aria-label="게시판 필터" className="space-y-2">
      <div className={localToolbar}>
        {/* 사거나 팔고 싶은 물건 이름으로 찾기 — 물건 이름·연결 상품·설명에서 */}
        <form role="search" aria-label="물건 찾기" className="flex min-w-0 flex-[1_1_16rem] gap-2" onSubmit={(event) => {
          event.preventDefault();
          const q = String(new FormData(event.currentTarget).get("q") ?? "").trim().slice(0, 40);
          change({ q: q || undefined });
        }}>
          <label htmlFor="trade-q" className="sr-only">찾는 물건</label>
          <div className="relative min-w-0 flex-1">
            <input key={query.q ?? ""} id="trade-q" name="q" type="search" defaultValue={query.q ?? ""} maxLength={40} enterKeyHint="search"
              placeholder="찾는 물건 (예: 키링)" className="pixel-input h-10 w-full min-w-0 px-3 py-0 text-sm text-ink" />
          </div>
          <button type="submit" className="btn-lime h-10 shrink-0 px-4 text-sm font-bold">찾기</button>
          {query.q && <button type="button" onClick={() => change({ q: undefined })} className="btn-pixel h-10 shrink-0 px-3 text-xs font-bold">검색 지우기</button>}
        </form>
        <div className="min-w-0 flex-[2_1_26rem]"><CompactRegionSelect regions={catalog.data} value={selected?.code ?? null} ownRegion={profile.data?.region?.code ?? null} onChange={(region) => change({ region })} /></div>
        {/* 지역과 헷갈리지 않게 글 종류는 구분선 뒤 한 덩어리(세그먼트)로 */}
        <div role="group" aria-label="글 종류 필터" className="segmented h-10 font-pixel text-xs">
          {[{ value: undefined, label: "ALL", name: "모든 글", icon: undefined }, ...TRADE_KINDS.filter((item) => item.value !== "want").map((item) => ({ value: item.value, label: TRADE_KIND_GAME[item.value].tag, name: item.label, icon: TRADE_KIND_GAME[item.value].icon }))].map((item) =>
            <button key={item.label} type="button" aria-pressed={query.kind === item.value} aria-label={item.name} title={item.name} onClick={() => change({ kind: item.value as TradeKind | undefined })}
              >{item.icon && <PixelIcon name={item.icon} className="mr-1.5 size-3.5" />}{item.label}</button>)}
        </div>
      </div>
      {invalid && <p role="status" className="text-sm text-pink">없는 지역 조건은 제외했어요. 지역을 다시 선택해 주세요.</p>}
      {(query.productId || query.interestId) && <div className="flex flex-wrap gap-2">{query.productId && <button type="button" onClick={() => change({ productId: undefined })} className="btn-pixel min-h-8 px-2.5 py-1 text-xs text-sub">연결 상품 조건 ×</button>}{query.interestId && <button type="button" onClick={() => change({ interestId: undefined })} className="btn-pixel min-h-8 px-2.5 py-1 text-xs text-sub">취향 조건 ×</button>}</div>}
      <p className="text-xs text-dim">{selected ? "선택한 지역의 하위 지역까지 둘러봐요." : "전체 지역의 진행 중인 글을 둘러봐요."} 글은 저장된 내 동네로 작성돼요.</p>
    </section>
    <TradesResults key={tradeHref(effective)} query={effective} regions={catalog.data} ownRegion={profile.data?.region?.code ?? null} />
  </div>;
}
interface TradesResultsProps { query: TradeQuery; regions: ApiRegion[]; ownRegion: string | null; }
function TradesResults({ query, regions, ownRegion }: TradesResultsProps) {
  const router = useRouter();
  const load = useCallback((signal: AbortSignal) => localApi.trades(query, signal), [query]);
  const result = useLocalResource(load);
  const last = result.data?.totalPages ?? query.page;
  useEffect(() => { if (result.data && query.page > last) router.replace(tradeHref({ ...query, page: Math.max(1, last) }), { scroll: false }); }, [result.data, query, last, router]);
  if (result.loading || (result.data && query.page > last)) return <LocalSkeleton label="거래글 불러오는 중" />;
  if (result.error) return <LocalError message={result.error} onRetry={() => void result.refresh()} />;
  if (!result.data) return null;
  const data = result.data;
  return data.items.length ? <><p className="text-sm text-sub">진행 중인 글 {data.total}개 · 최신순</p>
    <ul aria-label="거래·교환 글" className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{data.items.map((post) => <li key={post.id}><TradeCard post={post} proximity={tradeProximity(regions, ownRegion, post.regionCode)} /></li>)}</ul>
    <Pagination currentPage={data.page} totalPages={data.totalPages} basePath="/local/trades" query={tradeQueryParams(query).toString()} />
  </> : <div className="pixel-panel p-8 text-center"><h2 className="text-xl font-bold">아직 조건에 맞는 물건이 없어요</h2><p className="mt-3 text-sm text-sub">범위를 넓혀 보거나 가진 물건을 올려 보세요. 갖고 싶은 아이템은 위시맵에서 찾을 수 있어요.</p>
    <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href={tradeHref({ ...query, region: regions.find((region) => region.code === query.region)?.parentCode ?? null, page: 1 })} className={localButton}>상위 지역에서 보기</Link><Link href="/local/trades/new?kind=have" className={localButton}>HAVE 글쓰기</Link><Link href="/local/wish-map" className={localButton}>위시맵 보기</Link><Link href="/products" className={localButton}>관련 상품 보기</Link></div>
  </div>;
}
