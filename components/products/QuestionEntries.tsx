import type { QuestionView } from "@/lib/questions";
import { formatDate } from "@/utils/formatDate";

interface QuestionEntriesProps { items: QuestionView[]; }

export default function QuestionEntries({ items }: QuestionEntriesProps) {
  return <ul aria-label="상품 질문 목록" className="space-y-3">
    {items.map((question) => <li key={question.id} className="min-w-0 rounded-xl border border-line bg-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={`rounded border px-2 py-1 ${question.answered ? "border-mint/30 text-mint" : "border-line text-dim"}`}>{question.answered ? "답변 완료" : "답변 대기"}</span>
        <time dateTime={question.createdAt} className="text-dim">{formatDate(question.createdAt)}</time>
      </div>
      {question.hidden ? <p className="mt-4 text-sm text-sub">비밀글입니다</p> : <>
        <h3 className="mt-4 break-words font-bold">{question.title}</h3>
        <p className="mt-2 break-words text-xs text-dim">{question.nickname}{question.isSecret && " · 비밀글 (나만 보기)"}</p>
        <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-sub">{question.content}</p>
        {question.answer !== null && <div className="mt-4 border-l-2 border-mint bg-panel-2 p-4">
          <p className="mb-2 text-xs font-bold text-mint">답변</p><p className="whitespace-pre-line break-words text-sm leading-relaxed text-sub">{question.answer}</p>
        </div>}
      </>}
    </li>)}
  </ul>;
}
