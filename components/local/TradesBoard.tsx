"use client";

import PixelIcon from "@/components/PixelIcon";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocalSelection } from "@/components/local/useLocalSelection";
import { useLocalResource } from "@/components/local/useLocalResource";
import LocalSearch from "@/components/local/LocalSearch";
import TradeCard from "@/components/local/TradeCard";
import Pagination from "@/components/Pagination";
import { LocalError, LocalSkeleton, localButton, localToolbar } from "@/components/local/LocalStates";
import { localApi } from "@/lib/local";
import { regionPath } from "@/utils/local";
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
  const ownRegion = profile.data?.region?.code ?? null;
  function change(patch: Partial<TradeQuery>) { router.push(tradeHref(changeTradeQuery(effective, patch)), { scroll: false }); }
  return <div className="space-y-6">
    {profile.error && <LocalError message={`내 동네 조회에 실패했어요. 지역을 직접 선택할 수 있어요. ${profile.error}`} onRetry={() => void profile.refresh()} />}
    {/* 덕력지도·위시맵과 같은 줄 구성 — 1줄 지도 위치(+내 동네), 2줄 왼쪽 글 종류 · 오른쪽 검색 */}
    <section aria-label="게시판 필터" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="지역 위치" className="flex min-w-0 flex-wrap items-center gap-1 font-pixel text-sm">
          <button type="button" onClick={() => change({ region: null })} aria-current={!selected ? "location" : undefined}
            className="rounded px-1.5 py-1 text-mint hover:bg-panel aria-[current=location]:text-ink">전체</button>
          {regionPath(catalog.data, selected?.code ?? null).map((region) => <span key={region.code} className="flex items-center gap-1">
            <span aria-hidden="true" className="text-dim">›</span>
            <button type="button" onClick={() => change({ region: region.code })} aria-current={region.code === selected?.code ? "location" : undefined}
              className="rounded px-1.5 py-1 text-sub hover:bg-panel aria-[current=location]:text-ink">{region.name}</button>
          </span>)}
        </nav>
        {ownRegion && <button type="button" aria-pressed={selected?.code === ownRegion} onClick={() => change({ region: ownRegion })}
          className="btn-pixel toggle-outline h-9 px-3 text-xs font-bold text-sub hover:text-ink">내 동네</button>}
      </div>
      <div className={`${localToolbar} min-h-11 justify-between`}>
        <div role="group" aria-label="글 종류 필터" className="segmented h-11 font-pixel text-xs">
          {[{ value: undefined, label: "ALL", name: "모든 글", icon: undefined }, ...TRADE_KINDS.filter((item) => item.value !== "want").map((item) => ({ value: item.value, label: TRADE_KIND_GAME[item.value].tag, name: item.label, icon: TRADE_KIND_GAME[item.value].icon }))].map((item) =>
            <button key={item.label} type="button" aria-pressed={query.kind === item.value} aria-label={item.name} title={item.name} onClick={() => change({ kind: item.value as TradeKind | undefined })}
              >{item.icon && <PixelIcon name={item.icon} className="mr-1.5 size-3.5" />}{item.label}</button>)}
        </div>
        <div className="ml-auto flex min-w-0">
          <LocalSearch key={`${query.nickname ?? ""}|${query.q ?? ""}`} regions={catalog.data} mode={query.nickname ? "nickname" : query.q ? "item" : "region"} value={query.nickname ?? query.q ?? ""}
            onRegion={(region) => change({ region })} onNickname={(nickname) => change({ nickname, q: undefined })} onItem={(q) => change({ q, nickname: undefined })} />
        </div>
      </div>
      {invalid && <p role="status" className="text-sm text-pink">없는 지역 조건은 제외했어요. 지역을 다시 선택해 주세요.</p>}
      {(query.productId || query.interestId) && <div className="flex flex-wrap gap-2">{query.productId && <button type="button" onClick={() => change({ productId: undefined })} className="btn-pixel min-h-8 px-2.5 py-1 text-xs text-sub">연결 상품 조건 ×</button>}{query.interestId && <button type="button" onClick={() => change({ interestId: undefined })} className="btn-pixel min-h-8 px-2.5 py-1 text-xs text-sub">취향 조건 ×</button>}</div>}
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
  const searchTags = [
    query.nickname ? { label: `닉네임 '${query.nickname}'`, href: tradeHref({ ...query, nickname: undefined, page: 1 }) } : null,
    query.q ? { label: `아이템 '${query.q}'`, href: tradeHref({ ...query, q: undefined, page: 1 }) } : null,
  ].filter((tag) => tag !== null);
  const summary = <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-sub">진행 중인 글 {data.total}개 · 최신순
    {searchTags.map((tag) => <Link key={tag.label} href={tag.href} scroll={false} aria-label={`${tag.label} 검색 지우기`} className="text-xs text-dim hover:text-ink">· {tag.label} ✕</Link>)}
  </p>;
  return data.items.length ? <>{summary}
    <ul aria-label="거래·교환 글" className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{data.items.map((post) => <li key={post.id}><TradeCard post={post} proximity={tradeProximity(regions, ownRegion, post.regionCode)} /></li>)}</ul>
    <Pagination currentPage={data.page} totalPages={data.totalPages} basePath="/local/trades" query={tradeQueryParams(query).toString()} />
  </> : <>{searchTags.length > 0 && summary}<div className="pixel-panel p-8 text-center"><h2 className="text-xl font-bold">아직 조건에 맞는 물건이 없어요</h2><p className="mt-3 text-sm text-sub">범위를 넓혀 보거나 가진 물건을 올려 보세요. 갖고 싶은 아이템은 위시맵에서 찾을 수 있어요.</p>
    <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href={tradeHref({ ...query, region: regions.find((region) => region.code === query.region)?.parentCode ?? null, page: 1 })} className={localButton}>상위 지역에서 보기</Link><Link href="/local/trades/new?kind=have" className={localButton}>HAVE 글쓰기</Link><Link href="/local/wish-map" className={localButton}>위시맵 보기</Link><Link href="/products" className={localButton}>관련 상품 보기</Link></div>
  </div></>;
}
