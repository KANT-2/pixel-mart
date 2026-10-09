"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { formatPrice } from "@/utils/formatPrice";
import { changeProductQuery, productHref, PRODUCT_MAX_PRICE, type ProductQuery } from "@/utils/productQuery";

interface ProductFiltersProps {
  query: ProductQuery;
}

const sortLabels: Record<ProductQuery["sort"], string> = {
  id: "기본순",
  new: "신상품순",
  popular: "인기순",
  price_asc: "낮은 가격순",
  price_desc: "높은 가격순",
};
const fieldClass = "min-w-0 pixel-input px-3 py-2.5 text-sm text-ink";

export default function ProductFilters({ query }: ProductFiltersProps) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q ?? "");
  const [minimum, setMinimum] = useState(query.minPrice?.toString() ?? "");
  const [maximum, setMaximum] = useState(query.maxPrice?.toString() ?? "");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  function navigate(next: ProductQuery) {
    startTransition(() => router.push(productHref(next), { scroll: false }));
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = changeProductQuery(query, { q: search });
    setSearch(next.q ?? "");
    navigate(next);
  }

  function applyPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = [minimum.trim(), maximum.trim()];
    if (values.some((value) => value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))))) {
      setPriceError("가격은 0 이상의 정수로 입력해 주세요.");
      return;
    }
    if (values.some((value) => value && Number(value) > PRODUCT_MAX_PRICE)) {
      setPriceError(`가격은 ${formatPrice(PRODUCT_MAX_PRICE)} 이하로 입력해 주세요.`);
      return;
    }
    setPriceError(null);
    const next = changeProductQuery(query, {
      minPrice: values[0] ? Number(values[0]) : undefined,
      maxPrice: values[1] ? Number(values[1]) : undefined,
    });
    setMinimum(next.minPrice?.toString() ?? "");
    setMaximum(next.maxPrice?.toString() ?? "");
    setExpanded(false);
    navigate(next);
  }


  const priceActive = query.minPrice !== undefined || query.maxPrice !== undefined;
  const toolButton = "inline-flex h-10 shrink-0 items-center gap-1.5 btn-pixel toggle-outline px-3 text-xs font-bold text-sub hover:text-ink aria-pressed:border-lime aria-pressed:text-lime aria-expanded:border-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet";

  return (
    <section aria-label="상품 검색 및 필터" aria-busy={pending} className="mb-6 min-w-0">
      <fieldset disabled={pending} className="min-w-0 disabled:opacity-70">
        {/* 게임 상점 도구 막대 — 검색 · 정렬 · NEW · 가격을 한 줄에 */}
        <div className="pixel-panel flex min-w-0 flex-wrap items-center gap-2 p-2">
          <form role="search" aria-label="상품 검색" onSubmit={submitSearch} className="flex min-w-0 flex-[1_1_16rem] gap-2">
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

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`${id}-sort`}>상품 정렬</label>
            <select id={`${id}-sort`} aria-label="상품 정렬" value={query.sort} className={`${fieldClass} h-10 py-0 text-xs font-bold`} onChange={(event) => navigate(changeProductQuery(query, { sort: event.target.value as ProductQuery["sort"] }))}>
              {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" aria-pressed={Boolean(query.new)} className={toolButton}
              onClick={() => navigate(changeProductQuery(query, { new: query.new ? undefined : true }))}>NEW만</button>
            <div className="relative">
              <button type="button" aria-expanded={expanded} aria-controls={`${id}-filters`} aria-pressed={priceActive} className={toolButton} onClick={() => setExpanded(!expanded)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 코인 */}
                <img src="/images/hero-coin.svg" alt="" className="size-3.5 [image-rendering:pixelated]" />가격 <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
              </button>
              {expanded && (
                <form id={`${id}-filters`} onSubmit={applyPrice} aria-label="가격 범위" onKeyDown={(event) => { if (event.key === "Escape") setExpanded(false); }}
                  className="pixel-panel absolute right-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] p-3">
                  <p className="mb-2 font-pixel text-[10px] tracking-widest text-lime">▶ PRICE RANGE</p>
                  <div className="flex min-w-0 items-center gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">최소 가격</span>
                      <input name="minPrice" inputMode="numeric" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="최소" aria-invalid={Boolean(priceError)} aria-describedby={priceError ? `${id}-price-error` : undefined} className={`${fieldClass} h-10 w-full py-0`} />
                    </label>
                    <span aria-hidden="true" className="text-dim">~</span>
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">최대 가격</span>
                      <input name="maxPrice" inputMode="numeric" value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="최대" aria-invalid={Boolean(priceError)} aria-describedby={priceError ? `${id}-price-error` : undefined} className={`${fieldClass} h-10 w-full py-0`} />
                    </label>
                  </div>
                  {priceError && <p id={`${id}-price-error`} role="alert" className="mt-2 text-xs text-pink">{priceError}</p>}
                  <button type="submit" className="mt-3 h-9 w-full btn-lime text-xs font-bold">적용</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </fieldset>

    </section>
  );
}
