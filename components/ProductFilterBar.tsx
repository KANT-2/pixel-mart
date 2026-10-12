"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { RarityCount } from "@/lib/products";
import { RARITY_RANGES, rarityInfo } from "@/utils/gameItem";
import { formatPrice } from "@/utils/formatPrice";
import { changeProductQuery, productHref, PRODUCT_MAX_PRICE, toggleRarity, type ProductQuery } from "@/utils/productQuery";

export interface CategoryCount { slug?: string; name: string; count: number; }

interface ProductFilterBarProps {
  query: ProductQuery;
  /** 맨 앞은 '전체' (slug 없음) */
  categories: CategoryCount[];
  rarityCounts: RarityCount[];
}

const chip = "btn-pixel toggle-outline flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet";

/**
 * 한 줄 필터 — 왼쪽 '필터' 드롭다운(카테고리 · 가격 · NEW만), 오른쪽 등급 버튼(여러 개 동시 선택, 다시 누르면 해제).
 * 링크로 이동하므로 새로고침·공유해도 같은 조건이 유지된다.
 */
export default function ProductFilterBar({ query, categories, rarityCounts }: ProductFilterBarProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const current = categories.find((item) => item.slug && item.slug === query.category);
  const priceActive = query.minPrice !== undefined || query.maxPrice !== undefined;
  const active = Boolean(current || query.new || priceActive);
  const summary = [current?.name, priceActive && "가격", query.new && "NEW"].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  // 넓은 화면은 검색·정렬과 같은 줄(버튼 폭만큼), 좁으면 다음 줄 전체 — 링크 버튼이라 글자 선택·커서는 막는다
  return <div className="flex min-w-0 basis-full select-none items-center gap-2 caret-transparent lg:flex-none lg:basis-auto">
    <div ref={root} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={`${id}-menu`} aria-pressed={active}
        className={`${chip} text-sub hover:text-ink aria-pressed:border-lime aria-pressed:text-lime aria-expanded:border-violet`}>
        <span aria-hidden="true">☰</span>필터
        {active && <span className="max-w-32 truncate font-normal text-ink">· {summary}</span>}
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div id={`${id}-menu`} className="pixel-panel absolute left-0 top-full z-30 mt-2 max-h-[75vh] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto p-3">
        <p className="mb-2 font-pixel text-[10px] tracking-widest text-mint">▶ CATEGORY</p>
        <ul aria-label="카테고리" className="grid gap-1">
          {categories.map((row) => {
            const selected = row.slug === query.category;
            return <li key={row.name}>
              <Link href={productHref(changeProductQuery(query, { category: row.slug }))} scroll={false} onClick={() => setOpen(false)}
                aria-current={selected ? "page" : undefined}
                className="flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-panel-2 aria-[current=page]:bg-panel-2 aria-[current=page]:font-bold aria-[current=page]:text-mint">
                <span><span aria-hidden="true" className="mr-2 inline-block w-3">{selected ? "✓" : ""}</span>{row.name}</span>
                <span className="text-xs text-dim">{row.count}</span>
              </Link>
            </li>;
          })}
        </ul>
        <PriceRange query={query} onDone={() => setOpen(false)} />
        <div className="mt-3 border-t border-line pt-3">
          <Link href={productHref(changeProductQuery(query, { new: query.new ? undefined : true }))} scroll={false} onClick={() => setOpen(false)}
            role="switch" aria-checked={Boolean(query.new)}
            className="flex items-center justify-between rounded-md px-2.5 py-2 text-sm font-bold hover:bg-panel-2">
            <span><span className="mr-1.5 rounded bg-violet px-1 font-pixel text-[10px] text-night">NEW</span>신상품만 보기</span>
            <span aria-hidden="true" className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${query.new ? "justify-end bg-lime" : "justify-start bg-panel-2"}`}>
              <span className="size-4 rounded-full bg-ink" />
            </span>
          </Link>
        </div>
      </div>}
    </div>

    {/* 등급 — 한 줄(좁으면 옆으로 밀어 보기), 여러 개 동시 선택, 다시 누르면 해제 */}
    <ul aria-label="아이템 등급 (여러 개 선택 가능)" className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
      {rarityCounts.map((row) => {
        const info = rarityInfo(row.key);
        const selected = Boolean(query.rarity?.includes(row.key));
        return <li key={row.key}>
          <Link href={productHref(changeProductQuery(query, { rarity: toggleRarity(query.rarity, row.key) }))} scroll={false}
            role="checkbox" aria-checked={selected} aria-label={`${info.label} 등급 · ${RARITY_RANGES[row.key]} · ${row.count}개${selected ? " (선택됨, 다시 누르면 해제)" : ""}`}
            className={chip}
            style={{ color: info.color, borderColor: selected ? info.color : undefined, background: selected ? `color-mix(in srgb, ${info.color} 16%, transparent)` : undefined }}>
            <span aria-hidden="true" className="grid size-3.5 place-items-center rounded-sm border text-[9px] leading-none" style={{ borderColor: info.color, background: selected ? info.color : "transparent", color: "var(--color-night)" }}>{selected ? "✓" : ""}</span>
            <span className="font-pixel">{info.label}</span>
            <span className={selected ? "text-ink" : "text-dim"}>{row.count}</span>
          </Link>
        </li>;
      })}
    </ul>
  </div>;
}

const fieldClass = "pixel-input h-10 w-full min-w-0 px-3 py-0 text-sm text-ink";

interface PriceRangeProps { query: ProductQuery; onDone: () => void; }

/** 필터 안의 가격 범위 — 원 단위 정수, 최소가 최대보다 크면 서로 바꿔 적용 */
function PriceRange({ query, onDone }: PriceRangeProps) {
  const router = useRouter();
  const id = useId();
  const [minimum, setMinimum] = useState(query.minPrice?.toString() ?? "");
  const [maximum, setMaximum] = useState(query.maxPrice?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const active = query.minPrice !== undefined || query.maxPrice !== undefined;

  function go(next: ProductQuery) {
    onDone();
    router.push(productHref(next), { scroll: false });
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = [minimum.trim(), maximum.trim()];
    if (values.some((value) => value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))))) {
      setError("가격은 0 이상의 정수로 입력해 주세요.");
      return;
    }
    if (values.some((value) => value && Number(value) > PRODUCT_MAX_PRICE)) {
      setError(`가격은 ${formatPrice(PRODUCT_MAX_PRICE)} 이하로 입력해 주세요.`);
      return;
    }
    setError(null);
    go(changeProductQuery(query, { minPrice: values[0] ? Number(values[0]) : undefined, maxPrice: values[1] ? Number(values[1]) : undefined }));
  }

  return <form onSubmit={apply} aria-label="가격 범위" className="mt-3 border-t border-line pt-3">
    <p className="mb-2 flex items-center justify-between font-pixel text-[10px] tracking-widest text-mint">
      <span>▶ PRICE RANGE</span>
      {active && <button type="button" onClick={() => go(changeProductQuery(query, { minPrice: undefined, maxPrice: undefined }))}
        className="font-sans text-xs tracking-normal text-sub underline hover:text-ink">가격 해제</button>}
    </p>
    <div className="flex min-w-0 items-center gap-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">최소 가격</span>
        <input name="minPrice" inputMode="numeric" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="최소"
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={fieldClass} />
      </label>
      <span aria-hidden="true" className="text-dim">~</span>
      <label className="min-w-0 flex-1">
        <span className="sr-only">최대 가격</span>
        <input name="maxPrice" inputMode="numeric" value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="최대"
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={fieldClass} />
      </label>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-pink">{error}</p>}
    <button type="submit" className="mt-2 h-9 w-full btn-lime text-xs font-bold text-lime-ink">가격 적용</button>
  </form>;
}
