"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import type { ApiCategory } from "@/types/api";
import { formatPrice } from "@/utils/formatPrice";
import { changeProductQuery, productHref, PRODUCT_MAX_PRICE, type ProductQuery } from "@/utils/productQuery";

interface ProductFiltersProps {
  query: ProductQuery;
  categories: ApiCategory[];
}

const sortLabels: Record<ProductQuery["sort"], string> = {
  id: "기본순",
  new: "신상품순",
  popular: "인기순",
  price_asc: "낮은 가격순",
  price_desc: "높은 가격순",
};
const fieldClass = "min-w-0 rounded-lg border border-line bg-night px-3 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-violet";
const secondaryClass = "min-h-11 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm font-semibold text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet";

export default function ProductFilters({ query, categories }: ProductFiltersProps) {
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
    navigate(next);
  }

  const chips: { label: string; patch: Partial<ProductQuery> }[] = [];
  if (query.q) chips.push({ label: `검색: ${query.q}`, patch: { q: undefined } });
  if (query.category) chips.push({ label: categories.find((category) => category.slug === query.category)?.name ?? query.category, patch: { category: undefined } });
  if (query.sort !== "id") chips.push({ label: sortLabels[query.sort], patch: { sort: "id" } });
  if (query.minPrice !== undefined) chips.push({ label: `${formatPrice(query.minPrice)} 이상`, patch: { minPrice: undefined } });
  if (query.maxPrice !== undefined) chips.push({ label: `${formatPrice(query.maxPrice)} 이하`, patch: { maxPrice: undefined } });
  if (query.new) chips.push({ label: "NEW만 보기", patch: { new: undefined } });

  return (
    <section aria-label="상품 검색 및 필터" aria-busy={pending} className="mb-6 min-w-0 rounded-2xl border border-line bg-panel p-4 sm:p-5">
      <fieldset disabled={pending} className="min-w-0 disabled:opacity-70">
      <form role="search" aria-label="상품 검색" onSubmit={submitSearch} className="flex min-w-0 gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`${id}-search`} className="sr-only">상품 검색어</label>
          <input
            id={`${id}-search`}
            name="q"
            type="search"
            maxLength={50}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="어떤 아이템을 찾으세요?"
            className={`${fieldClass} min-h-11 w-full pr-12 [&::-webkit-search-cancel-button]:appearance-none`}
          />
          {search && (
            <button type="button" aria-label="검색어 지우기" className="absolute inset-y-0 right-0 w-11 rounded-r-lg text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-violet" onClick={() => {
              setSearch("");
              if (query.q) navigate(changeProductQuery(query, { q: undefined }));
            }}>×</button>
          )}
        </div>
        <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-lime px-4 text-sm font-bold text-lime-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet">검색</button>
      </form>

      <button type="button" aria-expanded={expanded} aria-controls={`${id}-filters`} className={`${secondaryClass} mt-3 flex w-full items-center justify-between sm:hidden`} onClick={() => setExpanded(!expanded)}>
        <span>정렬 · 가격 필터</span><span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      <div id={`${id}-filters`} className={`${expanded ? "block" : "hidden"} mt-4 sm:block`}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] lg:items-end">
          <label className="grid min-w-0 gap-2 text-sm text-sub">
            정렬
            <select aria-label="상품 정렬" value={query.sort} className={`${fieldClass} min-h-11 w-full`} onChange={(event) => navigate(changeProductQuery(query, { sort: event.target.value as ProductQuery["sort"] }))}>
              {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <form onSubmit={applyPrice} aria-label="가격 범위" className="min-w-0">
            <p className="mb-2 text-sm text-sub">가격 범위</p>
            <div className="flex min-w-0 items-center gap-2">
              <label className="min-w-0 flex-1">
                <span className="sr-only">최소 가격</span>
                <input name="minPrice" inputMode="numeric" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="최소 금액" aria-invalid={Boolean(priceError)} aria-describedby={priceError ? `${id}-price-error` : undefined} className={`${fieldClass} min-h-11 w-full`} />
              </label>
              <span aria-hidden="true" className="text-dim">~</span>
              <label className="min-w-0 flex-1">
                <span className="sr-only">최대 가격</span>
                <input name="maxPrice" inputMode="numeric" value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="최대 금액" aria-invalid={Boolean(priceError)} aria-describedby={priceError ? `${id}-price-error` : undefined} className={`${fieldClass} min-h-11 w-full`} />
              </label>
              <button type="submit" className={`${secondaryClass} shrink-0`}>적용</button>
            </div>
            {priceError && <p id={`${id}-price-error`} role="alert" className="mt-2 text-sm text-pink">{priceError}</p>}
          </form>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-sub">
            <input type="checkbox" checked={Boolean(query.new)} onChange={(event) => navigate(changeProductQuery(query, { new: event.target.checked ? true : undefined }))} className="size-4 accent-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet" />
            NEW만 보기
          </label>
        </div>
      </div>
      </fieldset>

      {chips.length > 0 && (
        <div aria-label="적용된 필터" className="mt-4 flex min-w-0 flex-wrap items-center gap-2 border-t border-line pt-4">
          {chips.map((chip) => (
            <Link key={Object.keys(chip.patch)[0]} href={productHref(changeProductQuery(query, chip.patch))} scroll={false} aria-label={`${chip.label} 필터 해제`} className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs text-sub hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet">
              <span className="max-w-56 truncate" title={chip.label}>{chip.label}</span><span aria-hidden="true" className="text-base">×</span>
            </Link>
          ))}
          <Link href="/products" scroll={false} className="grid min-h-10 place-items-center rounded-lg px-2 text-xs font-semibold text-sub underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet">전체 초기화</Link>
        </div>
      )}
    </section>
  );
}
