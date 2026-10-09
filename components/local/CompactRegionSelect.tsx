"use client";

import { useId, useState } from "react";
import type { ApiRegion } from "@/types/api";

interface CompactRegionSelectProps {
  regions: ApiRegion[];
  value: string | null;
  onChange: (code: string | null) => void;
  /** 저장한 내 동네 — "내 동네" 바로가기 */
  ownRegion?: string | null;
  disabled?: boolean;
}

const MAX_SUGGESTIONS = 8;

/**
 * 지역을 이름으로 찾아 고르는 한 줄 입력 — 전국 단위로 지역이 늘어도 긴 목록을 훑지 않게.
 * 지금은 받아 둔 지역 목록에서 거르고, 지역이 많아지면 이 컴포넌트만 서버 검색(/api/regions?q=)으로 바꾸면 된다.
 */
export default function CompactRegionSelect({ regions, value, onChange, ownRegion = null, disabled = false }: CompactRegionSelectProps) {
  const id = useId();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const current = regions.find((region) => region.code === value);
  const keyword = text.trim();
  const matches = keyword
    ? regions.filter((region) => region.fullName.includes(keyword) || region.name.includes(keyword)).slice(0, MAX_SUGGESTIONS)
    : [];
  const pick = (code: string | null) => { onChange(code); setText(""); setEditing(false); setOpen(false); setNotFound(false); };
  // 찾기 버튼·Enter — 첫 번째로 맞는 동네로, 없으면 알려 준다
  const search = () => { if (matches[0]) pick(matches[0].code); else if (keyword) setNotFound(true); };

  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <div className="relative min-w-0 flex-[1_1_12rem]">
      <label htmlFor={id} className="sr-only">동네 검색</label>
      {/* 고른 동네는 실제 글자로 보여 준다 — 누르면 전체 선택돼 바로 고쳐 쓰거나 지울 수 있게 */}
      <input id={id} value={editing ? text : current?.fullName ?? ""} disabled={disabled} autoComplete="off" role="combobox" aria-expanded={open && matches.length > 0}
        aria-controls={`${id}-list`} placeholder="동네 이름으로 찾기 (예: 판교)"
        onChange={(event) => { setText(event.target.value.slice(0, 20)); setEditing(true); setOpen(true); setNotFound(false); }}
        onFocus={(event) => { setText(current?.fullName ?? ""); setEditing(true); setOpen(true); event.currentTarget.select(); }}
        onBlur={() => setTimeout(() => { setOpen(false); setEditing(false); }, 120)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); search(); }
          if (event.key === "Escape") { setText(""); setOpen(false); event.currentTarget.blur(); }
        }}
        className="pixel-input h-10 w-full min-w-0 py-0 pl-3 pr-9 text-xs font-bold text-ink" />
      {current && !disabled && <button type="button" aria-label="지역 선택 지우기" title="지역 선택 지우기" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(null)}
        className="absolute inset-y-0 right-1.5 my-auto grid size-7 place-items-center rounded text-sm text-dim hover:bg-panel-2 hover:text-ink">✕</button>}
      {open && matches.length > 0 && <ul id={`${id}-list`} role="listbox" className="pixel-panel absolute inset-x-0 top-full z-20 mt-1 overflow-hidden py-1">
        {matches.map((region) => <li key={region.code} role="option" aria-selected={region.code === value}>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(region.code)}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2">{region.fullName}</button>
        </li>)}
      </ul>}
      {notFound && <p role="status" className="absolute left-0 top-full z-20 mt-1 rounded bg-night px-2 py-1 text-xs text-pink">없는 동네예요. 다른 이름으로 찾아 보세요.</p>}
    </div>
    <button type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={search} className="btn-lime h-10 shrink-0 px-3 text-xs font-bold">찾기</button>
    {ownRegion && <button type="button" disabled={disabled} aria-pressed={value === ownRegion} onClick={() => pick(ownRegion)}
      className="btn-pixel toggle-outline h-10 shrink-0 px-3 text-xs font-bold text-sub hover:text-ink">내 동네</button>}
    <button type="button" disabled={disabled} aria-pressed={value === null} onClick={() => pick(null)}
      className="btn-pixel toggle-outline h-10 shrink-0 px-3 text-xs font-bold text-sub hover:text-ink">전체 지역</button>
  </div>;
}
