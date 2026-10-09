"use client";

import { useId } from "react";
import type { ApiRegion, RegionLevel } from "@/types/api";
import { changeRegion, regionPath } from "@/utils/local";
import { localInput } from "@/components/local/LocalStates";

interface RegionSelectorProps { regions: ApiRegion[]; value: string | null; onChange: (code: string | null) => void; disabled?: boolean; }
const steps: { level: RegionLevel; label: string }[] = [{ level: "sido", label: "시" }, { level: "sigungu", label: "구" }, { level: "zone", label: "동·생활권" }];

export default function RegionSelector({ regions, value, onChange, disabled = false }: RegionSelectorProps) {
  const id = useId();
  const path = regionPath(regions, value);
  return <div className="grid min-w-0 gap-3 sm:grid-cols-3">
    {steps.map(({ level, label }, index) => {
      const parent = path.find((region) => region.level === steps[index - 1]?.level);
      const options = regions.filter((region) => region.level === level && region.parentCode === (parent?.code ?? null));
      return <label key={level} htmlFor={`${id}-${level}`} className="min-w-0 text-sm font-semibold">
        <span className="mb-2 block text-sub">{label}</span>
        <select id={`${id}-${level}`} aria-label={label} value={path.find((region) => region.level === level)?.code ?? ""}
          disabled={disabled || (index > 0 && !parent)} onChange={(event) => onChange(changeRegion(regions, value, level, event.target.value))} className={localInput}>
          <option value="">{index === 0 ? "시 선택" : `${label} 전체`}</option>
          {options.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
        </select>
      </label>;
    })}
  </div>;
}
