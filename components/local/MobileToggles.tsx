"use client";

import { useState, type ReactNode } from "react";
import { localButton } from "@/components/local/LocalStates";

interface SearchToggleProps { open: boolean; onToggle: () => void; }

/** 모바일에서만 보이는 검색 열기 버튼 — 검색 줄은 누를 때만 펼친다 (sm 이상은 늘 보임) */
export function SearchToggle({ open, onToggle }: SearchToggleProps) {
  return <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? "검색 닫기" : "검색 열기"}
    className={`${localButton} shrink-0 px-3 sm:hidden`}>
    <span aria-hidden="true">{open ? "✕" : "⌕"}</span><span className="ml-1 text-xs">검색</span>
  </button>;
}

/** 검색 줄 — 모바일에서는 open일 때만, sm 이상은 늘 */
export const searchRow = (open: boolean) => `${open ? "flex" : "hidden"} w-full min-w-0 gap-2 sm:flex sm:w-auto`;

interface MapNotesProps { children: ReactNode; className?: string; }

/** 지도 안내 문구 — 모바일에서는 ⓘ를 눌러 펼친다 */
export function MapNotes({ children, className = "" }: MapNotesProps) {
  const [open, setOpen] = useState(false);
  return <div className={className}>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}
      className="flex min-h-8 items-center gap-1 text-xs text-sub underline-offset-2 hover:underline sm:hidden">
      <span aria-hidden="true">ⓘ</span>지도 안내 {open ? "접기" : "보기"}
    </button>
    <div className={`${open ? "block" : "hidden"} sm:block`}>{children}</div>
  </div>;
}
