"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, LocalSkeleton, localButton } from "@/components/local/LocalStates";
import { TradeLogin } from "@/components/local/TradeStates";
import TradeCard from "@/components/local/TradeCard";
import TradeWindow from "@/components/local/TradeWindow";
import TradeStatusButtons from "@/components/local/TradeStatusButtons";
import { localApi } from "@/lib/local";
import { ApiError } from "@/lib/api";

export default function MyTrades() {
  const { user, loading } = useAuth(), params = useSearchParams(), pathname = usePathname();
  if (pathname !== "/local/trades/mine") return null;
  if (loading) return <LocalSkeleton />;
  if (!user) return <TradeLogin next="/local/trades/mine" />;
  return <AccountTrades key={user.id} created={params.get("created") === "1"} />;
}
interface AccountTradesProps { created: boolean; }
function AccountTrades({ created }: AccountTradesProps) {
  const auth = useAuth();
  const load = useCallback(async (signal: AbortSignal) => {
    const [posts, matches] = await Promise.all([localApi.myTrades(signal), localApi.matches(signal)]);
    return { posts, matches };
  }, []);
  const result = useLocalResource(load);
  const [pending, setPending] = useState<number | null>(null), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [expired, setExpired] = useState(false);
  const lifetime = useRef<AbortController | null>(null), lock = useRef(false);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => controller.abort(); }, []);
  async function update(id: number, status: "done" | "hidden") {
    if (lock.current || auth.pending || result.loading || !lifetime.current) return;
    const signal = lifetime.current.signal;
    lock.current = true; setPending(id); setError(null); setNotice(null);
    try {
      await localApi.tradeStatus(id, status, signal);
      if (signal.aborted) return;
      setNotice(status === "done" ? "거래를 완료했어요." : "글을 숨겼어요.");
      await result.refresh();
    } catch (cause) {
      if (signal.aborted) return;
      setError(cause instanceof ApiError ? cause.message : "상태를 변경하지 못했어요. 다시 시도해 주세요.");
      if (cause instanceof ApiError && cause.status === 401) { setExpired(true); void auth.refresh(); }
    } finally { if (!signal.aborted) { lock.current = false; setPending(null); } }
  }
  if (expired || result.status === 401) return <TradeLogin next="/local/trades/mine" />;
  return <div className="space-y-8">
    {created && <p role="status" className="rounded-xl border border-mint/30 bg-panel p-4 text-sm text-mint">글을 등록했어요. 내 글과 매칭을 확인해 보세요.</p>}
    {notice && <p role="status" className="text-sm text-mint">{notice}</p>}
    {error && <p role="alert" className="text-sm text-pink">{error}</p>}
    {result.error ? <LocalError message={result.error} onRetry={() => void result.refresh()} busy={pending !== null} /> : result.loading ? <LocalSkeleton label="내 글과 매칭 불러오는 중" /> : result.data && <>
      <section aria-labelledby="my-trades-title"><h2 id="my-trades-title" className="mb-5 text-xl font-bold">내 글 · {result.data.posts.length}개</h2>
        {result.data.posts.length ? <ul aria-label="내 거래글" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.data.posts.map((post) => <li key={post.id}><TradeCard post={post} actions={post.isMine ? <TradeStatusButtons key={`${post.id}:${post.status}`} status={post.status} disabled={pending !== null || auth.pending} pending={pending === post.id} onConfirm={(status) => update(post.id, status)} /> : null} /></li>)}</ul>
          : <div className="pixel-panel p-8 text-center"><p>아직 작성한 글이 없어요.</p><Link href="/local/trades/new" className={`${localButton} mt-4`}>첫 글 쓰기</Link></div>}
      </section>
      <section aria-labelledby="trade-matches-title"><h2 id="trade-matches-title" className="mb-2 text-xl font-bold">⇄ 교환 제안 · 내 WISH와 맞는 이웃 아이템</h2><p className="mb-5 text-sm text-sub">같은 구·생활권에서 조건이 맞는 물건을 찾아요. 연락 수단과 작성자 정보는 제공하지 않아요.</p>
        {!result.data.posts.some((post) => post.kind === "want" && post.status === "open") ? <div className="pixel-panel p-8 text-center"><p>구하는 물건을 먼저 알려 주세요.</p><Link href="/local/trades/new?kind=want" className={`${localButton} mt-4`}>WISH 글쓰기</Link></div>
          : result.data.matches.length ? <ul aria-label="이웃 매칭" className="grid gap-5 xl:grid-cols-2">{result.data.matches.map((match) => <li key={`${match.want.id}:${match.offer.id}`} className="min-w-0">
            <TradeWindow match={match} me={{ nickname: auth.user?.nickname ?? "나", avatarUrl: auth.user?.avatarUrl ?? null }} />
          </li>)}</ul>
            : <div className="pixel-panel p-8 text-center"><p>아직 맞는 물건을 찾지 못했어요.</p><p className="mt-2 text-sm text-sub">게시판을 둘러보거나 다른 WISH를 남겨 보세요.</p><Link href="/local/trades" className={`${localButton} mt-4`}>거래·교환 둘러보기</Link></div>}
      </section>
    </>}
  </div>;
}
