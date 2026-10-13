"use client";

import PixelIcon from "@/components/PixelIcon";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocalSelection } from "@/components/local/useLocalSelection";
import { useLocalResource } from "@/components/local/useLocalResource";
import LocalSearch from "@/components/local/LocalSearch";
import TradeCard from "@/components/local/TradeCard";
import TradeRequestButton, { SentRequestsProvider } from "@/components/local/TradeRequestButton";
import Pagination from "@/components/Pagination";
import { LocalError, LocalSkeleton, localButton, localToolbar } from "@/components/local/LocalStates";
import { SearchToggle } from "@/components/local/MobileToggles";
import { localApi } from "@/lib/local";
import { changeTradeQuery, parseTradeQuery, tradeHref, tradeProximity, tradeQueryParams, TRADE_KINDS, type TradeQuery } from "@/utils/localTrades";
import type { ApiRegion, TradeKind } from "@/types/api";
import { TRADE_KIND_GAME } from "@/utils/gameItem";

export default function TradesBoard() {
  const params = useSearchParams(), router = useRouter();
  const parsed = parseTradeQuery(params);
  // 위시(want)는 위시맵 탭에서 — 거래·교환 탭은 HAVE·SELL만.
  // 지역 고르기는 없애서, URL에 지역이 없으면 전체 지역 글을 보여 준다 (지도에서 넘어온 지역은 유지)
  const base = parsed.hasRegion ? parsed : { ...parsed, region: null, hasRegion: true };
  const query = base.kind === "want" ? { ...base, kind: undefined } : base;
  const selection = useLocalSelection(query);
  const [searchOpen, setSearchOpen] = useState(false); // 모바일: 검색 줄은 눌러서 펼친다
  const { catalog, profile, selected, loading, invalid } = selection;
  if (catalog.error) return <LocalError message={catalog.error} onRetry={() => void catalog.refresh()} />;
  if (loading || !catalog.data) return <LocalSkeleton label="거래 게시판 준비 중" />;
  const effective = { ...query, region: selected?.code ?? null, hasRegion: true };
  function change(patch: Partial<TradeQuery>) { router.push(tradeHref(changeTradeQuery(effective, patch)), { scroll: false }); }
  return <div className="space-y-6">
    {profile.error && <LocalError message={`내 동네 조회에 실패했어요. 지역을 직접 선택할 수 있어요. ${profile.error}`} onRetry={() => void profile.refresh()} />}
    {/* 거래소 도구 막대 — 지역 · 종류를 한 줄에 */}
    <section aria-label="게시판 필터" className="space-y-2">
      {/* 검색은 왼쪽, 글 종류는 오른쪽 */}
      <div className={`${localToolbar} justify-between`}>
        <div className={`w-full min-w-0 sm:w-auto ${searchOpen ? "" : "max-sm:hidden"}`}>
        <LocalSearch key={`${query.nickname ?? ""}|${query.q ?? ""}`} regions={catalog.data} modes={["nickname", "item"]} mode={query.nickname ? "nickname" : "item"} value={query.nickname ?? query.q ?? ""}
          onRegion={(region) => change({ region })} onNickname={(nickname) => change({ nickname, q: undefined })} onItem={(q) => change({ q, nickname: undefined })} />
        </div>
        <SearchToggle open={searchOpen} onToggle={() => setSearchOpen((value) => !value)} />
        <div role="group" aria-label="글 종류 필터" className="segmented h-11 font-pixel text-xs">
          {[{ value: undefined, label: "ALL", name: "모든 글", icon: undefined }, ...TRADE_KINDS.filter((item) => item.value !== "want").map((item) => ({ value: item.value, label: TRADE_KIND_GAME[item.value].tag, name: item.label, icon: TRADE_KIND_GAME[item.value].icon }))].map((item) =>
            <button key={item.label} type="button" aria-pressed={query.kind === item.value} aria-label={item.name} title={item.name} onClick={() => change({ kind: item.value as TradeKind | undefined })}
              >{item.icon && <PixelIcon name={item.icon} className="mr-1.5 size-3.5" />}{item.label}</button>)}
        </div>
      </div>
      {invalid && <p role="status" className="text-sm text-pink">없는 지역 조건은 제외했어요. 지역을 다시 선택해 주세요.</p>}
      {(query.productId || query.interestId) && <div className="flex flex-wrap gap-2">{query.productId && <button type="button" onClick={() => change({ productId: undefined })} className="btn-pixel min-h-8 px-2.5 py-1 text-xs text-sub">연결 상품 조건 ×</button>}{query.interestId && <button type="button" onClick={() => change({ interestId: undefined })} className="btn-pixel min-h-8 px-2.5 py-1 text-xs text-sub">취향 조건 ×</button>}</div>}
      {/* 지금 보고 있는 범위와 검색 — 지우기로 바로 해제 */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
        <span><strong className="text-sub">{selected ? selected.fullName : "전체 지역"}</strong>{selected ? " 일대" : ""} 진행 중인 글</span>
        {selected && <button type="button" onClick={() => change({ region: null })} className="underline hover:text-ink">전체 지역 보기</button>}
        {query.nickname && <span>· 닉네임 &lsquo;{query.nickname}&rsquo; <button type="button" onClick={() => change({ nickname: undefined })} className="underline hover:text-ink">지우기</button></span>}
        {query.q && <span>· 아이템 &lsquo;{query.q}&rsquo; <button type="button" onClick={() => change({ q: undefined })} className="underline hover:text-ink">지우기</button></span>}
        <span className="hidden sm:inline">· 글은 저장된 내 동네로 작성돼요.</span>
      </p>
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
    <SentRequestsProvider><ul aria-label="거래·교환 글" className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">{data.items.map((post) => <li key={post.id}><TradeCard post={post} proximity={tradeProximity(regions, ownRegion, post.regionCode)} actions={<TradeRequestButton post={post} />} /></li>)}</ul></SentRequestsProvider>
    <Pagination currentPage={data.page} totalPages={data.totalPages} basePath="/local/trades" query={tradeQueryParams(query).toString()} />
  </> : <div className="pixel-panel p-8 text-center"><h2 className="text-xl font-bold">아직 조건에 맞는 물건이 없어요</h2><p className="mt-3 text-sm text-sub">범위를 넓혀 보거나 가진 물건을 올려 보세요. 갖고 싶은 아이템은 위시맵에서 찾을 수 있어요.</p>
    <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href={tradeHref({ ...query, region: regions.find((region) => region.code === query.region)?.parentCode ?? null, page: 1 })} className={localButton}>상위 지역에서 보기</Link><Link href="/local/trades/new?kind=have" className={localButton}>HAVE 글쓰기</Link><Link href="/local/wish-map" className={localButton}>위시맵 보기</Link><Link href="/products" className={localButton}>관련 상품 보기</Link></div>
  </div>;
}
