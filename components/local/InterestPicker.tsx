"use client";

import { useCallback, useId, useState } from "react";
import type { ApiInterest, InterestType } from "@/types/api";
import { localApi } from "@/lib/local";
import { INTEREST_TYPES, interestLabel, toggleInterest } from "@/utils/local";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, localButton, localInput } from "@/components/local/LocalStates";

interface InterestPickerProps { selected: ApiInterest[]; onChange: (items: ApiInterest[]) => void; disabled?: boolean; single?: boolean; }

export default function InterestPicker({ selected, onChange, disabled = false, single = false }: InterestPickerProps) {
  const id = useId();
  const [q, setQ] = useState("");
  const [type, setType] = useState<InterestType | "">("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => localApi.interests(q, type || undefined, signal), [q, type]);
  // 키 입력마다 이전 타이머·요청을 폐기하고 300ms 후 마지막 검색만 실행합니다.
  const results = useLocalResource(load, 300);
  function toggle(item: ApiInterest) {
    const next = toggleInterest(selected, item, single);
    setError(next.error);
    onChange(next.items);
  }
  return <div className="space-y-4">
    <p className="text-sm text-sub" aria-live="polite">선택한 취향 <strong className="text-mint">{selected.length} / {single ? 1 : 20}개</strong>{single && " · 선택 사항"}</p>
    <ul aria-label="선택한 취향" className="flex flex-wrap gap-2">
      {selected.map((item) => <li key={item.id}><button type="button" disabled={disabled} onClick={() => toggle(item)} aria-label={`${interestLabel(item)} 선택 해제`} className={`${localButton} border-mint/40 text-mint`}>
        {interestLabel(item)}<span aria-hidden="true" className="ml-2">×</span>
      </button></li>)}
    </ul>
    {selected.length === 0 && <p className="text-sm text-dim">좋아하는 캐릭터나 스타일을 찾아 선택해 보세요.</p>}
    <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
      <div className="min-w-0">
        <label htmlFor={`${id}-q`} className="text-sm font-semibold">취향 검색</label>
        <div className="mt-2 flex gap-1.5">
          <input id={`${id}-q`} type="search" value={q} maxLength={30} disabled={disabled} onChange={(event) => setQ(event.target.value)} enterKeyHint="search"
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void results.refresh(); } }}
            placeholder="이름으로 검색 (최대 30자)" className={`${localInput} min-w-0 flex-1`} />
          <button type="button" disabled={disabled} onClick={() => void results.refresh()} className="btn-lime min-h-11 shrink-0 px-3 text-sm font-bold">찾기</button>
        </div>
      </div>
      <label htmlFor={`${id}-type`} className="text-sm font-semibold">취향 종류
        <select id={`${id}-type`} aria-label="취향 종류" value={type} disabled={disabled} onChange={(event) => setType(event.target.value as InterestType | "")} className={`${localInput} mt-2`}>
          <option value="">전체</option>{INTEREST_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
    </div>
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    {results.error ? <LocalError message={results.error} onRetry={() => void results.refresh()} busy={disabled} />
      : results.loading ? <div role="status" aria-label="취향 검색 중" className="h-24 animate-pulse rounded-lg bg-panel-2" />
        : results.data?.length ? <ul aria-label="취향 검색 결과" className="flex flex-wrap gap-2">
          {results.data.map((item) => {
            const checked = selected.some((value) => value.id === item.id);
            return <li key={item.id}><button type="button" disabled={disabled} aria-pressed={checked} onClick={() => toggle(item)} className={localButton}>
              <span aria-hidden="true" className="mr-2">{checked ? "✓" : "+"}</span>{item.name}
              <span className="ml-2 text-xs text-dim">{INTEREST_TYPES.find((value) => value.value === item.type)?.label}</span>
            </button></li>;
          })}
        </ul> : <p role="status" className="rounded-lg bg-panel-2 p-5 text-sm text-sub">맞는 취향이 없어요. 다른 이름이나 종류로 찾아보세요.</p>}
  </div>;
}
