"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LocalError, LocalSkeleton } from "@/components/local/LocalStates";
import TradeCard from "@/components/local/TradeCard";
import { TraderPanel, postItem } from "@/components/local/TradeWindow";
import { useLocalResource } from "@/components/local/useLocalResource";
import { ApiError } from "@/lib/api";
import { localApi } from "@/lib/local";
import { formatPrice } from "@/utils/formatPrice";
import type { ApiTradePost, ApiTradeRequest } from "@/types/api";

/** 교환 진행 단계 — 신청 → 수락 → 교환 진행(서로 받았어요) → 완료 */
const STEPS = ["신청", "수락", "교환 진행", "완료"] as const;

function stepOf(request: ApiTradeRequest | null): number {
  if (!request) return -1;
  if (request.status === "completed") return 3;
  if (request.status === "accepted") return 2;
  return 0;
}

/** 화면 가운데 교환 창 — 바깥을 누르거나 Esc로 닫는다 */
export function ExchangeDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-night/80 p-3 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="pixel-panel flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b-2 border-frame bg-panel-2 px-4 py-2.5">
        <h2 id={titleId} className="font-pixel text-xs tracking-widest text-lime">⇄ TRADE · {title}</h2>
        <button type="button" onClick={onClose} aria-label="교환 창 닫기" autoFocus className="btn-pixel h-9 px-3 text-sm font-bold">✕</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  </div>;
}

function Stepper({ request }: { request: ApiTradeRequest | null }) {
  const current = stepOf(request);
  const ended = request?.status === "declined" || request?.status === "cancelled";
  return <ol aria-label="교환 진행 단계" className="flex items-center gap-1 px-3 pt-3 text-[11px] font-bold sm:px-4">
    {STEPS.map((label, index) => {
      const done = !ended && index <= current;
      return <li key={label} aria-current={!ended && index === current ? "step" : undefined} className="flex min-w-0 flex-1 items-center gap-1">
        <span className={`grid size-5 shrink-0 place-items-center rounded-full font-pixel ${done ? "bg-lime text-lime-ink" : "border border-line text-dim"}`}>{index + 1}</span>
        <span className={`truncate ${done ? "text-ink" : "text-dim"}`}>{label}</span>
        {index < STEPS.length - 1 && <span aria-hidden="true" className={`h-0.5 min-w-2 flex-1 ${done && index < current ? "bg-lime" : "bg-line"}`} />}
      </li>;
    })}
  </ol>;
}

interface TradeComposerProps {
  /** 교환하고 싶은 이웃의 글 */
  target: ApiTradePost;
  /** 신청을 보낸 뒤 — 창을 진행 화면으로 바꾸거나 목록을 다시 불러온다 */
  onSent: (request: ApiTradeRequest) => void;
}

