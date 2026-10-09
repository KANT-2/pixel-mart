"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useLocalSelection } from "@/components/local/useLocalSelection";
import { useLocalResource } from "@/components/local/useLocalResource";
import RegionSelector from "@/components/local/RegionSelector";
import { LocalError, LocalSkeleton, localButton } from "@/components/local/LocalStates";
import ProductCard from "@/components/ProductCard";
import { localApi } from "@/lib/local";
import { parseTradeQuery } from "@/utils/localTrades";
import type { ApiRegion } from "@/types/api";

export default function WishMap() {
  const params = useSearchParams(), query = parseTradeQuery(params);
  const { catalog, profile, selected, loading, invalid } = useLocalSelection(query);
  const choose = (region: string | null) => window.history.pushState(null, "", `/local/wish-map?${new URLSearchParams({ region: region ?? "" })}`);
  if (catalog.error) return <LocalError message={catalog.error} onRetry={() => void catalog.refresh()} />;
  if (loading || !catalog.data) return <LocalSkeleton />;
  return <div className="space-y-8">
    {profile.error && <LocalError message={`내 동네 조회에 실패했어요. 지역을 직접 선택해 주세요. ${profile.error}`} onRetry={() => void profile.refresh()} />}
    <section aria-label="Wish Map 지역" className="rounded-xl border border-line bg-panel p-5"><RegionSelector regions={catalog.data} value={selected?.code ?? null} onChange={choose} />{invalid && <p role="status" className="mt-4 text-sm text-pink">없는 지역이에요. 지역을 다시 선택해 주세요.</p>}<p className="mt-4 text-xs leading-relaxed text-dim">집계 참여자의 익명 찜 인원만 표시해요. 5명 미만 상품은 순위에 나타나지 않아요. 하위 지역을 합산하며 개인 찜 목록은 공개하지 않아요.</p></section>
    {selected ? <WishMapResults key={selected.code} region={selected} onParent={() => choose(selected.parentCode)} /> : <div className="rounded-xl border border-line bg-panel p-10 text-center"><h2 className="text-xl font-bold">궁금한 동네를 먼저 골라 보세요</h2><p className="mt-3 text-sm text-sub">우리 동네에서 관심을 모으는 아이템을 살펴보세요.</p></div>}
  </div>;
}
interface WishMapResultsProps { region: ApiRegion; onParent: () => void; }
function WishMapResults({ region, onParent }: WishMapResultsProps) {
  const load = useCallback((signal: AbortSignal) => localApi.wishMap(region.code, signal), [region.code]);
  const result = useLocalResource(load);
  if (result.loading) return <LocalSkeleton label="인기 찜 상품 불러오는 중" />;
  if (result.error) return <LocalError message={result.error} onRetry={() => void result.refresh()} />;
  if (!result.data) return null;
  const rows = result.data.filter((row) => row.count >= 5);
  return rows.length ? <ol aria-label="동네 인기 찜 상품" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{rows.map((row) => <li key={row.product.id} className="min-w-0"><div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 sm:mb-3"><span className="font-pixel text-base text-violet sm:text-lg">#{row.rank}</span><span className="text-xs font-bold text-mint sm:text-sm">{row.count}명이 찜했어요</span></div><ProductCard product={row.product} /></li>)}</ol>
    : <div className="rounded-xl border border-line bg-panel p-8 text-center"><p className="mb-3 font-pixel text-violet">NEXT WISH</p><h2 className="text-xl font-bold">아직 순위를 보여 줄 만큼 모이지 않았어요</h2><p className="mt-3 text-sm text-sub">5명 이상이 찜한 상품부터 보여드려요. 더 넓은 지역이나 다른 아이템을 살펴보세요.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={onParent} className={localButton}>{region.parentCode ? "상위 지역에서 보기" : "다른 시에서 보기"}</button><Link href="/products" className={localButton}>상품 둘러보기</Link><Link href="/local/settings" className={localButton}>내 취향 등록</Link></div></div>;
}
