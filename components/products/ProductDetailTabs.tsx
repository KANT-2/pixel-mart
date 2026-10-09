"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import ReviewsPanel from "@/components/products/ReviewsPanel";
import QuestionsPanel from "@/components/products/QuestionsPanel";
import { createReviewStore } from "@/lib/reviews";
import { questions } from "@/lib/questions";
import { PRODUCT_TABS, tabForKey, tabFromHash, type ProductTab } from "@/utils/productFeedback";

interface ProductDetailTabsProps { productId: number; children: ReactNode; }

function subscribeHash(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => { window.removeEventListener("hashchange", listener); window.removeEventListener("popstate", listener); };
}
const getHash = () => window.location.hash;
const serverHash = () => "";

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
    <div role="tablist" aria-label="상품 상세 탭" className="mb-6 grid grid-cols-3 gap-1 border-b border-line pb-2 sm:gap-2">
      {PRODUCT_TABS.map((tab) => <button key={tab} ref={(element) => { buttons.current[tab] = element; }} type="button" role="tab" id={`product-${productId}-tab-${tab}`} aria-controls={tab} aria-selected={active === tab} tabIndex={active === tab ? 0 : -1}
        onClick={() => select(tab)} onKeyDown={(event) => { const next = tabForKey(tab, event.key); if (next) { event.preventDefault(); select(next); buttons.current[next]?.focus(); } }}
        className={`min-h-16 min-w-0 rounded-t-lg border-b-2 px-1 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint ${active === tab ? "border-mint bg-panel text-mint" : "border-transparent text-sub hover:bg-panel"}`}>
        {tab === "info" ? "상품정보" : tab === "reviews" ? <>리뷰<span className="mt-1 block min-h-4 text-[11px] font-normal">{snapshot.data ? `★ ${snapshot.data.averageRating?.toFixed(1) ?? "—"} · ${snapshot.data.total}개` : snapshot.error ? "조회 실패" : "불러오는 중"}</span></> : <>Q&A{questions.mode === "demo" && <span className="mt-1 block text-[11px] font-normal text-violet">데모 데이터</span>}</>}
      </button>)}
    </div>
    <div id="info" role="tabpanel" aria-labelledby={`product-${productId}-tab-info`} tabIndex={0} hidden={active !== "info"} className="rounded-xl border border-line bg-panel p-5 focus-visible:outline-2 focus-visible:outline-mint sm:p-6">{children}</div>
    <div id="reviews" role="tabpanel" aria-labelledby={`product-${productId}-tab-reviews`} tabIndex={0} hidden={active !== "reviews"} className="focus-visible:outline-2 focus-visible:outline-mint"><ReviewsPanel productId={productId} snapshot={snapshot} load={reviews.load} /></div>
    <div id="qna" role="tabpanel" aria-labelledby={`product-${productId}-tab-qna`} tabIndex={0} hidden={active !== "qna"} className="focus-visible:outline-2 focus-visible:outline-mint"><QuestionsPanel productId={productId} /></div>
  </section>;
}
