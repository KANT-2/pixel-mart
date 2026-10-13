"use client";

import { useCallback, useState } from "react";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, LocalSkeleton } from "@/components/local/LocalStates";
import { ApiError } from "@/lib/api";
import { localApi } from "@/lib/local";
import { formatDate } from "@/utils/formatDate";
import type { ApiTradePost, ApiTradeRequest, TradeRequestStatus } from "@/types/api";

const STATUS: Record<TradeRequestStatus, { label: string; tone: string }> = {
  pending: { label: "대기 중", tone: "border-lime/50 text-lime" },
  accepted: { label: "교환 성사", tone: "border-mint/50 text-mint" },
  declined: { label: "거절됨", tone: "border-line text-dim" },
  cancelled: { label: "취소됨", tone: "border-line text-dim" },
};

interface TradeRequestInboxProps {
  /** 수락하면 내 글 상태가 바뀌므로 위쪽 목록도 다시 불러온다 */
  onChanged: () => void;
}

/** 내 거래 — 받은 교환 신청(수락·거절)과 보낸 교환 신청(취소) */
export default function TradeRequestInbox({ onChanged }: TradeRequestInboxProps) {
  const [box, setBox] = useState<"received" | "sent">("received");
  const load = useCallback((signal: AbortSignal) => localApi.tradeRequests(box, signal), [box]);
  const result = useLocalResource(load);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function answer(request: ApiTradeRequest, action: "accept" | "decline" | "cancel") {
    if (busy !== null) return;
    setBusy(request.id); setMessage(null);
    try {
      await localApi.answerRequest(request.id, action);
      setMessage({ text: action === "accept" ? "교환을 수락했어요. 두 글이 거래 완료로 바뀌었어요." : action === "decline" ? "신청을 거절했어요." : "신청을 취소했어요.", error: false });
      await result.refresh();
      if (action === "accept") onChanged();
    } catch (cause) {
      setMessage({ text: cause instanceof ApiError ? cause.message : "처리하지 못했어요. 다시 시도해 주세요.", error: true });
    } finally { setBusy(null); }
  }

  const pendingCount = box === "received" ? result.data?.filter((request) => request.status === "pending").length ?? 0 : 0;
  return <section id="trade-requests" aria-labelledby="trade-requests-title" className="scroll-mt-28">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h2 id="trade-requests-title" className="text-xl font-bold">⇄ 교환 신청{pendingCount > 0 && <span className="ml-2 rounded bg-lime px-1.5 py-0.5 align-middle text-xs text-lime-ink">{pendingCount}</span>}</h2>
      <div role="tablist" aria-label="교환 신청함" className="flex gap-1">
        {(["received", "sent"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={box === item} onClick={() => { setBox(item); setMessage(null); }}
          className={`${box === item ? "btn-lime text-lime-ink" : "btn-pixel text-sub"} h-9 px-3 text-sm font-bold`}>{item === "received" ? "받은 신청" : "보낸 신청"}</button>)}
      </div>
    </div>
    {message && <p role={message.error ? "alert" : "status"} className={`mb-3 text-sm ${message.error ? "text-pink" : "text-mint"}`}>{message.text}</p>}
    {result.error ? <LocalError message={result.error} onRetry={() => void result.refresh()} busy={busy !== null} />
      : result.loading || !result.data ? <LocalSkeleton label="교환 신청 불러오는 중" />
      : result.data.length === 0 ? <div className="pixel-panel p-6 text-center text-sm text-sub">{box === "received" ? "아직 받은 교환 신청이 없어요." : "아직 보낸 교환 신청이 없어요. 거래·교환 게시판에서 이웃 글에 신청해 보세요."}</div>
      : <ul className="grid gap-3 lg:grid-cols-2">{result.data.map((request) => <li key={request.id} className="pixel-panel flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded border px-1.5 py-0.5 font-bold ${STATUS[request.status].tone}`}>{STATUS[request.status].label}</span>
          <span className="text-dim">{box === "received" ? <>{request.requester?.nickname ?? "이웃 플레이어"}님이 신청</> : "내가 신청"} · {formatDate(request.createdAt)}</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <Item label={box === "received" ? "상대가 보낸 글" : "내가 보낸 글"} post={request.offerPost} />
          <span aria-hidden="true" className="font-pixel text-lg text-lime">⇄</span>
          <Item label={box === "received" ? "내 글" : "이웃 글"} post={request.post} />
        </div>
        {request.status === "pending" && <div className="flex gap-2">
          {box === "received" ? <>
            <button type="button" disabled={busy !== null} onClick={() => void answer(request, "accept")} className="btn-lime h-10 flex-1 text-sm font-bold text-lime-ink disabled:opacity-50">{busy === request.id ? "처리 중…" : "수락"}</button>
            <button type="button" disabled={busy !== null} onClick={() => void answer(request, "decline")} className="btn-pixel h-10 flex-1 text-sm font-bold text-sub disabled:opacity-50">거절</button>
          </> : <button type="button" disabled={busy !== null} onClick={() => void answer(request, "cancel")} className="btn-pixel h-10 flex-1 text-sm font-bold text-sub disabled:opacity-50">{busy === request.id ? "처리 중…" : "신청 취소"}</button>}
        </div>}
      </li>)}</ul>}
  </section>;
}

function Item({ label, post }: { label: string; post: ApiTradePost | null }) {
  return <div className="flex min-w-0 items-center gap-2 rounded-md border-2 border-frame bg-night/60 p-2">
    {/* eslint-disable-next-line @next/next/no-img-element -- 연결 상품 이미지 또는 픽셀 보물상자 */}
    <img src={post?.product?.imageUrl ?? "/images/hero-chest.svg"} alt="" className={post?.product ? "size-10 shrink-0 rounded object-cover" : "size-10 shrink-0 p-1.5 [image-rendering:pixelated]"} />
    <span className="min-w-0">
      <span className="block text-[10px] text-dim">{label}</span>
      <span className="block truncate text-sm font-bold">{post?.itemName ?? "글 없이 신청"}</span>
    </span>
  </div>;
}
