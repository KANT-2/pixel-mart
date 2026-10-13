"use client";

import { useCallback, useState } from "react";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, LocalSkeleton } from "@/components/local/LocalStates";
import { ExchangeDialog, TradeProgress } from "@/components/local/TradeExchange";
import { localApi } from "@/lib/local";
import { formatDate } from "@/utils/formatDate";
import type { ApiTradePost, ApiTradeRequest, TradeRequestStatus } from "@/types/api";

const STATUS: Record<TradeRequestStatus, { label: string; tone: string }> = {
  pending: { label: "대기 중", tone: "border-lime/50 text-lime" },
  accepted: { label: "교환 진행 중", tone: "border-lime/50 text-lime" },
  completed: { label: "교환 완료", tone: "border-mint/50 text-mint" },
  declined: { label: "거절됨", tone: "border-line text-dim" },
  cancelled: { label: "취소됨", tone: "border-line text-dim" },
};

interface TradeRequestInboxProps {
  /** 수락하면 내 글 상태가 바뀌므로 위쪽 목록도 다시 불러온다 */
  onChanged: () => void;
}

/** 내 거래 — 받은 교환 신청과 보낸 교환 신청. 수락·거절·받았어요는 교환 창에서 */
export default function TradeRequestInbox({ onChanged }: TradeRequestInboxProps) {
  const [box, setBox] = useState<"received" | "sent">("received");
  const load = useCallback((signal: AbortSignal) => localApi.tradeRequests(box, signal), [box]);
  const result = useLocalResource(load);
  const [opened, setOpened] = useState<ApiTradeRequest | null>(null);
  const close = useCallback(() => setOpened(null), []);

  async function changed(next: ApiTradeRequest) {
    setOpened(next);
    await result.refresh();
    // 수락·완료되면 내 글 상태도 바뀌므로 위쪽 목록도 다시
    if (next.status === "accepted" || next.status === "completed") onChanged();
  }

  const pendingCount = box === "received" ? result.data?.filter((request) => request.status === "pending").length ?? 0 : 0;
  return <section id="trade-requests" aria-labelledby="trade-requests-title" className="scroll-mt-28">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <h2 id="trade-requests-title" className="text-xl font-bold">⇄ 교환 신청{pendingCount > 0 && <span className="ml-2 rounded bg-lime px-1.5 py-0.5 align-middle text-xs text-lime-ink">{pendingCount}</span>}</h2>
      <div role="tablist" aria-label="교환 신청함" className="flex gap-1">
        {(["received", "sent"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={box === item} onClick={() => setBox(item)}
          className={`${box === item ? "btn-lime text-lime-ink" : "btn-pixel text-sub"} h-9 px-3 text-sm font-bold`}>{item === "received" ? "받은 신청" : "보낸 신청"}</button>)}
      </div>
    </div>
    {result.error ? <LocalError message={result.error} onRetry={() => void result.refresh()} />
      : !result.data ? <LocalSkeleton label="교환 신청 불러오는 중" />
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
        <button type="button" onClick={() => setOpened(request)} aria-haspopup="dialog"
          className={`${needsMe(request) ? "btn-lime text-lime-ink" : "btn-pixel text-sub"} h-10 w-full text-sm font-bold`}>
          {actionLabel(request)}
        </button>
      </li>)}</ul>}
    {opened && <ExchangeDialog title={opened.post.itemName} onClose={close}><TradeProgress request={opened} onChanged={(next) => void changed(next)} /></ExchangeDialog>}
  </section>;
}

/** 내가 눌러야 할 일이 남았는지 — 받은 신청 수락·거절, 교환 진행 중 받았어요 */
function needsMe(request: ApiTradeRequest): boolean {
  return (request.status === "pending" && !request.isMine) || (request.status === "accepted" && !request.receivedByMe);
}

function actionLabel(request: ApiTradeRequest): string {
  if (request.status === "pending") return request.isMine ? "교환 창 보기 · 신청 취소" : "교환 창 열기 · 수락/거절";
  if (request.status === "accepted") return request.receivedByMe ? "교환 창 보기 · 상대 확인 기다리는 중" : "교환 창 열기 · 받았어요";
  return "교환 창 보기";
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
