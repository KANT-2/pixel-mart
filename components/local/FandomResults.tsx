"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, LocalSkeleton, localButton } from "@/components/local/LocalStates";
import FandomCount from "@/components/local/FandomCount";
import { localApi } from "@/lib/local";
import { fandomPresentation, INTEREST_TYPES, interestProductHref, localSettingsHref } from "@/utils/local";
import type { ApiInterest, ApiRegion, FandomPeriod } from "@/types/api";

interface FandomResultsProps { region: ApiRegion; period: FandomPeriod; interest: ApiInterest | null; onParent: () => void; }

export default function FandomResults({ region, period, interest, onParent }: FandomResultsProps) {
  const load = useCallback(async (signal: AbortSignal) => {
    const [rows, ranking] = await Promise.all([localApi.fandom(region.code, period, interest?.id, signal), localApi.ranking(region.code, period, signal)]);
    return { rows, ranking };
  }, [region.code, period, interest?.id]);
  const result = useLocalResource(load);
  if (result.loading) return <LocalSkeleton label="덕력지도 집계 불러오는 중" />;
  if (result.error) return <LocalError message={result.error} onRetry={() => void result.refresh()} />;
  if (!result.data) return null;
  const { rows, ranking } = result.data;
  const maximum = Math.max(1, ...rows.map((row) => fandomPresentation(row).count ?? 0));
  return <div className="space-y-8">
    <section aria-labelledby="local-ranking-title" className="rounded-xl border border-line bg-panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 id="local-ranking-title" className="text-xl font-bold">동네 인기 취향</h2><span className="font-pixel text-xs text-violet">LOCAL TOP 10</span></div>
      <p className="mb-5 text-sm text-sub">{region.fullName} · 5명 이상 집계된 취향만 순위에 표시해요.</p>
      {ranking.length ? <ol className="grid gap-3 sm:grid-cols-2">
        {ranking.map((item) => <li key={item.interestId}>
          <Link href={interestProductHref(item.interest)} className="flex min-h-20 items-center gap-3 rounded-lg border border-line bg-night p-4 hover:border-violet/50 focus-visible:outline-2 focus-visible:outline-mint">
            <span className="w-7 shrink-0 font-pixel text-xl text-violet">{item.rank}</span>
            <div className="min-w-0 flex-1"><span className="block break-words font-semibold">{item.interest}</span>
              {item.isSample && <span className="mt-1 inline-block rounded border border-violet/40 px-1.5 py-0.5 text-xs text-violet">샘플 데이터</span>}
            </div><span className="shrink-0 text-sm font-bold text-mint">{fandomPresentation({ ...item, belowThreshold: false }).label}</span>
          </Link>
        </li>)}
      </ol> : <p className="rounded-lg bg-panel-2 p-5 text-sm leading-relaxed text-sub">아직 순위를 보여 줄 만큼 데이터가 충분하지 않아요. 아래 취향을 둘러보거나 내 취향을 등록해 보세요.</p>}
    </section>
    <section aria-labelledby="local-fandom-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><h2 id="local-fandom-title" className="text-xl font-bold">{interest ? `${interest.name} · 동네 팬` : "우리 동네의 취향"}</h2><p className="text-xs text-dim">취향을 누르면 관련 상품으로 연결돼요</p></div>
      {rows.length ? <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {rows.map((row) => <li key={`${row.regionCode}:${row.interestId}`}>
          <Link href={interestProductHref(row.interest)} className="block h-full rounded-xl border border-line bg-panel p-5 hover:border-mint/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint">
            <p className="mb-2 text-xs text-dim">{INTEREST_TYPES.find((type) => type.value === row.interestType)?.label}</p>
            <h3 className="mb-5 break-words text-lg font-bold">{row.interest}</h3><FandomCount row={row} maximum={maximum} />
          </Link>
        </li>)}
      </ul> : <div className="rounded-xl border border-line bg-panel px-5 py-10 text-center">
        <p className="mb-3 font-pixel text-sm text-violet">NEXT DISCOVERY</p>
        <h3 className="text-lg font-bold">이 동네의 취향을 함께 채워 보세요</h3>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-sub">현재 {region.fullName}에서 집계된 {interest ? `${interest.name} ` : ""}팬 데이터가 충분하지 않아요.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onParent} className={localButton}>{region.parentCode ? "상위 지역에서 보기" : "다른 시에서 보기"}</button>
          <Link href={interestProductHref(interest?.name)} className={localButton}>관련 상품</Link>
          <Link href="/local/settings#interests" className={localButton}>내 취향 등록</Link>
          <Link href={localSettingsHref(region.code)} className={localButton}>관심 지역 등록</Link>
        </div>
        <p className="mt-4 text-xs text-dim">관심 지역 등록은 내 동네 설정으로 연결돼요. 저장을 눌러야 반영돼요.</p>
      </div>}
    </section>
    <p className="text-xs leading-relaxed text-dim">개인이 아닌 지역 단위의 익명 집계입니다. 샘플 데이터는 서비스 시연용이며 실제 사용자 수와 구분해 표시해요. 최근 30일·90일은 해당 기간에 선택된 취향을 기준으로 집계해요.</p>
  </div>;
}
