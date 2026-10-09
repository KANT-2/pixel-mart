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
  const [open, setOpen] = useState(false);
  const current = regions.find((region) => region.code === value);
  const keyword = text.trim();
  const matches = keyword
    ? regions.filter((region) => region.fullName.includes(keyword) || region.name.includes(keyword)).slice(0, MAX_SUGGESTIONS)
    : [];
  const pick = (code: string | null) => { onChange(code); setText(""); setOpen(false); };

  return <div className="flex min-w-0 flex-wrap items-center gap-2">
    <div className="relative min-w-0 flex-[1_1_12rem]">
      <label htmlFor={id} className="sr-only">동네 검색</label>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm">📍</span>
      <input id={id} value={text} disabled={disabled} autoComplete="off" role="combobox" aria-expanded={open && matches.length > 0}
        aria-controls={`${id}-list`} placeholder={current ? current.fullName : "동네 이름으로 찾기 (예: 판교)"}
        onChange={(event) => { setText(event.target.value.slice(0, 20)); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && matches[0]) { event.preventDefault(); pick(matches[0].code); }
          if (event.key === "Escape") { setText(""); setOpen(false); }
        }}
        className={`pixel-input h-10 w-full min-w-0 py-0 pl-9 pr-3 text-xs font-bold text-ink ${current ? "placeholder:text-ink" : ""}`} />
      {open && matches.length > 0 && <ul id={`${id}-list`} role="listbox" className="pixel-panel absolute inset-x-0 top-full z-20 mt-1 overflow-hidden py-1">
        {matches.map((region) => <li key={region.code} role="option" aria-selected={region.code === value}>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(region.code)}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2">{region.fullName}</button>
        </li>)}
      </ul>}
    </div>
    {ownRegion && <button type="button" disabled={disabled} aria-pressed={value === ownRegion} onClick={() => pick(ownRegion)}
      className="h-10 shrink-0 btn-pixel px-3 text-xs font-bold text-sub hover:text-ink aria-pressed:border-lime aria-pressed:text-lime">🏠 내 동네</button>}
    <button type="button" disabled={disabled} aria-pressed={value === null} onClick={() => pick(null)}
      className="h-10 shrink-0 btn-pixel px-3 text-xs font-bold text-sub hover:text-ink aria-pressed:border-lime aria-pressed:text-lime">전체 지역</button>
  </div>;
}
