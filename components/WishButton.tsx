"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useWishlist } from "@/components/WishlistProvider";
import { safeNextPath } from "@/utils/safeNextPath";
import styles from "./WishButton.module.css";

interface WishButtonProps { productId: number; productName: string; }

export default function WishButton({ productId, productName }: WishButtonProps) {
  const { user, loading: authLoading, pending: authPending } = useAuth();
  const { wishedIds, loading, ready, errors, error, toggle, refresh } = useWishlist();
  const [pulse, setPulse] = useState(0);
  const messageId = useId();
  const router = useRouter();
  const wished = Boolean(user && wishedIds.has(productId));
  const checking = authLoading || Boolean(user && loading);
  const failedLoad = Boolean(user && !ready && !loading);
  const message = errors.get(productId) ?? (failedLoad ? error : null);

  function handleClick() {
    if (!user) {
      const next = safeNextPath(window.location.pathname + window.location.search + window.location.hash);
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!ready) { void refresh().catch(() => undefined); return; }
    setPulse((value) => value + 1);
    void toggle(productId).catch(() => undefined);
  }

  return <div className="relative shrink-0">
    <button type="button" aria-pressed={wished} disabled={checking || authPending}
      aria-label={`${productName} ${failedLoad ? "찜 상태 다시 확인" : wished ? "찜 해제" : "찜하기"}`}
      aria-describedby={message ? messageId : undefined}
      title={failedLoad ? "찜 목록을 불러오지 못했어요. 눌러서 다시 확인해 주세요." : undefined}
      onClick={handleClick}
      className={`grid size-11 place-items-center btn-pixel transition-colors hover:border-pink/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet disabled:cursor-wait ${wished ? "text-pink" : "text-sub"}`}>
      {checking ? <span aria-hidden="true" className="size-5 animate-pulse rounded bg-panel" /> : failedLoad ? <span aria-hidden="true" className="font-pixel">↻</span> :
        <svg key={pulse} aria-hidden="true" viewBox="-1 -1 18 17" className={`size-5 ${pulse ? styles.pulse : ""}`} shapeRendering="crispEdges">
          <path d="M2 1h4v2h4V1h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2V9H0V3h2Z"
            fill={wished ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1" />
        </svg>}
    </button>
    {message && <p id={messageId} role={failedLoad ? undefined : "alert"} className={failedLoad ? "sr-only" : "absolute right-0 top-full z-20 mt-2 w-52 max-w-[75vw] pixel-panel p-3 text-sm text-pink"}>
      {message}{failedLoad && <span className="mt-1 block text-xs text-sub">버튼을 눌러 다시 확인해 주세요.</span>}
    </p>}
  </div>;
}
