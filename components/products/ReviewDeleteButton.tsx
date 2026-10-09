"use client";

import { useEffect, useId, useRef, useState } from "react";

interface ReviewDeleteButtonProps { disabled: boolean; pending: boolean; onConfirm: () => Promise<void>; }

export default function ReviewDeleteButton({ disabled, pending, onConfirm }: ReviewDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const id = useId();
  useEffect(() => {
    if (confirming) confirm.current?.focus();
    else if (returnFocus.current) { trigger.current?.focus(); returnFocus.current = false; }
  }, [confirming]);
  function cancel() { if (!disabled) { returnFocus.current = true; setConfirming(false); } }
  const buttonClass = "min-h-11 rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
  return <div className="mt-4" onKeyDown={(event) => { if (event.key === "Escape" && confirming) { event.preventDefault(); cancel(); } }}>
    <button ref={trigger} type="button" aria-label="내 리뷰 삭제" aria-expanded={confirming} aria-controls={confirming ? id : undefined} disabled={disabled || confirming} onClick={() => setConfirming(true)} className={`${buttonClass} text-sub`}>삭제</button>
    {confirming && <div id={id} role="group" aria-labelledby={`${id}-question`} className="mt-3 rounded-lg border border-pink/30 bg-panel-2 p-4">
      <p id={`${id}-question`} className="text-sm font-bold">정말 삭제할까요?</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button ref={confirm} type="button" disabled={disabled} onClick={() => void onConfirm()} className={`${buttonClass} text-pink`}>{pending ? "삭제 중…" : "확인"}</button>
        <button type="button" disabled={disabled} onClick={cancel} className={`${buttonClass} text-sub`}>취소</button>
      </div>
    </div>}
  </div>;
}
