"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ExchangeDialog, TradeComposer, TradeProgress } from "@/components/local/TradeExchange";
import { useLocalResource } from "@/components/local/useLocalResource";
import { useAuth } from "@/components/AuthProvider";
import { localApi } from "@/lib/local";
import type { ApiTradePost, ApiTradeRequest } from "@/types/api";

interface SentRequests {
  /** 글 id → 내가 보낸 대기 중 신청 */
  byPost: Map<number, ApiTradeRequest>;
  refresh: () => Promise<void>;
}

const SentContext = createContext<SentRequests | null>(null);

/** 목록 하나에서 내가 보낸 신청을 한 번만 불러와 버튼들이 같이 쓴다 */
export function SentRequestsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const load = useCallback((signal: AbortSignal) => user ? localApi.tradeRequests("sent", signal) : Promise.resolve([] as ApiTradeRequest[]), [user]);
  // 불러오지 못해도 버튼은 신청 시점에 서버가 다시 확인한다
  const result = useLocalResource(load);
  const { refresh } = result;
  const sent = result.data;
  const value = useMemo(() => ({
    byPost: new Map((sent ?? []).filter((request) => request.status === "pending").map((request) => [request.post.id, request])),
    refresh: async () => { await refresh(); },
  }), [sent, refresh]);
  return <SentContext.Provider value={value}>{children}</SentContext.Provider>;
}

interface TradeRequestButtonProps {
  post: ApiTradePost;
  className?: string;
}

/** 이웃 글의 교환 버튼 — 누르면 교환 창이 열려 내 교환글 물건을 골라 신청, 이미 신청했으면 진행 상황을 본다 */
export default function TradeRequestButton({ post, className = "" }: TradeRequestButtonProps) {
  const { user } = useAuth();
  const sent = useContext(SentContext);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<ApiTradeRequest | null>(null);
  const request = mine ?? sent?.byPost.get(post.id) ?? null;
  const close = useCallback(() => setOpen(false), []);

  if (post.isMine || post.isSample || post.status !== "open") return null;
  if (!user) return <Link href="/login?next=/local/trades" className={`btn-pixel mt-3 inline-flex h-10 w-full items-center justify-center px-4 text-sm font-bold ${className}`}>로그인하고 교환 신청</Link>;

  const changed = (next: ApiTradeRequest) => { setMine(next); void sent?.refresh(); };
  const pending = request?.status === "pending";
  return <div className={`mt-3 ${className}`}>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
      className={`${pending ? "btn-pixel text-ink" : "btn-lime text-lime-ink"} inline-flex h-10 w-full items-center justify-center gap-1.5 px-4 text-sm font-bold`}>
      {pending ? "⇄ 교환 창 보기 · 신청 완료" : post.kind === "sell" ? "⇄ 교환·구매 신청" : "⇄ 교환하기"}
    </button>
    {pending && <p role="status" className="mt-1.5 text-[11px] text-mint">교환 신청을 보냈어요. 상대가 수락하면 교환이 시작돼요.</p>}
    {open && <ExchangeDialog title={post.itemName} onClose={close}>
      {request && request.status !== "cancelled" && request.status !== "declined"
        ? <TradeProgress request={request} onChanged={changed} />
        : <TradeComposer target={post} onSent={changed} />}
    </ExchangeDialog>}
  </div>;
}
