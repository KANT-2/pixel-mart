"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocalResource } from "@/components/local/useLocalResource";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
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
  /** 함께 보낼 내 글 (교환 창에서 내 WISH) */
  offerPostId?: number | null;
  className?: string;
}

/** 이웃 글에 교환 신청 / 신청 취소 — 채팅·연락처 없이 신청과 수락만 */
export default function TradeRequestButton({ post, offerPostId = null, className = "" }: TradeRequestButtonProps) {
  const { user } = useAuth();
  const sent = useContext(SentContext);
  const [mine, setMine] = useState<ApiTradeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = mine ?? sent?.byPost.get(post.id) ?? null;
  const pending = request?.status === "pending";

  if (post.isMine || post.isSample || post.status !== "open") return null;
  if (!user) return <Link href="/login?next=/local/trades" className={`btn-pixel inline-flex h-10 items-center justify-center px-4 text-sm font-bold ${className}`}>로그인하고 교환 신청</Link>;

  async function act() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const next = pending && request ? await localApi.answerRequest(request.id, "cancel") : await localApi.requestTrade(post.id, offerPostId);
      setMine(next);
      await sent?.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "교환 신청을 보내지 못했어요. 다시 시도해 주세요.");
    } finally { setBusy(false); }
  }

  return <div className={`mt-3 ${className}`}>
    <button type="button" onClick={() => void act()} disabled={busy} aria-pressed={pending}
      className={`${pending ? "btn-pixel text-sub" : "btn-lime text-lime-ink"} inline-flex h-10 w-full items-center justify-center gap-1.5 px-4 text-sm font-bold disabled:opacity-50`}>
      {busy ? "보내는 중…" : pending ? "신청함 · 취소하기" : "⇄ 교환 신청"}
    </button>
    {pending && !error && <p role="status" className="mt-1.5 text-[11px] text-mint">상대가 수락하면 두 글 모두 거래 완료로 바뀌어요.</p>}
    {error && <p role="alert" className="mt-1.5 text-xs text-pink">{error}</p>}
  </div>;
}
