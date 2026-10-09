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
    <Link href="/mypage/wishlist" aria-label="찜한 아이템" title="찜한 아이템" className={`${iconButton} text-pink`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-5 fill-current" shapeRendering="crispEdges"><path d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z" /></svg>
    </Link>
    <Link href="/mypage/gifts" aria-label={count ? `선물함, 받기 대기 ${count}개` : "선물함"} title="선물함" className={iconButton}>
      <span aria-hidden="true" className="text-lg leading-none">🎁</span>
      {count > 0 && <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-5 rounded bg-pink px-1 text-center font-pixel text-xs leading-5 text-night">{count > 9 ? "9+" : count}</span>}
    </Link>
  </>;
}
