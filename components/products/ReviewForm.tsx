"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { FeedbackLogin, FeedbackSkeleton } from "@/components/products/FeedbackStates";
import { ApiError } from "@/lib/api";
import { reviewsApi } from "@/lib/reviews";
import { validateReview } from "@/utils/productFeedback";

interface ReviewFormProps { productId: number; onCreated: () => Promise<void>; }

export default function ReviewForm(props: ReviewFormProps) {
  const { user, loading } = useAuth();
  if (loading) return <FeedbackSkeleton label="로그인 상태 확인 중" />;
  if (!user) return <FeedbackLogin section="reviews" />;
  return <AccountReviewForm key={user.id} {...props} />;
}

function AccountReviewForm({ productId, onCreated }: ReviewFormProps) {
  const { pending: authPending, refresh } = useAuth();
  const id = useId();
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<{ rating?: string; content?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expired, setExpired] = useState(false);
  const lock = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => { controller.abort(); lock.current = false; setBusy(false); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || authPending || submitted) return;
    const validation = validateReview(rating, content);
    setErrors(validation.errors);
    setError(null);
    if (!validation.valid) return;
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    lock.current = true;
    setBusy(true);
    try {
      await reviewsApi.create(productId, validation.values, signal);
      if (signal.aborted) return;
      // POST 성공은 유지하고, 이후 목록 오류는 GET 재시도로만 복구합니다.
      setSubmitted(true);
      setContent("");
      await onCreated();
    } catch (cause) {
      if (signal.aborted) return;
      if (cause instanceof ApiError && cause.status === 401) { setExpired(true); void refresh(); }
      else setError(cause instanceof ApiError ? cause.message : "작성 결과를 확인하지 못했어요. 리뷰 목록을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      if (!signal.aborted) { lock.current = false; setBusy(false); }
    }
  }

  if (expired) return <FeedbackLogin section="reviews" />;
  if (submitted) return <p role="status" className="rounded-xl border border-mint/30 bg-panel p-5 text-sm text-mint">리뷰를 등록했어요.</p>;
  const disabled = busy || authPending;
  return <form onSubmit={submit} noValidate className="rounded-xl border border-line bg-panel p-5 sm:p-6">
    <h3 className="text-lg font-bold">리뷰 쓰기</h3>
    <p className="mt-2 text-xs leading-relaxed text-sub">배송 완료한 상품에 한 번만 작성할 수 있어요. 작성 가능 여부는 등록할 때 확인해요.</p>
    <fieldset disabled={disabled} className="mt-5">
      <legend className="mb-2 text-sm font-semibold">별점</legend>
      <div className="flex flex-wrap gap-2" aria-describedby={errors.rating ? `${id}-rating-error` : undefined}>
        {[1, 2, 3, 4, 5].map((value) => <label key={value} className="cursor-pointer">
          <input type="radio" name={`${id}-rating`} aria-label={`${value}점`} value={value} checked={rating === value} onChange={() => { setRating(value); setErrors((current) => ({ ...current, rating: undefined })); }} className="peer sr-only" />
          <span className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border border-line px-2 text-sm text-sub peer-checked:border-mint peer-checked:text-mint peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-mint"><span aria-hidden="true">★</span>{value}<span className="sr-only">점</span></span>
        </label>)}
      </div>
      {errors.rating && <p id={`${id}-rating-error`} role="alert" className="mt-2 text-sm text-pink">{errors.rating}</p>}
    </fieldset>
    <label htmlFor={`${id}-content`} className="mb-2 mt-5 block text-sm font-semibold">리뷰 내용</label>
    <textarea id={`${id}-content`} rows={4} maxLength={500} value={content} disabled={disabled} onChange={(event) => { setContent(event.target.value); setErrors((current) => ({ ...current, content: undefined })); }} aria-invalid={Boolean(errors.content)} aria-describedby={`${id}-count${errors.content ? ` ${id}-content-error` : ""}`} placeholder="사용해 본 느낌을 남겨 주세요." className="w-full min-w-0 resize-y rounded-lg border border-line bg-night p-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
    <p id={`${id}-count`} className="mt-1 text-right text-xs text-dim">{Array.from(content).length} / 500자</p>
    {errors.content && <p id={`${id}-content-error`} role="alert" className="mt-2 text-sm text-pink">{errors.content}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-pink">{error}</p>}
    <button disabled={disabled} type="submit" className="mt-4 min-h-11 rounded-lg bg-lime px-5 py-3 text-sm font-bold text-lime-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">{busy ? "등록 중…" : "리뷰 등록"}</button>
  </form>;
}
