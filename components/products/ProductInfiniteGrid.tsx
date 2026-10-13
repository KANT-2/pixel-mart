"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { ProductSkeleton } from "@/components/products/ProductStates";
import { api } from "@/lib/api";
import type { ApiProduct, Page } from "@/types/api";

interface ProductInfiniteGridProps {
  /** 서버가 그린 첫 페이지 */
  initial: ApiProduct[];
  totalPages: number;
  size: number;
  /** 백엔드 /api/products 쿼리 (page 제외) */
  apiQuery: string;
}

/** 전체 상품 — 페이지 번호 대신 아래로 내리면 다음 상품을 이어서 불러온다 */
export default function ProductInfiniteGrid({ initial, totalPages, size, apiQuery }: ProductInfiniteGridProps) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const done = page >= totalPages;

  const loadMore = useCallback(async () => {
    if (busy.current || done) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams(apiQuery);
      params.set("page", String(page + 1));
      params.set("size", String(size));
      const next = await api.get<Page<ApiProduct>>(`/products?${params}`);
      // 같은 상품이 두 번 보이지 않게 (불러오는 사이 순서가 바뀐 경우)
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...next.items.filter((item) => !seen.has(item.id))];
      });
      setPage(page + 1);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [apiQuery, done, page, size]);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || done || failed) return;
    // 바닥에 닿기 조금 전(600px)부터 미리 불러온다
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadMore(); }, { rootMargin: "600px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [done, failed, loadMore]);

  return <>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
    {loading && <div className="mt-3 sm:mt-4"><ProductSkeleton count={4} /></div>}
    <div ref={sentinel} aria-hidden="true" />
    <div className="mt-10 text-center">
      {failed ? <>
        <p role="alert" className="mb-3 text-sm text-sub">상품을 더 불러오지 못했어요.</p>
        <button type="button" onClick={() => void loadMore()} className="btn-pixel px-5 py-2.5 text-sm font-bold">다시 시도</button>
      </> : done ? <p className="font-pixel text-xs tracking-widest text-dim">— ALL ITEMS LOADED —</p>
        : !loading && <button type="button" onClick={() => void loadMore()} className="btn-pixel px-5 py-2.5 text-sm font-bold">더 보기</button>}
    </div>
  </>;
}
