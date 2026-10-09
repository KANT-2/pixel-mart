"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ApiNicknameCheck } from "@/types/api";

export type NicknameStatus = "empty" | "same" | "checking" | "available" | "taken" | "error";

interface NicknameFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** 지금 쓰는 내 닉네임 (마이페이지) — 같으면 확인하지 않는다 */
  current?: string;
  disabled?: boolean;
  /** 확인 상태가 바뀔 때 — 저장 버튼 막기용 */
  onStatus?: (status: NicknameStatus) => void;
  /** 서버가 409로 거절한 닉네임 (입력을 바꾸기 전까지 사용 중으로 표시) */
  rejected?: string | null;
  placeholder?: string;
}

const BADGE: Record<NicknameStatus, { text: string; tone: string }> = {
  empty: { text: "", tone: "" },
  same: { text: "지금 이름", tone: "border-line text-dim" },
  checking: { text: "확인 중…", tone: "border-line text-dim" },
  available: { text: "✓ 사용 가능", tone: "border-lime/60 text-lime" },
  taken: { text: "✕ 사용 중", tone: "border-pink/60 text-pink" },
  error: { text: "확인 실패", tone: "border-line text-dim" },
};

/** 닉네임 입력 + 실시간 중복 확인 + 겹치면 추천 닉네임 칩 (누르면 입력창에 반영) */
export default function NicknameField({ id, value, onChange, current, disabled, onStatus, rejected, placeholder }: NicknameFieldProps) {
  const [result, setResult] = useState<{ nickname: string; data: ApiNicknameCheck | null } | null>(null);
  const trimmed = value.trim();
  const same = Boolean(current) && trimmed.toLowerCase() === current?.toLowerCase();

  useEffect(() => {
    if (!trimmed || same) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api.get<ApiNicknameCheck>(`/users/nickname-check?${new URLSearchParams({ nickname: trimmed })}`, { cache: "no-store", signal: controller.signal })
        .then((data) => setResult({ nickname: trimmed, data }))
        .catch(() => { if (!controller.signal.aborted) setResult({ nickname: trimmed, data: null }); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [trimmed, same]);

  const fresh = result?.nickname === trimmed ? result : null;
  const status: NicknameStatus = !trimmed ? "empty" : same ? "same"
    : rejected && rejected.toLowerCase() === trimmed.toLowerCase() ? "taken"
      : !fresh ? "checking" : !fresh.data ? "error" : fresh.data.available ? "available" : "taken";
  useEffect(() => { onStatus?.(status); }, [status, onStatus]);

  const suggestions = status === "taken" ? fresh?.data?.suggestions ?? [] : [];
  const badge = BADGE[status];
  return <div>
    <div className="relative">
      <input id={id} value={value} maxLength={30} autoComplete="nickname" disabled={disabled} placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-status`} aria-invalid={status === "taken"}
        className={`pixel-input h-11 w-full px-3 pr-28 text-ink ${status === "taken" ? "border-pink/70" : ""}`} />
      {badge.text && <span aria-hidden="true" className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border-2 bg-night px-1.5 py-0.5 text-[11px] font-bold ${badge.tone}`}>{badge.text}</span>}
    </div>
    <p id={`${id}-status`} role="status" aria-live="polite" className={`mt-1.5 min-h-4 text-xs ${status === "taken" ? "font-bold text-pink" : status === "available" ? "text-lime" : "text-dim"}`}>
      {status === "taken" ? "이미 사용 중인 닉네임입니다." : status === "available" ? "사용할 수 있는 닉네임이에요." : status === "error" ? "중복 확인을 하지 못했어요. 저장할 때 다시 확인해요." : status === "empty" ? "1~30자, 다른 플레이어와 겹칠 수 없어요 (대소문자 구분 없음)." : ""}
    </p>
    {suggestions.length > 0 && <div className="mt-2">
      <p className="mb-1.5 text-xs text-sub">이런 닉네임은 어때요? 누르면 바로 넣어 드려요.</p>
      <ul aria-label="추천 닉네임" className="flex flex-wrap gap-1.5">
        {suggestions.map((name) => <li key={name}>
          <button type="button" disabled={disabled} onClick={() => onChange(name)} className="btn-pixel h-9 px-3 text-sm font-bold text-mint hover:text-ink">{name}</button>
        </li>)}
      </ul>
    </div>}
  </div>;
}
