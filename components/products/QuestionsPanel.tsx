"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { FeedbackLogin, FeedbackSkeleton } from "@/components/products/FeedbackStates";
import QuestionEntries from "@/components/products/QuestionEntries";
import { questions, questionLimits, validateQuestion, type QuestionView } from "@/lib/questions";
import type { ApiUser } from "@/types/api";

interface QuestionsPanelProps { productId: number; }

export default function QuestionsPanel({ productId }: QuestionsPanelProps) {
  const { user, loading } = useAuth();
  return <div className="space-y-6">
    <h2 className="text-xl font-bold">상품 Q&A {questions.mode === "demo" && <span className="ml-2 inline-block rounded border border-violet/40 px-2 py-1 align-middle text-xs text-violet">데모 데이터</span>}</h2>
    {questions.mode === "demo" && <p className="rounded-xl border border-violet/30 bg-panel p-5 text-sm leading-relaxed text-sub">{questions.notice}</p>}
    {loading ? <FeedbackSkeleton label="질문 공개 범위 확인 중" /> : <AccountQuestions key={`${productId}:${user?.id ?? "guest"}`} productId={productId} viewer={user} />}
  </div>;
}

interface AccountQuestionsProps extends QuestionsPanelProps { viewer: ApiUser | null; }

function AccountQuestions({ productId, viewer }: AccountQuestionsProps) {
  const { pending: authPending } = useAuth();
  const id = useId();
  const [items, setItems] = useState<QuestionView[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const load = useCallback((signal: AbortSignal) =>
    questions.list(productId, viewer, signal).then((next) => {
      if (!signal.aborted) { setItems(next); setListError(null); }
    }).catch((cause: unknown) => {
      if (!signal.aborted) setListError(cause instanceof Error ? cause.message : "질문을 불러오지 못했어요.");
    }), [productId, viewer]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void load(controller.signal);
    return () => { controller.abort(); lock.current = false; setBusy(false); };
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || authPending || !viewer) return;
    const validation = validateQuestion(title, content);
    setErrors(validation.errors); setError(null); setSuccess(false);
    if (!validation.valid) return;
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    lock.current = true; setBusy(true);
    try {
      await questions.create(productId, viewer, { ...validation.values, isSecret }, signal);
      if (signal.aborted) return;
      setTitle(""); setContent(""); setIsSecret(false); setSuccess(true);
      await load(signal);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : "질문을 저장하지 못했어요.");
    } finally {
      if (!signal.aborted) { lock.current = false; setBusy(false); }
    }
  }

  return <>
    {listError && <div role="alert" className="rounded-xl border border-pink/30 bg-panel p-5 text-sm text-pink">
      <p>{listError}</p><button type="button" onClick={() => { const signal = lifetime.current?.signal; if (signal) void load(signal); }} className="mt-2 min-h-11 font-bold underline">질문 다시 불러오기</button>
    </div>}
    {items ? items.length ? <QuestionEntries items={items} /> : <p className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-sub">아직 질문이 없어요.</p> : !listError && <FeedbackSkeleton label="질문 불러오는 중" />}
    {!viewer ? <FeedbackLogin section="qna" /> : <form onSubmit={submit} noValidate className="rounded-xl border border-line bg-panel p-5 sm:p-6">
      <h3 className="text-lg font-bold">질문 쓰기</h3>
      <fieldset disabled={busy || authPending} className="mt-5 space-y-4">
        <div><label htmlFor={`${id}-title`} className="mb-2 block text-sm font-semibold">질문 제목</label>
          <input id={`${id}-title`} value={title} maxLength={questionLimits.title} onChange={(event) => setTitle(event.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? `${id}-title-error` : undefined} className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-night px-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
          {errors.title && <p id={`${id}-title-error`} role="alert" className="mt-2 text-sm text-pink">{errors.title}</p>}
        </div>
        <div><label htmlFor={`${id}-content`} className="mb-2 block text-sm font-semibold">질문 내용</label>
          <textarea id={`${id}-content`} value={content} rows={4} maxLength={questionLimits.content} onChange={(event) => setContent(event.target.value)} aria-invalid={Boolean(errors.content)} aria-describedby={`${id}-count${errors.content ? ` ${id}-content-error` : ""}`} className="w-full min-w-0 resize-y rounded-lg border border-line bg-night p-3 text-sm focus-visible:outline-2 focus-visible:outline-mint" />
          <p id={`${id}-count`} className="mt-1 text-right text-xs text-dim">{Array.from(content).length} / {questionLimits.content}자</p>
          {errors.content && <p id={`${id}-content-error`} role="alert" className="mt-2 text-sm text-pink">{errors.content}</p>}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={isSecret} onChange={(event) => setIsSecret(event.target.checked)} className="size-4 accent-mint" />비밀글 (나만 보기)</label>
        <button type="submit" className="min-h-11 rounded-lg bg-lime px-5 py-3 text-sm font-bold text-lime-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">{busy ? "저장 중…" : questions.mode === "demo" ? "데모 질문 저장" : "질문 등록"}</button>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-pink">{error}</p>}
      {success && <p role="status" className="mt-3 text-sm text-mint">{questions.mode === "demo" ? "데모 질문을 화면에 저장했어요. 새로고침하면 사라져요." : "질문을 등록했어요."}</p>}
    </form>}
  </>;
}
