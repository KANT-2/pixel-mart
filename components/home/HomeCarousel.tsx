"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { giftApi } from "@/lib/gifts";
import { localApi } from "@/lib/local";
import { deskThemes } from "@/data/deskLookbook";
import type { ApiWishMapItem } from "@/types/api";

interface Activity { gifts: number; matches: number; trades: number }
interface HomeState { activity: Activity | null; wishes: ApiWishMapItem[]; region: string | null; error: boolean }
const empty: HomeState = { activity: null, wishes: [], region: null, error: false };
const labels = ["내 퀘스트", "취향별 데스크", "토너먼트 예고"];

export default function HomeCarousel() {
  const { user, loading } = useAuth();
  const [slide, setSlide] = useState(1);
  const [themeIndex, setThemeIndex] = useState(0);
  const [state, setState] = useState<HomeState>(empty);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const interacted = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const theme = deskThemes[themeIndex];

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
    let active = true;
    // 실패를 0건으로 오해하지 않도록 집계와 오류를 구분합니다.
    queueMicrotask(() => { if (active) setBusy(true); });
    const personal = Promise.all([giftApi.list("received", signal), localApi.matches(signal), localApi.myTrades(signal)])
      .then(([gifts, matches, trades]) => ({ gifts: gifts.filter((gift) => gift.status === "pending").length, matches: matches.length, trades: trades.filter((trade) => trade.status === "open").length }));
    const neighborhood = localApi.profile(signal).then(async (profile) => ({ region: profile.region?.code ?? null, wishes: profile.region ? await localApi.wishMap(profile.region.code, signal) : [] }));
    void Promise.allSettled([personal, neighborhood]).then(([activity, local]) => {
      if (!active) return;
      const next: HomeState = {
        activity: activity.status === "fulfilled" ? activity.value : null,
        region: local.status === "fulfilled" ? local.value.region : null,
        wishes: local.status === "fulfilled" ? local.value.wishes.filter((row) => row.count >= 5 && !row.isSample).slice(0, 3) : [],
        error: activity.status === "rejected" || local.status === "rejected",
      };
      setState(next);
      if (!interacted.current) setSlide(next.activity && (next.activity.gifts || next.activity.matches || next.activity.trades) ? 0 : 1);
      setBusy(false);
    });
    return () => { active = false; controller.abort(); };
  }, [user, retry]);

  // 사용자 전환 중 이전 계정의 활동을 노출하지 않습니다.
  const [loadedUser, setLoadedUser] = useState(user?.id);
  if (loadedUser !== user?.id) { setLoadedUser(user?.id); setState(empty); setBusy(false); }
  const change = (index: number) => { interacted.current = true; setSlide((index + 3) % 3); };
  const neighborhood = state.wishes.length > 0;
  const title = slide === 0 ? "오늘의 퀘스트를 확인하세요." : slide === 1 ? neighborhood ? "이웃이 찾는 아이템, 내 취향에도 딱." : "일상에 아이템을 장착하세요." : "당신의 데스크가 다음 주인공.";

  return <section aria-label="메인 추천 배너" aria-roledescription="캐러셀" className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
    <div tabIndex={0} className="pixel-panel relative overflow-hidden focus-visible:outline-2 focus-visible:outline-mint" onKeyDown={(event) => { if (event.target instanceof HTMLSelectElement) return; if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); change(slide + (event.key === "ArrowRight" ? 1 : -1)); } }}
      onTouchStart={(event) => { const touch = event.touches[0]; start.current = { x: touch.clientX, y: touch.clientY }; }}
      onTouchEnd={(event) => { const touch = event.changedTouches[0]; if (start.current) { const dx = touch.clientX - start.current.x; const dy = touch.clientY - start.current.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) change(slide + (dx < 0 ? 1 : -1)); } start.current = null; }}>
      <div className="grid min-h-[640px] items-center gap-6 px-12 py-5 md:min-h-[450px] md:grid-cols-[0.85fr_1.15fr] md:px-16 md:py-8">
        <div>
          <p className="mb-4 font-pixel text-xs tracking-widest text-mint">{slide === 0 ? "PIXEL QUEST" : slide === 1 ? "DESK LOOKBOOK" : "COMING SOON"}</p>
          <h1 className="text-3xl leading-tight font-extrabold text-ink md:text-4xl">{title}</h1>
          <p className="mt-4 min-h-14 text-sm leading-relaxed text-sub">{slide === 0 ? "도착한 선물과 매칭, 진행 중인 거래를 한눈에 확인하세요." : slide === 1 ? neighborhood ? "공개 기준을 충족한 우리 동네의 인기 찜 상품을 살펴보세요." : "키캡·장패드·소품으로 나만의 데스크를 꾸며보세요." : "취향으로 꾸민 데스크를 만나는 토너먼트를 준비하고 있어요."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-lime px-4 py-3 text-sm font-bold" href={slide === 0 ? user ? "/local/trades/mine" : "/login" : slide === 1 ? `/lookbook?theme=${theme.slug}` : "/lookbook"}>{slide === 0 ? user ? "내 거래 보기 →" : "로그인하고 퀘스트 보기 →" : slide === 1 ? `${theme.name} 테마 상품 보기 →` : "데스크 테마 둘러보기 →"}</Link>
            {slide !== 2 && <Link className="btn-pixel px-4 py-3 text-sm font-bold" href={slide === 0 ? "/mypage/gifts" : `/local/wish-map${state.region ? `?region=${encodeURIComponent(state.region)}` : ""}`}>{slide === 0 ? "선물함 보기 →" : "이웃 요청 보기 →"}</Link>}
          </div>
          {slide === 1 && <div className="mt-4"><label htmlFor="hero-theme" className="mr-2 text-sm text-sub">데스크 테마</label><select id="hero-theme" value={themeIndex} onChange={(event) => setThemeIndex(Number(event.target.value))} className="rounded border border-line bg-panel p-2 text-sm">{deskThemes.map((item, index) => <option key={item.slug} value={index}>{item.name}</option>)}</select></div>}
          {slide === 2 && <p className="mt-4 text-xs text-dim">준비 중 · 투표와 알림 신청은 아직 제공하지 않아요.</p>}
        </div>
        <div className="min-w-0">
          {slide === 0 ? <div className="rounded-lg border border-line bg-panel-2 p-5">
            <h2 className="font-pixel text-lg text-mint">MY QUEST</h2>
            {loading || busy ? <p role="status" className="mt-5 animate-pulse text-sub">활동을 확인하고 있어요…</p> : !user ? <p className="mt-5 text-sub">로그인하면 내 선물과 거래를 확인할 수 있어요.</p> : state.activity ? <dl className="mt-5 grid grid-cols-3 gap-2">{[["수락 대기 선물", state.activity.gifts], ["현재 매칭", state.activity.matches], ["진행 중 거래", state.activity.trades]].map(([label, count]) => <div key={label} className="rounded border border-line bg-panel p-3"><dt className="text-xs text-sub">{label}</dt><dd className="mt-3 text-3xl font-bold text-mint">{count}</dd></div>)}</dl> : <p className="mt-5 text-sub">활동을 불러오지 못했어요.</p>}
            {user && state.error && <button type="button" onClick={() => setRetry((value) => value + 1)} className="btn-pixel mt-4 px-3 py-2 text-xs">다시 확인</button>}
          </div> : <div>
            {/* 생성 이미지는 실제 상품의 정확한 크기·형태를 보장하지 않습니다. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 정적 룩북 파일 */}
            <img src={slide === 1 ? theme.image : "/images/lookbook/retro.webp"} alt={slide === 1 ? `${theme.name} 상품을 배치한 데스크 예시` : "토너먼트 분위기를 보여주는 레트로 데스크 예시"} className="aspect-video w-full rounded-lg object-cover" />
            <p className="mt-2 text-xs text-dim">생성 이미지 · 상품 배치 예시</p>
            {slide === 1 && neighborhood && <ul className="mt-3 space-y-1 text-sm">{state.wishes.map((item) => <li key={item.product.id}><Link href={`/products/${item.product.id}`} className="text-sub hover:text-mint">{item.product.name} · {item.count}명 찜 →</Link></li>)}</ul>}
            {slide === 1 && state.error && <p className="mt-2 text-xs text-sub">동네 정보 일부를 확인하지 못해 데스크 추천을 보여드려요.</p>}
          </div>}
        </div>
      </div>
      <div className="flex items-center justify-center border-t border-line px-5 py-5">
        <button type="button" aria-label="이전 슬라이드" onClick={() => change(slide - 1)} className="btn-pixel absolute left-1 top-[calc(50%-24px)] z-10 flex size-10 -translate-y-1/2 items-center justify-center md:left-3">←</button>
        <div className="flex gap-2">{labels.map((label, index) => <button type="button" key={label} aria-label={`${index + 1}번 ${label}`} aria-current={slide === index ? "true" : undefined} onClick={() => change(index)} className={`h-3 w-7 rounded-full ${slide === index ? "bg-mint" : "bg-panel-2 border border-line"}`} />)}</div>
        <span aria-live="polite" aria-atomic="true" className="sr-only">{slide + 1}/3 {title}</span>
        <button type="button" aria-label="다음 슬라이드" onClick={() => change(slide + 1)} className="btn-pixel absolute right-1 top-[calc(50%-24px)] z-10 flex size-10 -translate-y-1/2 items-center justify-center md:right-3">→</button>
      </div>
    </div>
  </section>;
}
