"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TradeStatus } from "@/types/api";
import { localButton } from "@/components/local/LocalStates";

interface TradeStatusButtonsProps { status: TradeStatus; disabled: boolean; pending: boolean; onConfirm: (status: "done" | "hidden") => Promise<void>; }
export default function TradeStatusButtons({ status, disabled, pending, onConfirm }: TradeStatusButtonsProps) {
  const [target, setTarget] = useState<"done" | "hidden" | null>(null);
  const confirm = useRef<HTMLButtonElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  useEffect(() => { if (target) confirm.current?.focus(); }, [target]);
  function cancel() { if (!disabled) { setTarget(null); requestAnimationFrame(() => trigger.current?.focus()); } }
  if (status === "hidden") return null;
  return <div className="mt-4 border-t border-line pt-4" onKeyDown={(event) => { if (event.key === "Escape" && target) { event.preventDefault(); cancel(); } }}>
    <div className="flex flex-wrap gap-2">{status === "open" && <button type="button" disabled={disabled || Boolean(target)} onClick={(event) => { trigger.current = event.currentTarget; setTarget("done"); }} className={localButton}>거래 완료</button>}
      <button type="button" disabled={disabled || Boolean(target)} onClick={(event) => { trigger.current = event.currentTarget; setTarget("hidden"); }} className={localButton}>숨기기</button>
    </div>
    {target && <div role="group" aria-labelledby={id} className="mt-3 rounded-lg bg-panel-2 p-4"><p id={id} className="text-sm font-bold">{target === "done" ? "거래를 완료할까요?" : "이 글을 숨길까요?"}</p><p className="mt-2 text-xs text-sub">게시판과 매칭에서 빠지고 내 글에는 기록이 남아요.</p>
      <div className="mt-3 flex gap-2"><button ref={confirm} type="button" disabled={disabled} onClick={() => void onConfirm(target)} className={localButton}>{pending ? "처리 중…" : "확인"}</button><button type="button" disabled={disabled} onClick={cancel} className={localButton}>취소</button></div>
    </div>}
  </div>;
}
