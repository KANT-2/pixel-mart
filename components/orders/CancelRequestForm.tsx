"use client";

import { useId, useState, type FormEvent } from "react";
import { validateCancelReason } from "@/utils/orders";

interface CancelRequestFormProps {
  busy: boolean;
  onSubmit: (reason: string) => Promise<void>;
}

const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint";

export default function CancelRequestForm({ busy, onSubmit }: CancelRequestFormProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmedReason, setConfirmedReason] = useState<string | null>(null);

  const prepare = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const validated = validateCancelReason(reason);
    if (validated.error) {
      setError(validated.error);
      return;
    }
    setError(null);
    setReason(validated.value);
    setConfirmedReason(validated.value);
  };

  return <section aria-labelledby={`${id}-title`} className="pixel-panel p-5 sm:p-6">
    <h2 id={`${id}-title`} className="text-lg font-extrabold">주문 취소</h2>
    <p className="mt-2 text-sm leading-relaxed text-sub">배송이 시작되기 전에는 취소를 신청할 수 있어요.</p>
    {!open ? <button type="button" disabled={busy} onClick={() => setOpen(true)} className={`mt-5 btn-pixel px-5 py-3 text-sm font-bold disabled:opacity-50 ${focusClass}`}>취소 신청</button> :
      <form onSubmit={prepare} noValidate className="mt-5 space-y-4">
        <div>
          <label htmlFor={`${id}-reason`} className="mb-2 block text-sm font-semibold">취소 사유</label>
          <textarea id={`${id}-reason`} value={reason} maxLength={200} rows={3} disabled={busy || confirmedReason !== null}
            aria-invalid={Boolean(error)} aria-describedby={`${id}-count${error ? ` ${id}-error` : ""}`}
            onChange={(event) => { setReason(event.target.value); setError(null); }} placeholder="취소 사유를 1~200자로 알려 주세요."
            className={`block w-full resize-y pixel-input px-3 py-3 text-sm leading-relaxed text-ink placeholder:text-dim disabled:opacity-70 ${focusClass}`} />
          <p id={`${id}-count`} className="mt-2 text-right text-xs text-dim">{Array.from(reason).length} / 200자</p>
          {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-pink">{error}</p>}
        </div>
        {confirmedReason === null ? <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={`rounded-lg border border-pink/30 bg-pink/10 px-5 py-3 text-sm font-bold text-pink disabled:opacity-50 ${focusClass}`}>사유 확인</button>
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className={`rounded-lg border border-line px-5 py-3 text-sm text-sub disabled:opacity-50 ${focusClass}`}>닫기</button>
        </div> : <div className="rounded-lg border border-pink/30 bg-panel-2 p-4">
          <p className="text-sm font-bold">이 사유로 취소를 신청할까요?</p>
          <p className="mt-2 text-sm leading-relaxed text-sub">신청이 접수되면 처리 결과를 이 화면에서 확인할 수 있어요.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => { void onSubmit(confirmedReason); }} className={`rounded-lg border border-pink/30 bg-pink/10 px-4 py-3 text-sm font-bold text-pink disabled:opacity-50 ${focusClass}`}>{busy ? "신청 중…" : "취소 신청 확인"}</button>
            <button type="button" disabled={busy} onClick={() => setConfirmedReason(null)} className={`rounded-lg border border-line px-4 py-3 text-sm text-sub disabled:opacity-50 ${focusClass}`}>사유 수정</button>
          </div>
        </div>}
      </form>}
  </section>;
}
