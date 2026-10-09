"use client";

import type { ApiFaq } from "@/types/api";
import { splitFaqText } from "@/utils/faq";

interface FaqItemProps {
  faq: ApiFaq;
  query: string;
  open: boolean;
  onOpenChange: (id: number, open: boolean) => void;
}

interface HighlightTextProps {
  text: string;
  query: string;
}

function HighlightText({ text, query }: HighlightTextProps) {
  return splitFaqText(text, query).map((part, index) => part.match ? (
    <mark key={index} className="rounded-sm bg-mint/20 text-mint">{part.text}</mark>
  ) : part.text);
}

export default function FaqItem({ faq, query, open, onOpenChange }: FaqItemProps) {
  return (
    <details
      id={`faq-${faq.id}`}
      open={open}
      onToggle={(event) => onOpenChange(faq.id, event.currentTarget.open)}
      className="group/faq scroll-mt-36 pixel-panel open:border-violet/40"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="shrink-0 font-pixel text-sm text-mint">Q</span>
        <span className="min-w-0 flex-1 break-words text-sm font-bold leading-relaxed sm:text-base">
          <HighlightText text={faq.question} query={query} />
        </span>
        <span aria-hidden="true" className="relative flex size-6 shrink-0 items-center justify-center text-violet">
          <span className="h-0.5 w-3 bg-current" />
          <span className="absolute h-3 w-0.5 bg-current group-open/faq:hidden" />
        </span>
      </summary>
      <div className="mx-5 flex gap-3 border-t border-line py-5">
        <span aria-hidden="true" className="shrink-0 pt-0.5 font-pixel text-sm text-violet">A</span>
        <p className="min-w-0 whitespace-pre-line break-words text-sm leading-7 text-sub">
          <HighlightText text={faq.answer} query={query} />
        </p>
      </div>
    </details>
  );
}
