"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { giftApi } from "@/lib/gifts";

const iconButton = "relative grid size-10 shrink-0 place-items-center btn-pixel transition-colors hover:border-violet/40";

/** 상단 바로가기 — 찜한 아이템, 선물함(받기 대기 수) */
export default function HeaderShortcuts() {
  const { user, loading } = useAuth();
  const [pending, setPending] = useState(0);

  // 로그인했을 때만 받기 대기 선물 수를 센다 (로그아웃·계정 전환 시 0으로)
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    giftApi.list("received", controller.signal)
      .then((gifts) => setPending(gifts.filter((gift) => gift.status === "pending").length))
      .catch(() => undefined);
    return () => { controller.abort(); setPending(0); };
  }, [user]);

  const count = user && !loading ? pending : 0;
  return <>
    {/* 장바구니 아이콘처럼 색 없이 흰 선으로 */}
    <Link href="/mypage/wishlist" aria-label="찜한 아이템" title="찜한 아이템" className={iconButton}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
      </svg>
    </Link>
    <Link href="/mypage/gifts" aria-label={count ? `선물함, 받기 대기 ${count}개` : "선물함"} title="선물함" className={iconButton}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12" />
        <path d="M12 8c-1.5-3.5-5.5-3.8-5.5-1.5S10 8 12 8zM12 8c1.5-3.5 5.5-3.8 5.5-1.5S14 8 12 8z" />
      </svg>
      {count > 0 && <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-5 rounded bg-pink px-1 text-center font-pixel text-xs leading-5 text-night">{count > 9 ? "9+" : count}</span>}
    </Link>
  </>;
}
