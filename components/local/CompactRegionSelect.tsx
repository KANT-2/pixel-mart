"use client";

import { useId } from "react";
import type { ApiRegion } from "@/types/api";

interface CompactRegionSelectProps {
  regions: ApiRegion[];
  value: string | null;
  onChange: (code: string | null) => void;
  disabled?: boolean;
}

/** 시 › 구 › 동·생활권을 한 칸짜리 선택으로 — 도구 막대처럼 좁은 곳용 (GPS 없이 직접 선택) */
export default function CompactRegionSelect({ regions, value, onChange, disabled = false }: CompactRegionSelectProps) {
  const id = useId();
  const cities = regions.filter((region) => region.level === "sido");
  const childrenOf = (code: string) => regions.filter((region) => region.parentCode === code);
  return <div className="relative min-w-0">
    <label htmlFor={id} className="sr-only">지역</label>
    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm">📍</span>
    <select id={id} value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value || null)}
      className="pixel-input h-10 w-full min-w-0 py-0 pl-9 pr-3 text-xs font-bold text-ink focus-visible:outline-2 focus-visible:outline-mint">
      <option value="">전체 지역</option>
      {cities.map((city) => <optgroup key={city.code} label={city.name}>
        <option value={city.code}>{city.name} 전체</option>
        {childrenOf(city.code).flatMap((district) => [
          <option key={district.code} value={district.code}>{district.name}</option>,
          ...childrenOf(district.code).map((zone) => <option key={zone.code} value={zone.code}>{district.name} › {zone.name}</option>),
        ])}
      </optgroup>)}
    </select>
  </div>;
}