/** 교환 신청 — 내 교환글(HAVE) 물건 중 하나를 골라 이웃의 물건과 맞바꾸자고 신청 */
export function TradeComposer({ target, onSent }: TradeComposerProps) {
  const { user } = useAuth();
  const load = useCallback((signal: AbortSignal) => localApi.myTrades(signal), []);
  const mine = useLocalResource(load);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const haves = (mine.data ?? []).filter((post) => post.kind === "have" && post.status === "open");
  const offer = picked === null ? null : haves[picked] ?? null;
  // 판매 글은 물건 없이 구매 신청도 된다
  const needsItem = target.kind !== "sell";

  async function send() {
    if (busy || (needsItem && !offer)) return;
    setBusy(true); setError(null);
    try {
      onSent(await localApi.requestTrade(target.id, offer?.id ?? null));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "교환 신청을 보내지 못했어요. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  if (mine.loading && !mine.data) return <div className="p-4"><LocalSkeleton label="내 교환글 불러오는 중" /></div>;
  if (mine.error && !mine.data) return <div className="p-4"><LocalError message={mine.error} onRetry={() => void mine.refresh()} /></div>;
  return <>
    <Stepper request={null} />
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 p-3 sm:gap-3 sm:p-4">
      <TraderPanel name={user?.nickname ?? "나"} subtitle={haves.length ? "나 · 보낼 물건 고르기" : "나 · 교환글 없음"} avatar={user?.avatarUrl ?? null} anonymous={false}
        item={null} active={false} onPick={() => undefined} items={haves.map(postItem)} selected={picked} onPickIndex={setPicked}
        priceLabel="보낼 물건" priceText={offer ? "1개" : "—"} flow="out" />
      <p aria-hidden="true" className="self-center font-pixel text-xl text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]">⇄</p>
      <TraderPanel name="이웃 플레이어" subtitle="같은 동네 · 받을 물건" avatar={null} anonymous item={postItem(target)} active={false} onPick={() => undefined}
        flow="in" priceText={target.price === null ? "가격 제안" : formatPrice(target.price)} />
    </div>
    <div className="space-y-3 border-t-2 border-frame bg-night/60 p-3 sm:p-4">
      {haves.length === 0 ? <div className="rounded-lg border border-line bg-panel p-4 text-sm">
        <p className="font-bold">교환하려면 내 물건을 먼저 교환글(HAVE)로 올려 주세요.</p>
        <p className="mt-1 text-xs text-sub">{needsItem ? "교환은 내가 올린 물건으로만 신청할 수 있어요." : "판매 글은 물건 없이 구매 신청도 할 수 있어요."}</p>
        <Link href="/local/trades/new?kind=have" className="btn-pixel mt-3 inline-flex h-9 items-center px-3 text-xs font-bold">내 물건 올리기 →</Link>
      </div> : <p className="text-xs text-sub">{offer ? <>보낼 물건: <b className="text-ink">{offer.itemName}</b></> : `왼쪽 칸에서 보낼 물건을 골라 주세요 · 내 교환글 ${haves.length}개`}</p>}
      <TradeCard post={offer ?? target} />
      <button type="button" onClick={() => void send()} disabled={busy || (needsItem && !offer)}
        className="btn-lime inline-flex h-11 w-full items-center justify-center text-sm font-bold text-lime-ink disabled:opacity-50">
        {busy ? "보내는 중…" : offer ? `⇄ ${offer.itemName}(으)로 교환 신청` : needsItem ? "보낼 물건을 골라 주세요" : "구매 신청"}
      </button>
      {error && <p role="alert" className="text-xs text-pink">{error}</p>}
      <p className="text-[11px] text-dim">채팅·연락처 없이 신청과 수락만 주고받아요. 상대가 수락하면 교환이 진행되고, 두 사람 모두 &lsquo;받았어요&rsquo;를 누르면 끝나요.</p>
    </div>
  </>;
}

interface TradeProgressProps {
  request: ApiTradeRequest;
  /** 상태가 바뀌면 — 바뀐 신청으로 창을 다시 그리고 목록도 새로 */
  onChanged: (request: ApiTradeRequest) => void;
}

/** 신청 하나의 교환 창 — 두 물건과 진행 단계, 내 차례 버튼 */
export function TradeProgress({ request, onChanged }: TradeProgressProps) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 신청한 쪽이면 내 물건은 함께 보낸 글, 받은 쪽이면 내 글
  const myPost = request.isMine ? request.offerPost : request.post;
  const theirPost = request.isMine ? request.post : request.offerPost;
  const theirName = request.isMine ? "이웃 플레이어" : request.requester?.nickname ?? "이웃 플레이어";

  async function act(action: "accept" | "decline" | "cancel" | "received") {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      onChanged(await localApi.answerRequest(request.id, action));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "처리하지 못했어요. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  const button = "inline-flex h-11 flex-1 items-center justify-center px-4 text-sm font-bold disabled:opacity-50";
  return <>
    <Stepper request={request} />
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 p-3 sm:gap-3 sm:p-4">
      <TraderPanel name={user?.nickname ?? "나"} subtitle={request.receivedByMe ? "나 · 받았어요 ✓" : "나 · 보낼 물건"} avatar={user?.avatarUrl ?? null} anonymous={false}
        item={myPost ? postItem(myPost) : null} active onPick={() => undefined} priceLabel="보냄" priceText={myPost ? "1개" : "구매 신청"} flow="out" />
      <p aria-hidden="true" className={`self-center font-pixel text-xl ${request.status === "completed" ? "text-mint" : "text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]"}`}>{request.status === "completed" ? "✓" : "⇄"}</p>
      <TraderPanel name={theirName} subtitle={request.receivedByThem ? "상대 · 받았어요 ✓" : "상대 · 받을 물건"} avatar={request.isMine ? null : request.requester?.avatarUrl ?? null}
        anonymous={request.isMine || !request.requester} item={theirPost ? postItem(theirPost) : null} active={false} onPick={() => undefined}
        priceLabel="받음" priceText={theirPost ? "1개" : "—"} flow="in" />
    </div>
    <div className="space-y-3 border-t-2 border-frame bg-night/60 p-3 sm:p-4">
      <Status request={request} />
      {request.status === "pending" && <div className="flex gap-2">
        {request.isMine
          ? <button type="button" disabled={busy} onClick={() => void act("cancel")} className={`btn-pixel text-sub ${button}`}>{busy ? "처리 중…" : "신청 취소하기"}</button>
          : <>
            <button type="button" disabled={busy} onClick={() => void act("accept")} className={`btn-lime text-lime-ink ${button}`}>{busy ? "처리 중…" : "수락하고 교환 시작"}</button>
            <button type="button" disabled={busy} onClick={() => void act("decline")} className={`btn-pixel text-sub ${button}`}>거절</button>
          </>}
      </div>}
      {request.status === "accepted" && (request.receivedByMe
        ? <p className="rounded-lg border border-mint/40 bg-panel p-3 text-sm text-mint">받았다고 알렸어요. 상대가 &lsquo;받았어요&rsquo;를 누르면 교환이 끝나요.</p>
        : <button type="button" disabled={busy} onClick={() => void act("received")} className={`btn-lime w-full text-lime-ink ${button}`}>{busy ? "처리 중…" : "📦 물건을 받았어요"}</button>)}
      {error && <p role="alert" className="text-xs text-pink">{error}</p>}
      {theirPost && <TradeCard post={theirPost} />}
    </div>
  </>;
}

function Status({ request }: { request: ApiTradeRequest }) {
  const text = {
    pending: request.isMine ? "신청을 보냈어요. 상대가 수락하면 교환이 시작돼요." : "교환 신청이 왔어요. 수락하면 두 글이 마감되고 교환이 시작돼요.",
    accepted: request.receivedByThem ? "상대는 받았다고 알렸어요. 나도 받으면 눌러 주세요." : "교환 진행 중 — 물건을 주고받은 뒤 각자 '받았어요'를 눌러 주세요.",
    completed: "교환이 끝났어요! 두 사람 모두 거래 완료 점수가 올라갔어요.",
    declined: "이번 교환은 거절됐어요.",
    cancelled: "신청이 취소됐어요.",
  }[request.status];
  const tone = request.status === "completed" ? "text-mint" : request.status === "declined" || request.status === "cancelled" ? "text-dim" : "text-ink";
  return <p role="status" className={`text-sm font-bold ${tone}`}>{text}</p>;
}
