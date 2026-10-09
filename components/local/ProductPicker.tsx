"use client";

import { useCallback, useId, useState } from "react";
import type { ApiProduct, Page } from "@/types/api";
import { localApi } from "@/lib/local";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, localButton, localInput } from "@/components/local/LocalStates";
import { formatPrice } from "@/utils/formatPrice";

interface ProductPickerProps { selected: ApiProduct | null; onChange: (product: ApiProduct | null) => void; disabled?: boolean; }
export default function ProductPicker({ selected, onChange, disabled = false }: ProductPickerProps) {
  const [q, setQ] = useState("");
  const id = useId();
  const load = useCallback((signal: AbortSignal) => q.trim() ? localApi.searchProducts(q, signal) : Promise.resolve<Page<ApiProduct>>({ items: [], total: 0, page: 1, size: 6, totalPages: 1 }), [q]);
  const results = useLocalResource(load, 300);
  return <div className="space-y-4">
    {selected && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-mint/40 p-3"><p className="min-w-0 break-words text-sm text-mint">연결 상품: {selected.name}</p><button type="button" disabled={disabled} onClick={() => onChange(null)} className={localButton}>상품 연결 해제</button></div>}
    <label htmlFor={id} className="block text-sm font-semibold">상품 검색 (선택 사항)<input id={id} aria-label="연결할 상품 검색" type="search" maxLength={50} value={q} onChange={(event) => setQ(event.target.value)} disabled={disabled} placeholder="상품 이름으로 검색" className={`${localInput} mt-2`} /></label>
    {!q.trim() ? <p className="text-xs text-dim">물건과 같은 상품이 있다면 연결해 주세요. 검색 결과는 최대 6개예요.</p>
      : results.error ? <LocalError message={results.error} onRetry={() => void results.refresh()} busy={disabled} />
        : results.loading ? <div role="status" aria-label="상품 검색 중" className="h-28 animate-pulse rounded-lg bg-panel-2" />
          : results.data?.items.length ? <ul aria-label="연결 상품 검색 결과" className="grid gap-3 sm:grid-cols-2">
            {results.data.items.map((product) => <li key={product.id}><button type="button" aria-pressed={selected?.id === product.id} disabled={disabled} onClick={() => onChange(product)} className="flex h-full w-full items-center gap-3 rounded-lg border border-line p-3 text-left aria-pressed:border-mint focus-visible:outline-2 focus-visible:outline-mint">
              {/* eslint-disable-next-line @next/next/no-img-element -- 검색 결과의 API 상품 이미지를 표시합니다. */}
              <img src={product.imageUrl} alt="" className="size-14 shrink-0 rounded bg-panel-2 object-cover" /><span className="min-w-0 break-words text-sm">{product.name}<span className="mt-1 block text-xs text-sub">{formatPrice(product.price)}</span></span>
            </button></li>)}
          </ul> : <p role="status" className="text-sm text-sub">맞는 상품이 없어요. 다른 이름으로 검색하거나 연결 없이 작성할 수 있어요.</p>}
  </div>;
}
