"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import FaqItem from "@/components/help/FaqItem";
import type { ApiFaq } from "@/types/api";
import { filterFaqs, getFaqCategories, normalizeFaqCategory, parseFaqHash } from "@/utils/faq";

interface FaqBrowserProps {
  items: ApiFaq[];
  fallback: boolean;
}

export default function FaqBrowser({ items, fallback }: FaqBrowserProps) {
  const searchParams = useSearchParams();
  const category = normalizeFaqCategory(searchParams.get("category"), items);
  const paramsKey = searchParams.toString();
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const categories = getFaqCategories(items);
  const visible = filterFaqs(items, category, search);

  useEffect(() => {
    const url = new URL(window.location.href);
    const values = url.searchParams.getAll("category");
    if ((!category && values.length) || values.length > 1) {
      if (category) url.searchParams.set("category", category);
      else url.searchParams.delete("category");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [category, paramsKey]);

  useEffect(() => {
    let frame = 0;
    function revealHash() {
      const id = parseFaqHash(window.location.hash);
      const faq = items.find((item) => item.id === id);
      if (!faq) return;
      setSearch("");
      setOpenIds((previous) => previous.has(faq.id) ? previous : new Set(previous).add(faq.id));
      const url = new URL(window.location.href);
      const selected = normalizeFaqCategory(url.searchParams.get("category"), items);
      if (selected && selected !== faq.category) {
        url.searchParams.set("category", faq.category);
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      // 필터 변경으로 질문이 다시 렌더된 뒤 펼침·스크롤을 완료합니다.
      function scrollToQuestion(attempt = 0) {
        if (parseFaqHash(window.location.hash) !== faq!.id) return;
        const target = container.current?.querySelector<HTMLDetailsElement>(`#faq-${faq!.id}`);
        if (target?.open && target.getClientRects().length) {
          target.scrollIntoView({ block: "start", behavior: "instant" });
          target.querySelector("summary")?.focus({ preventScroll: true });
        } else if (attempt < 10) {
          frame = requestAnimationFrame(() => scrollToQuestion(attempt + 1));
        }
      }
      frame = requestAnimationFrame(() => scrollToQuestion());
    }
    function queueHash() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(revealHash);
    }
    queueHash();
    window.addEventListener("hashchange", queueHash);
    window.addEventListener("popstate", queueHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", queueHash);
      window.removeEventListener("popstate", queueHash);
    };
  }, [items]);

  function clearHash() {
    if (window.location.hash) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  function selectCategory(next?: string) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("category", next);
    else url.searchParams.delete("category");
    // 분류는 이미 받은 목록에서 고릅니다. 히스토리만 바꿔 재요청·스크롤 초기화를 막습니다.
    window.history.pushState(null, "", `${url.pathname}${url.search}`);
  }

  function changeSearch(value: string) {
    clearHash();
    setSearch(value);
  }

  function changeOpen(id: number, open: boolean) {
    setOpenIds((previous) => {
      if (previous.has(id) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const tabs = [{ category: undefined, label: "전체", count: items.length }, ...categories.map((item) => ({ ...item, label: item.category }))];

  return (
    <div ref={container}>
      {fallback && <p role="status" className="mb-6 pixel-panel p-4 text-sm leading-relaxed text-sub">최신 FAQ를 불러오지 못해 기본 안내를 보여드리고 있어요. 잠시 후 새로고침해 주세요.</p>}
      <form role="search" aria-label="FAQ 검색" onSubmit={(event) => { event.preventDefault(); input.current?.blur(); }} className="mb-5 pixel-panel p-4 sm:p-5">
        <label htmlFor="faq-search" className="mb-2 block text-sm font-semibold text-sub">질문·답변 검색</label>
        <div className="flex gap-1.5">
        <div className="relative min-w-0 flex-1">
          <input ref={input} id="faq-search" enterKeyHint="search" type="search" value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="예: 배송, 키보드, 주문 취소" className="min-h-11 w-full min-w-0 pixel-input py-3 pr-12 pl-3 text-sm placeholder:text-dim [&::-webkit-search-cancel-button]:appearance-none" />
          {search && <button type="button" aria-label="검색어 지우기" onClick={() => { changeSearch(""); input.current?.focus(); }} className="absolute inset-y-0 right-0 w-11 rounded-lg text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-violet"><span aria-hidden="true">×</span></button>}
        </div>
        <button type="submit" className="btn-lime min-h-11 shrink-0 px-4 text-sm font-bold">찾기</button>
        </div>
      </form>

      <nav aria-label="FAQ 분류" className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        <div className="flex w-max gap-2">
          {tabs.map((tab) => <button key={tab.category ?? "all"} type="button" aria-pressed={category === tab.category} onClick={() => selectCategory(tab.category)} className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet ${category === tab.category ? "border-violet bg-violet/15 text-ink" : "border-line bg-panel text-sub hover:text-ink"}`}>
            {tab.label}<span className="text-dim">{tab.count}</span>
          </button>)}
        </div>
      </nav>
      <p role="status" aria-live="polite" className="mt-4 mb-4 text-sm text-dim">{search.trim() ? "검색 결과" : "자주 묻는 질문"} {visible.length}개</p>

      {visible.length ? (
        <div className="space-y-3">
          {visible.map((faq) => <FaqItem key={faq.id} faq={faq} query={search} open={openIds.has(faq.id)} onOpenChange={changeOpen} />)}
        </div>
      ) : (
        <div className="pixel-panel p-8 text-center">
          <p className="break-words font-semibold">{search.trim() ? `‘${search.trim()}’에 맞는 질문이 없어요` : "아직 등록된 질문이 없어요"}</p>
          {search.trim() && <button type="button" onClick={() => { changeSearch(""); input.current?.focus(); }} className="mt-4 min-h-11 btn-pixel px-5 text-sm font-semibold text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-violet">검색 초기화</button>}
        </div>
      )}
    </div>
  );
}
