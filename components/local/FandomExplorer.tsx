"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useLocalProfile, useRegions } from "@/components/local/LocalProvider";
import { useLocalResource } from "@/components/local/useLocalResource";
import RegionSelector from "@/components/local/RegionSelector";
import FandomResults from "@/components/local/FandomResults";
import { LocalError, LocalSkeleton, localInput } from "@/components/local/LocalStates";
import { localApi } from "@/lib/local";
import { FANDOM_PERIODS, localHref, parseLocalQuery } from "@/utils/local";
import type { FandomPeriod } from "@/types/api";

export default function FandomExplorer() {
  const params = useSearchParams();
  const query = parseLocalQuery(params);
  const auth = useAuth();
  const regions = useRegions();
  const profile = useLocalProfile();
  const loadInterests = useCallback((signal: AbortSignal) => localApi.interests("", undefined, signal), []);
  const interests = useLocalResource(loadInterests);
  if (regions.error) return <LocalError message={regions.error} onRetry={() => void regions.refresh()} busy={regions.loading} />;
  if (!regions.data || regions.loading || (!query.hasRegion && (auth.loading || (Boolean(auth.user) && profile.loading)))) return <LocalSkeleton />;
  const regionCode = query.hasRegion ? query.region : profile.data?.region?.code ?? null;
  const selected = regions.data.find((region) => region.code === regionCode) ?? null;
  const interest = interests.data?.find((item) => item.id === query.interest) ?? null;
  function navigate(region: string | null, period = query.period, interestId = query.interest) {
    window.history.pushState(null, "", localHref(region, period, interestId));
  }
  return <div className="space-y-8">
    {auth.user && profile.error && <LocalError message={`내 동네를 불러오지 못했어요. 지역을 직접 선택할 수 있어요. ${profile.error}`} onRetry={() => void profile.refresh()} busy={profile.loading} />}
    <section aria-label="덕력지도 조건" className="rounded-xl border border-line bg-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">어느 동네가 궁금하세요?</h2><span className="text-xs text-dim">위치 권한 없이 직접 선택</span></div>
      {regionCode && !selected && <p role="status" className="mb-4 text-sm text-pink">찾을 수 없는 지역이에요. 지역을 다시 선택해 주세요.</p>}
      <RegionSelector regions={regions.data} value={selected?.code ?? null} onChange={(code) => navigate(code)} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label htmlFor="local-period" className="text-sm font-semibold">집계 기간<select id="local-period" aria-label="집계 기간" value={query.period} onChange={(event) => navigate(selected?.code ?? null, event.target.value as FandomPeriod)} className={`${localInput} mt-2`}>
          {FANDOM_PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select></label>
        <label htmlFor="local-interest" className="min-w-0 text-sm font-semibold">궁금한 취향<select id="local-interest" aria-label="궁금한 취향" value={interest?.id ?? ""} disabled={interests.loading || Boolean(interests.error)} onChange={(event) => navigate(selected?.code ?? null, query.period, event.target.value ? Number(event.target.value) : null)} className={`${localInput} mt-2`}>
          <option value="">{interests.loading ? "취향 불러오는 중" : "전체 취향"}</option>{interests.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
      </div>
      {interests.error && <div className="mt-4"><LocalError message={interests.error} onRetry={() => void interests.refresh()} busy={interests.loading} /></div>}
      {query.interest && interests.data && !interest && <p role="status" className="mt-3 text-sm text-sub">없는 취향 조건은 제외하고 전체 취향을 보여드려요.</p>}
      <p className="mt-4 text-xs leading-relaxed text-dim">선택한 지역의 하위 지역까지 합산해요. 여기서 동네를 바꿔도 저장된 내 동네는 바뀌지 않아요.</p>
    </section>
    {selected ? (query.interest && interests.loading ? <LocalSkeleton /> : <FandomResults key={`${selected.code}:${query.period}:${interest?.id ?? "all"}`} region={selected} period={query.period} interest={interest} onParent={() => navigate(selected.parentCode)} />)
      : <div className="rounded-xl border border-dashed border-line bg-panel p-10 text-center"><p className="mb-3 font-pixel text-mint">SELECT YOUR LOCAL</p><h2 className="text-xl font-bold">먼저 궁금한 동네를 골라 보세요</h2><p className="mt-3 text-sm text-sub">시부터 넓게 둘러보거나 구·생활권까지 살펴볼 수 있어요.</p></div>}
  </div>;
}
