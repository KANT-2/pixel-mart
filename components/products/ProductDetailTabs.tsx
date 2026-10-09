"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import ReviewsPanel from "@/components/products/ReviewsPanel";
import QuestionsPanel from "@/components/products/QuestionsPanel";
import { createReviewStore } from "@/lib/reviews";
import { PRODUCT_TABS, tabForKey, tabFromHash, type ProductTab } from "@/utils/productFeedback";

interface ProductDetailTabsProps { productId: number; children: ReactNode; }

function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => { window.removeEventListener("hashchange", listener); window.removeEventListener("popstate", listener); };
}
const getHash = () => window.location.hash;
const serverHash = () => "";

const TAB_META: Record<ProductTab, { tag: string; label: string }> = {
  info: { tag: "ITEM INFO", label: "상품정보" },
  reviews: { tag: "REVIEW", label: "리뷰" },
  qna: { tag: "Q&A", label: "문의" },
};

export default function ProductDetailTabs(props: ProductDetailTabsProps) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  // 숨겨진 상품 화면의 작성 상태·요청이 다음 방문이나 다른 상품으로 남지 않게 합니다.
  if (pathname !== `/products/${props.productId}`) return null;
  return <DetailTabs key={`${props.productId}:${loading ? "checking" : user?.id ?? "guest"}`} {...props} />;
}

function DetailTabs({ productId, children }: ProductDetailTabsProps) {
  const { loading: authLoading } = useAuth();
  const hash = useSyncExternalStore(subscribeHash, getHash, serverHash);
  const active = tabFromHash(hash);
  const root = useRef<HTMLElement>(null);
  const buttons = useRef<Partial<Record<ProductTab, HTMLButtonElement | null>>>({});
  const reviews = useMemo(() => createReviewStore(productId), [productId]);
  const snapshot = useSyncExternalStore(reviews.subscribe, reviews.getSnapshot, reviews.getSnapshot);
  useEffect(() => { if (!authLoading) reviews.start(); return () => reviews.stop(); }, [reviews, authLoading]);
  useEffect(() => {
    if (!["#info", "#reviews", "#qna"].includes(hash)) return;
    const frame = requestAnimationFrame(() => root.current?.scrollIntoView({ block: "start", behavior: "instant" }));
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  function select(tab: ProductTab) {
    if (window.location.hash !== `#${tab}`) {
      window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${tab}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  }

  return <section ref={root} aria-label="상품 상세 정보와 후기" className="mt-14 min-w-0 scroll-mt-28">
    {/* 게임 메뉴 탭 — 고른 탭은 아래 창과 이어 붙는다 */}
    <div role="tablist" aria-label="상품 상세 탭" className="relative z-10 -mb-0.5 flex gap-1 sm:gap-1.5">
      {PRODUCT_TABS.map((tab) => {
        const on = active === tab;
        const meta = TAB_META[tab];
        const sub = tab === "reviews" ? (snapshot.data ? `★ ${snapshot.data.averageRating?.toFixed(1) ?? "—"} · ${snapshot.data.total}개` : snapshot.error ? "조회 실패" : "불러오는 중")
          : null;
        return <button key={tab} ref={(element) => { buttons.current[tab] = element; }} type="button" role="tab" id={`product-${productId}-tab-${tab}`} aria-controls={tab} aria-selected={on} tabIndex={on ? 0 : -1}
          onClick={() => select(tab)} onKeyDown={(event) => { const next = tabForKey(tab, event.key); if (next) { event.preventDefault(); select(next); buttons.current[next]?.focus(); } }}
          className={`group flex min-h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-t-md border-2 px-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint sm:flex-none sm:px-5 ${on ? "border-violet/70 border-b-panel bg-panel text-lime" : "border-frame bg-night text-sub hover:bg-panel-2 hover:text-ink"}`}>
          <span className="min-w-0 text-left">
            <span className="hidden whitespace-nowrap font-pixel text-[11px] tracking-widest sm:block">{on && <span aria-hidden="true" className="motion-safe:animate-[pulse_1.2s_steps(2)_infinite]">▶ </span>}{meta.tag}</span>
            <span className="block truncate text-sm font-bold sm:text-xs">{meta.label}{sub && <span className={`ml-1 hidden font-normal sm:inline ${tab === "qna" ? "text-violet" : "text-dim"}`}>{sub}</span>}</span>
          </span>
        </button>;
      })}
    </div>
    <div className="rounded-md rounded-tl-none border-2 border-violet/70 bg-panel p-4 shadow-[4px_4px_0_0_rgba(0,0,0,0.45)] sm:p-6">
    <div id="info" role="tabpanel" aria-labelledby={`product-${productId}-tab-info`} tabIndex={0} hidden={active !== "info"} className="focus-visible:outline-2 focus-visible:outline-mint">{children}</div>
    <div id="reviews" role="tabpanel" aria-labelledby={`product-${productId}-tab-reviews`} tabIndex={0} hidden={active !== "reviews"} className="focus-visible:outline-2 focus-visible:outline-mint"><ReviewsPanel productId={productId} snapshot={snapshot} load={reviews.load} /></div>
    <div id="qna" role="tabpanel" aria-labelledby={`product-${productId}-tab-qna`} tabIndex={0} hidden={active !== "qna"} className="focus-visible:outline-2 focus-visible:outline-mint"><QuestionsPanel productId={productId} /></div>
    </div>
  </section>;
}
