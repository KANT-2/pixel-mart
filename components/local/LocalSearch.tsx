"use client";

import { useId, useState } from "react";
import { localInput } from "@/components/local/LocalStates";
import type { ApiRegion } from "@/types/api";

export type LocalSearchMode = "region" | "nickname" | "item";

interface LocalSearchProps {
  regions: ApiRegion[];
  /** 처음 고를 칸과 글자 (URL에 닉네임·아이템 검색이 있으면 그 칸으로) */
  mode?: LocalSearchMode;
  value?: string;
  onRegion: (code: string) => void;
  onNickname: (nickname: string) => void;
  onItem: (item: string) => void;
}

const MODES: { value: LocalSearchMode; label: string; placeholder: string; max: number }[] = [
  { value: "region", label: "동네", placeholder: "동네 이름 (예: 판교)", max: 20 },
  { value: "nickname", label: "닉네임", placeholder: "닉네임", max: 30 },
  { value: "item", label: "아이템", placeholder: "아이템 이름 (예: 키링)", max: 40 },
];

/** 위시맵·거래·교환 공통 검색 — 동네 | 닉네임 | 아이템 중 하나를 골라 검색창 하나로 찾는다 */
export default function LocalSearch({ regions, mode: initialMode = "region", value = "", onRegion, onNickname, onItem }: LocalSearchProps) {
  const id = useId();
  const [mode, setMode] = useState<LocalSearchMode>(initialMode);
  const [text, setText] = useState(value);
  const [notFound, setNotFound] = useState(false);
  const current = MODES.find((item) => item.value === mode)!;
  const keyword = text.trim();
  const matches = mode === "region" && keyword ? regions.filter((region) => region.fullName.includes(keyword)).slice(0, 6) : [];
  const pick = (code: string) => { onRegion(code); setText(""); setNotFound(false); };

  function submit() {
    if (!keyword) return;
    if (mode === "nickname") onNickname(keyword);
    else if (mode === "item") onItem(keyword);
    else if (matches[0]) pick(matches[0].code);
    else setNotFound(true);
  }

  return <form role="search" aria-label="동네·닉네임·아이템 찾기" className="flex w-full min-w-0 gap-1.5 sm:w-auto"
    onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <div role="group" aria-label="찾는 방법" className="segmented h-11 text-xs font-bold">
      {MODES.map((item) => <button key={item.value} type="button" aria-pressed={mode === item.value}
        onClick={() => { setMode(item.value); setText(""); setNotFound(false); }}>{item.label}</button>)}
    </div>
    <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
      <label htmlFor={id} className="sr-only">{current.label} 검색</label>
      <input id={id} value={text} onChange={(event) => { setText(event.target.value.slice(0, current.max)); setNotFound(false); }}
        placeholder={current.placeholder} autoComplete="off" enterKeyHint="search"
        onKeyDown={(event) => { if (event.key === "Escape") setText(""); }} className={localInput} />
      {matches.length > 0 && <ul aria-label="동네 검색 결과" className="pixel-panel absolute inset-x-0 top-full z-20 mt-1 overflow-hidden">
        {matches.map((region) => <li key={region.code}>
          <button type="button" onClick={() => pick(region.code)} className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2">{region.fullName}</button>
        </li>)}
      </ul>}
      {notFound && <p role="status" className="absolute left-0 top-full z-20 mt-1 rounded bg-night px-2 py-1 text-xs text-pink">없는 동네예요.</p>}
    </div>
    <button type="submit" disabled={!keyword} className="btn-lime h-11 shrink-0 px-3 text-sm font-bold disabled:opacity-50">찾기</button>
  </form>;
}
