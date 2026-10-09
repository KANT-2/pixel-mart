"use client";

import { useEffect, useId, useRef, useState } from "react";
import { INTEREST_TYPES, interestLabel } from "@/utils/local";
import type { ApiInterest, InterestType } from "@/types/api";

interface InterestFilterProps {
  interests: ApiInterest[];
  /** 칩으로 바로 보여 줄 취향 — 내 취향(없으면 동네 인기 취향) */
  quick: ApiInterest[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}

const chip = "btn-pixel toggle-outline h-9 shrink-0 px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const chipState = "text-sub hover:text-ink aria-pressed:border-lime aria-pressed:text-lime";

/** 취향이 늘어나도 한 줄을 넘지 않게: 칩은 몇 개만, 나머지는 검색·종류별 목록 패널에서 고른다 */
export default function InterestFilter({ interests, quick, selected, onSelect }: InterestFilterProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<InterestType | "all">("all");
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  // 화면에는 이름만, 종류(캐릭터·작품 등)는 툴팁·스크린리더 이름으로
  const name = (item: ApiInterest) => item.name;
  const full = (item: ApiInterest) => interestLabel(item);
  const current = interests.find((item) => item.id === selected);
  const chips = [...quick.slice(0, 5)];
  if (current && !chips.some((item) => item.id === current.id)) chips.push(current);
  const keyword = text.trim();
  const list = interests.filter((item) => (type === "all" || item.type === type) && (!keyword || item.name.includes(keyword)));
  const pick = (id: number | null) => { onSelect(id); setOpen(false); setText(""); };

  return <div ref={root} className="relative mb-3">
    <div role="group" aria-label="취향 필터" className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => pick(null)} aria-pressed={selected === null} className={`${chip} ${chipState}`}>전체 · 동네 인기 취향</button>
      {chips.map((item) => <button key={item.id} type="button" onClick={() => pick(item.id)} aria-pressed={selected === item.id}
        title={full(item)} aria-label={full(item)} className={`${chip} ${chipState}`}>{name(item)}</button>)}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={panelId}
        className={`${chip} text-ink`}>
        취향 찾기{interests.length ? ` · ${interests.length}` : ""}
      </button>
    </div>
    {open && <div id={panelId} role="dialog" aria-label="취향 찾기" className="pixel-panel absolute inset-x-0 top-full z-30 mt-2 p-4 sm:right-auto sm:w-[28rem]">
      <label htmlFor={`${panelId}-search`} className="sr-only">취향 이름 검색</label>
      <form role="search" aria-label="취향 이름 찾기" className="flex gap-1.5" onSubmit={(event) => { event.preventDefault(); if (list[0]) pick(list[0].id); }}>
        <input ref={search} id={`${panelId}-search`} value={text} onChange={(event) => setText(event.target.value.slice(0, 30))} enterKeyHint="search"
          placeholder="캐릭터·작품·스타일 이름" autoComplete="off" className="pixel-input min-h-11 min-w-0 flex-1 px-3 text-sm text-ink" />
        <button type="submit" disabled={!text.trim() || !list.length} className="btn-lime min-h-11 shrink-0 px-3 text-sm font-bold disabled:opacity-50">찾기</button>
      </form>
      <div role="tablist" aria-label="취향 종류" className="mt-3 flex flex-wrap gap-1.5">
        {[{ value: "all" as const, label: "전체" }, ...INTEREST_TYPES].map((item) => <button key={item.value} type="button" role="tab"
          aria-selected={type === item.value} onClick={() => setType(item.value)}
          className="btn-pixel h-8 px-2.5 text-xs font-bold text-sub hover:text-ink">{item.label}</button>)}
      </div>
      <ul className="mt-3 grid max-h-60 grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-3">
        {list.map((item) => <li key={item.id}>
          <button type="button" onClick={() => pick(item.id)} aria-pressed={selected === item.id} title={full(item)} aria-label={full(item)}
            className="w-full truncate rounded-md border-2 border-frame bg-night px-2.5 py-2 text-left text-sm hover:border-violet aria-pressed:border-lime aria-pressed:text-lime">
            {name(item)}
          </button>
        </li>)}
        {!list.length && <li className="col-span-full py-6 text-center text-sm text-dim">&lsquo;{keyword}&rsquo;에 맞는 취향이 없어요</li>}
      </ul>
    </div>}
  </div>;
}
