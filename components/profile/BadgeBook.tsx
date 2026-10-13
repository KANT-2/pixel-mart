"use client";

import { useCallback } from "react";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import { useAuth } from "@/components/AuthProvider";
import { LocalError } from "@/components/local/LocalStates";
import { useLocalResource } from "@/components/local/useLocalResource";
import { localApi } from "@/lib/local";

/** 마이페이지 뱃지 도감 — 받은 뱃지는 밝게, 아직인 뱃지는 흐리게 조건과 함께 */
export default function BadgeBook() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <BadgeGrid />;
}

function BadgeGrid() {
  const load = useCallback((signal: AbortSignal) => localApi.myBadges(signal), []);
  const book = useLocalResource(load);

  return <section aria-label="뱃지 도감" className="pixel-panel mb-6 p-5 text-left">
    <div className="flex items-center justify-between gap-3">
      <p className="font-pixel text-[11px] tracking-widest text-lime">▶ BADGES</p>
      {book.data && <p className="text-sm text-sub"><strong className="text-ink">{book.data.earnedCount}</strong> / {book.data.total}</p>}
    </div>
    {book.loading && !book.data ? <div className="mt-3 h-40 animate-pulse rounded-lg bg-panel-2" />
      : book.error && !book.data ? <div className="mt-3"><LocalError message={book.error} onRetry={book.refresh} /></div>
      : book.data && <>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {book.data.items.map((badge) => <li key={badge.code} title={badge.description}
            className={`rounded-lg border p-2.5 ${badge.earned ? "border-lime/40 bg-panel-2" : "border-line bg-night opacity-60"}`}>
            <p className="flex items-center gap-2 text-sm font-bold">
              <PixelAvatar src={badge.image} className={`size-8 shrink-0 ${badge.earned ? "" : "opacity-50 grayscale"}`} />
              <span className="truncate">{badge.name}</span>
              <span className="sr-only">{badge.earned ? "받음" : "아직 못 받음"}</span>
            </p>
            <p className="mt-1 text-[11px] leading-snug text-sub">{badge.description}</p>
          </li>)}
        </ul>
        <p className="mt-3 text-xs text-dim">이웃 카드에는 받은 뱃지 중 가장 받기 어려운 뱃지 하나가 대표로 보여요.</p>
      </>}
  </section>;
}
