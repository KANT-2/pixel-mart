import type { ApiReview } from "@/types/api";
import type { ReactNode } from "react";
import { formatDate } from "@/utils/formatDate";

interface ReviewEntriesProps { items: ApiReview[]; actions?: (review: ApiReview) => ReactNode; }

export default function ReviewEntries({ items, actions }: ReviewEntriesProps) {
  return <ul aria-label="상품 리뷰 목록" className="divide-y divide-line rounded-xl border border-line bg-panel px-5 sm:px-6">
    {items.map((review) => <li key={review.id} className="min-w-0 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p aria-label={`별점 5점 만점에 ${review.rating}점`} className="font-pixel text-lg text-lime"><span aria-hidden="true">{"★".repeat(review.rating)}<span className="text-dim">{"☆".repeat(5 - review.rating)}</span></span></p>
        <time dateTime={review.createdAt} className="text-xs text-dim">{formatDate(review.createdAt)}</time>
      </div>
      <p className="mt-3 break-words text-sm font-bold">{review.nickname}</p>
      <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-sub">{review.content}</p>
      {actions?.(review)}
    </li>)}
  </ul>;
}
