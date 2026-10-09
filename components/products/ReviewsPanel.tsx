"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ReviewEntries from "@/components/products/ReviewEntries";
import ReviewDeleteButton from "@/components/products/ReviewDeleteButton";
import ReviewForm from "@/components/products/ReviewForm";
import { FeedbackSkeleton } from "@/components/products/FeedbackStates";
import { reviewsApi, type createReviewStore } from "@/lib/reviews";
import { ApiError } from "@/lib/api";
import type { ApiReview } from "@/types/api";
import { canDeleteReview } from "@/utils/productFeedback";

interface ReviewsPanelProps {
  snapshot: ReturnType<ReturnType<typeof createReviewStore>["getSnapshot"]>;
  load: (page?: number) => Promise<void>;
}

interface ProductReviewsPanelProps extends ReviewsPanelProps { productId: number; }

export default function ReviewsPanel({ productId, snapshot, load }: ProductReviewsPanelProps) {
  const { user, loading: authLoading, pending: authPending, refresh: refreshAuth } = useAuth();
  const { data, loading, error, requestedPage } = snapshot;
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const lock = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const signedIn = Boolean(user) && !authLoading;
  const blocked = loading || pendingId !== null || authPending;
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => { controller.abort(); lock.current = false; setPendingId(null); };
  }, []);

  async function remove(review: ApiReview) {
    if (lock.current || blocked || error || !canDeleteReview(review, signedIn)) return;
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    lock.current = true;
    setPendingId(review.id); setDeleteError(null); setNotice(null);
    try {
      let message: string;
      try { message = (await reviewsApi.remove(productId, review.id, signal)).message; }
      catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
        message = "이미 삭제됐거나 찾을 수 없는 리뷰예요";
      }
      if (signal.aborted) return;
      setNotice(message);
      // 삭제가 확정된 뒤 폼을 새로 열고, 후속 실패는 목록 GET만 재시도합니다.
      setFormVersion((version) => version + 1);
      await load(data?.page ?? requestedPage);
    } catch (cause) {
      if (signal.aborted) return;
      setDeleteError(cause instanceof Error ? cause.message : "리뷰를 삭제하지 못했어요. 다시 시도해 주세요.");
      if (cause instanceof ApiError && cause.status === 401) void refreshAuth();
    } finally {
      if (!signal.aborted) { lock.current = false; setPendingId(null); }
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-xl font-bold">리뷰</h2>
      <p aria-label="리뷰 평균과 개수" className="text-sm text-sub">평균 <strong className="text-lg text-lime">{data?.averageRating == null ? "—" : data.averageRating.toFixed(1)}</strong> / 5 · {data ? `${data.total}개` : loading ? "불러오는 중" : "조회 실패"}</p>
    </div>
    {error && <div role="alert" className="rounded-xl border border-pink/30 bg-panel p-5 text-sm text-pink">
      <p>{error}</p><button type="button" onClick={() => void load(requestedPage)} disabled={blocked} className="mt-2 min-h-11 font-bold underline underline-offset-4">리뷰 다시 불러오기</button>
    </div>}
    {deleteError && <p role="alert" className="rounded-xl border border-pink/30 bg-panel p-4 text-sm text-pink">{deleteError}</p>}
    {notice && <p role="status" className="rounded-xl border border-mint/30 bg-panel p-4 text-sm text-mint">{notice}</p>}
    {loading ? <FeedbackSkeleton label="리뷰 불러오는 중" /> : data && <>
      {data.items.length ? <ReviewEntries items={data.items} actions={(review) => canDeleteReview(review, signedIn) ? <ReviewDeleteButton disabled={blocked || Boolean(error)} pending={pendingId === review.id} onConfirm={() => remove(review)} /> : null} /> : <div className="pixel-panel p-8 text-center">
        <p className="font-bold">아직 리뷰가 없어요</p><p className="mt-2 text-sm text-sub">배송 완료한 상품의 첫 리뷰를 남겨 주세요.</p>
      </div>}
      {data.totalPages > 1 && <nav aria-label="리뷰 페이지 이동" className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <button type="button" disabled={blocked || data.page <= 1} onClick={() => void load(data.page - 1)} className="min-h-11 rounded-lg border border-line px-4 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-mint">이전 리뷰</button>
        <span aria-live="polite">{data.page} / {data.totalPages}</span>
        <button type="button" disabled={blocked || data.page >= data.totalPages} onClick={() => void load(data.page + 1)} className="min-h-11 rounded-lg border border-line px-4 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-mint">다음 리뷰</button>
      </nav>}
    </>}
    <ReviewForm key={formVersion} productId={productId} onCreated={() => { setNotice(null); setDeleteError(null); return load(1); }} deleting={pendingId !== null} />
  </div>;
}
