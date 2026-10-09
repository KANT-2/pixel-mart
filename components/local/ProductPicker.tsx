"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ApiProduct } from "@/types/api";
import { localApi } from "@/lib/local";
import { localButton, localInput } from "@/components/local/LocalStates";
import { formatPrice } from "@/utils/formatPrice";
import { rarityOf } from "@/utils/gameItem";

interface ProductPickerProps { selected: ApiProduct | null; onChange: (product: ApiProduct | null) => void; disabled?: boolean; }

/** 거래글에 연결할 상품 — 찾기를 누르면 결과 전체를 모달에서 보고 고른다 */
export default function ProductPicker({ selected, onChange, disabled = false }: ProductPickerProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const search = () => { if (q.trim()) setOpen(q.trim()); };
  return <div className="space-y-4">
    {selected && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-mint/40 p-3"><p className="min-w-0 break-words text-sm text-mint">연결 상품: {selected.name}</p><button type="button" disabled={disabled} onClick={() => onChange(null)} className={localButton}>상품 연결 해제</button></div>}
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">상품 검색 (선택 사항)</label>
      <div className="mt-2 flex gap-1.5">
        {/* 바깥 글쓰기 form 안이라 Enter가 저장이 되지 않게 막고 찾기로 */}
        <input id={id} aria-label="연결할 상품 검색" type="search" maxLength={50} value={q} onChange={(event) => setQ(event.target.value)} disabled={disabled} enterKeyHint="search"
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }}
          placeholder="상품 이름으로 검색 (예: 키캡)" className={`${localInput} min-w-0 flex-1`} />
        <button type="button" disabled={disabled || !q.trim()} onClick={search} className="btn-lime min-h-11 shrink-0 px-4 text-sm font-bold disabled:opacity-50">찾기</button>
      </div>
      <p className="mt-2 text-xs text-dim">물건과 같은 상품이 있다면 연결해 주세요. 찾기를 누르면 결과 전체에서 고를 수 있어요.</p>
    </div>
    {open && <ProductSearchModal key={open} initial={open} selectedId={selected?.id ?? null}
      onClose={() => setOpen(null)} onPick={(product) => { onChange(product); setQ(""); setOpen(null); }} />}
  </div>;
}

interface ProductSearchModalProps { initial: string; selectedId: number | null; onClose: () => void; onPick: (product: ApiProduct) => void; }

function ProductSearchModal({ initial, selectedId, onClose, onPick }: ProductSearchModalProps) {
  const [text, setText] = useState(initial);
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState<ApiProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const input = useRef<HTMLInputElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  // 검색어·페이지가 바뀔 때만 불러온다 — 첫 페이지면 새로, 다음 페이지면 이어 붙인다
  useEffect(() => {
    const controller = new AbortController();
    localApi.searchProducts(q, controller.signal, page)
      .then((result) => {
        setItems((current) => page === 1 ? result.items : [...current, ...result.items]);
        setTotal(result.total); setTotalPages(result.totalPages); setError(null);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "검색하지 못했어요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [q, page]);

  // 열려 있는 동안 Esc로 닫기, 뒤 화면 스크롤 막기
  useEffect(() => {
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close.current(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, []);

  const submit = () => {
    const next = text.trim().slice(0, 50);
    if (!next || next === q) return;
    setLoading(true); setItems([]); setPage(1); setQ(next);
  };

  return <div className="fixed inset-0 z-50 grid place-items-center bg-night/80 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="pixel-panel flex max-h-[85dvh] w-full max-w-3xl flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b-2 border-frame bg-panel-2 px-4 py-3">
        <h2 id={titleId} className="font-pixel text-sm tracking-widest text-lime">▶ ITEM SEARCH · 상품 고르기</h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="btn-pixel h-9 px-3 text-sm font-bold">✕</button>
      </header>
      <div className="flex gap-1.5 p-4 pb-2">
        <input ref={input} type="search" aria-label="상품 이름" value={text} maxLength={50} onChange={(event) => setText(event.target.value)} enterKeyHint="search"
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} className={`${localInput} min-w-0 flex-1`} />
        <button type="button" onClick={submit} disabled={!text.trim()} className="btn-lime min-h-11 shrink-0 px-4 text-sm font-bold disabled:opacity-50">찾기</button>
      </div>
      <p role="status" className="px-4 text-xs text-dim">{loading && !items.length ? "찾는 중…" : `'${q}' 검색 결과 ${total}개`}</p>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? <p role="alert" className="text-sm text-pink">{error}</p>
          : !loading && !items.length ? <p className="py-8 text-center text-sm text-sub">맞는 상품이 없어요. 다른 이름으로 찾거나 연결 없이 작성할 수 있어요.</p>
            : <ul aria-label="상품 검색 결과" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((product) => {
                const rarity = rarityOf(product.price);
                return <li key={product.id}>
                  <button type="button" aria-pressed={selectedId === product.id} onClick={() => onPick(product)}
                    className="flex h-full w-full flex-col gap-2 rounded-md border-2 border-frame bg-night p-2 text-left hover:border-lime aria-pressed:border-lime focus-visible:outline-2 focus-visible:outline-mint">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 검색 결과의 API 상품 이미지 */}
                    <img src={product.imageUrl} alt="" className="aspect-square w-full rounded bg-panel-2 object-cover" />
                    <span className="min-w-0 text-sm font-bold leading-snug" style={{ color: rarity.key === "common" ? undefined : rarity.color }}>{product.name}</span>
                    <span className="text-xs text-sub">{formatPrice(product.price)}</span>
                  </button>
                </li>;
              })}
            </ul>}
        {page < totalPages && !error && <div className="mt-4 text-center">
          <button type="button" disabled={loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }} className="btn-pixel min-h-11 px-6 text-sm font-bold disabled:opacity-50">{loading ? "불러오는 중…" : "더 보기"}</button>
        </div>}
      </div>
    </div>
  </div>;
}
