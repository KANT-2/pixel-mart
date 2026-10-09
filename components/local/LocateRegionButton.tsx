"use client";

import { useId } from "react";
import { localButton } from "@/components/local/LocalStates";
import type { useRegionLocator } from "@/components/local/useRegionLocator";

interface LocateRegionButtonProps { label: "내 위치로 보기" | "내 위치로 찾기"; locator: ReturnType<typeof useRegionLocator>; onFound: (code: string) => void; disabled?: boolean; }
export default function LocateRegionButton({ label, locator, onFound, disabled = false }: LocateRegionButtonProps) {
  const id = useId();
  return <div className="space-y-2">
    <button type="button" onClick={() => locator.locate(onFound)} disabled={disabled || locator.busy || locator.denied} aria-describedby={id} className={localButton}>{locator.busy ? "위치 찾는 중…" : label}</button>
    <p id={id} className="text-xs leading-relaxed text-dim">누를 때만 위치 권한을 요청해요. 좌표는 브라우저에서만 사용하고 서버로 보내거나 저장하지 않아요.</p>
    <p role="status" className="text-sm leading-relaxed text-sub">{locator.message}</p>
  </div>;
}
