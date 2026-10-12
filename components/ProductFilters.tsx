"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { changeProductQuery, productHref, type ProductQuery } from "@/utils/productQuery";

interface ProductFiltersProps {
  query: ProductQuery;
  /** 같은 줄 오른쪽에 붙일 필터·등급 버튼 */
  children?: ReactNode;
}

const sortLabels: Record<ProductQuery["sort"], string> = {
  id: "기본순",
  new: "신상품순",
  popular: "인기순",
  price_asc: "낮은 가격순",
  price_desc: "높은 가격순",
};
const fieldClass = "min-w-0 pixel-input px-3 py-2.5 text-sm text-ink";
const toolButton = "inline-flex h-10 shrink-0 items-center gap-1.5 btn-pixel toggle-outline px-3 text-xs font-bold text-sub hover:text-ink aria-pressed:border-lime aria-pressed:text-lime aria-expanded:border-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet";

/** 상품 도구 막대 — 검색 · 정렬 · (필터·등급) 한 줄, 좁으면 필터·등급이 다음 줄로 */
export default function ProductFilters({ query, children }: ProductFiltersProps) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q ?? "");

  function navigate(next: ProductQuery) {
    startTransition(() => router.push(productHref(next), { scroll: false }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = changeProductQuery(query, { q: search });
    setSearch(next.q ?? "");
    navigate(next);
  }

  return (
    <section aria-label="상품 검색 및 필터" aria-busy={pending} className="mb-8 min-w-0">
      <fieldset disabled={pending} className="min-w-0 disabled:opacity-70">
        {/* 바깥 상자 없이 한 줄 — 검색창이 남는 폭을 채워 아래 상품 목록과 양 끝이 맞는다 */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <form role="search" aria-label="상품 검색" onSubmit={submitSearch} className="flex min-w-0 flex-[1_1_14rem] gap-2">
            <div className="relative min-w-0 flex-1">
              <label htmlFor={`${id}-search`} className="sr-only">상품 검색어</label>
              <input
                id={`${id}-search`}
                name="q"
                type="search"
                maxLength={50}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="아이템 이름으로 찾기"
                className={`${fieldClass} h-10 w-full py-0 pl-3 pr-10 [&::-webkit-search-cancel-button]:appearance-none`}
              />
              {search && (
                <button type="button" aria-label="검색어 지우기" className="absolute inset-y-0 right-0 w-10 text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-violet" onClick={() => {
                  setSearch("");
                  if (query.q) navigate(changeProductQuery(query, { q: undefined }));
                }}>×</button>
              )}
            </div>
            <button type="submit" className="h-10 shrink-0 btn-lime px-3 text-xs font-bold text-lime-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet">검색</button>
          </form>
          <SortMenu value={query.sort} onPick={(sort) => navigate(changeProductQuery(query, { sort }))} />
          {children}
        </div>
      </fieldset>
    </section>
  );
}

interface SortMenuProps { value: ProductQuery["sort"]; onPick: (sort: ProductQuery["sort"]) => void; }

/** 정렬 — 가격 버튼과 같은 모양의 드롭다운 (브라우저 기본 선택창은 운영체제 색으로 하얗게 떠서 쓰지 않음) */
function SortMenu({ value, onPick }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return <div ref={root} className="relative shrink-0">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-sort`} aria-label={`상품 정렬: ${sortLabels[value]}`}
      className={`${toolButton} text-ink`} onClick={() => setOpen(!open)}>
      {sortLabels[value]} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
    </button>
    {open && <ul id={`${id}-sort`} role="listbox" aria-label="상품 정렬" className="pixel-panel absolute right-0 top-full z-20 mt-2 w-40 p-1.5">
      {(Object.keys(sortLabels) as ProductQuery["sort"][]).map((sort) => <li key={sort} role="option" aria-selected={sort === value}>
        <button type="button" onClick={() => { setOpen(false); if (sort !== value) onPick(sort); }}
          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-violet ${sort === value ? "bg-panel-2 font-bold text-mint" : "text-ink"}`}>
          <span aria-hidden="true" className="w-3">{sort === value ? "✓" : ""}</span>{sortLabels[sort]}
        </button>
      </li>)}
    </ul>}
  </div>;
}
