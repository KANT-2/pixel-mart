"use client";

import ReviewEntries from "@/components/products/ReviewEntries";
import ReviewForm from "@/components/products/ReviewForm";
import { FeedbackSkeleton } from "@/components/products/FeedbackStates";
import type { createReviewStore } from "@/lib/reviews";

interface ReviewsPanelProps {
  snapshot: ReturnType<ReturnType<typeof createReviewStore>["getSnapshot"]>;
  load: (page?: number) => Promise<void>;
}

interface ProductReviewsPanelProps extends ReviewsPanelProps { productId: number; }

export default function ReviewsPanel({ productId, snapshot, load }: ProductReviewsPanelProps) {
  const { data, loading, error, requestedPage } = snapshot;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-xl font-bold">리뷰</h2>
      <p aria-label="리뷰 평균과 개수" className="text-sm text-sub">평균 <strong className="text-lg text-lime">{data?.averageRating == null ? "—" : data.averageRating.toFixed(1)}</strong> / 5 · {data ? `${data.total}개` : loading ? "불러오는 중" : "조회 실패"}</p>
    </div>
    {error && <div role="alert" className="rounded-xl border border-pink/30 bg-panel p-5 text-sm text-pink">
      <p>{error}</p><button type="button" onClick={() => void load(requestedPage)} disabled={loading} className="mt-2 min-h-11 font-bold underline underline-offset-4">리뷰 다시 불러오기</button>
    </div>}
    {loading ? <FeedbackSkeleton label="리뷰 불러오는 중" /> : data && <>
      {data.items.length ? <ReviewEntries items={data.items} /> : <div className="rounded-xl border border-line bg-panel p-8 text-center">
        <p className="font-bold">아직 리뷰가 없어요</p><p className="mt-2 text-sm text-sub">배송 완료한 상품의 첫 리뷰를 남겨 주세요.</p>
      </div>}
      {data.totalPages > 1 && <nav aria-label="리뷰 페이지 이동" className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <button type="button" disabled={data.page <= 1} onClick={() => void load(data.page - 1)} className="min-h-11 rounded-lg border border-line px-4 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-mint">이전 리뷰</button>
        <span aria-live="polite">{data.page} / {data.totalPages}</span>
        <button type="button" disabled={data.page >= data.totalPages} onClick={() => void load(data.page + 1)} className="min-h-11 rounded-lg border border-line px-4 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-mint">다음 리뷰</button>
      </nav>}
    </>}
    <ReviewForm productId={productId} onCreated={() => load(1)} />
  </div>;
}
