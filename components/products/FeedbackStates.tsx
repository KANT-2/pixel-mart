"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { safeNextPath } from "@/utils/safeNextPath";

interface FeedbackLoginProps { section: "reviews" | "qna"; }

export function FeedbackLogin({ section }: FeedbackLoginProps) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const next = safeNextPath(`${pathname}${search ? `?${search}` : ""}#${section}`);
  return <div className="rounded-xl border border-line bg-panel p-5 text-sm">
    <p className="text-sub">{section === "reviews" ? "로그인하고 배송 완료한 상품의 리뷰를 남겨 주세요." : "로그인하면 데모 질문 작성을 체험할 수 있어요."}</p>
    <Link href={`/login?next=${encodeURIComponent(next)}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-bold text-mint focus-visible:outline-2 focus-visible:outline-mint">로그인하기</Link>
  </div>;
}

interface FeedbackSkeletonProps { label: string; }
export function FeedbackSkeleton({ label }: FeedbackSkeletonProps) {
  return <div role="status" aria-label={label} className="space-y-3">
    <span className="sr-only">{label}</span>
    {[0, 1].map((key) => <div key={key} className="h-28 animate-pulse rounded-xl bg-panel motion-reduce:animate-none" />)}
  </div>;
}
