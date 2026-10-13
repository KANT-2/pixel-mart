"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { giftApi } from "@/lib/gifts";
import { localApi } from "@/lib/local";
import { api } from "@/lib/api";
import WorldMapTeaser from "@/components/home/WorldMapTeaser";
import ThemePicker from "@/components/home/ThemePicker";
import HeroStage from "@/components/hero/HeroStage";
import styles from "./HomeCarousel.module.css";
import { deskThemes } from "@/data/deskLookbook";
import type { ApiProduct, ApiWishMapItem } from "@/types/api";

interface Activity { gifts: number; matches: number; trades: number }
interface HomeState { activity: Activity | null; wishes: ApiWishMapItem[]; region: string | null; error: boolean }
const empty: HomeState = { activity: null, wishes: [], region: null, error: false };
const labels = ["내 퀘스트", "데스크 룩북", "토너먼트 예고", "월드맵", "내 캐릭터"];
/** 저절로 넘어가는 간격 — 사용자가 한 번이라도 넘기면 멈춘다 */
const AUTOPLAY_MS = 7000;
const slideOrder = [4, 3, 1];

interface HomeCarouselProps { questOnly?: boolean }

export default function HomeCarousel({ questOnly = false }: HomeCarouselProps) {
  const { user, loading } = useAuth();
  const [slide, setSlide] = useState(questOnly ? 0 : 4);
  const [themeIndex, setThemeIndex] = useState(0);
  const [state, setState] = useState<HomeState>(empty);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  // 한 번이라도 직접 넘기면 자동 넘김을 그만둔다
  const [manual, setManual] = useState(false);
  const [paused, setPaused] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const theme = deskThemes[themeIndex];
  const [themeProducts, setThemeProducts] = useState<{ slug: string; items: ApiProduct[]; failed: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
    let active = true;
    void Promise.allSettled(theme.productIds.map((id) => api.get<ApiProduct>(`/products/${id}`, { signal }))).then((results) => {
      if (!active) return;
      setThemeProducts({ slug: theme.slug, items: results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []), failed: results.some((result) => result.status === "rejected") });
    });
    return () => { active = false; controller.abort(); };
  }, [theme]);

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
      setBusy(false);
    });
    return () => { active = false; controller.abort(); };
  }, [user, retry]);

  // 사용자 전환 중 이전 계정의 활동을 노출하지 않습니다.
  const [loadedUser, setLoadedUser] = useState(user?.id);
  if (loadedUser !== user?.id) { setLoadedUser(user?.id); setState(empty); setBusy(false); }
  const change = (index: number) => { if (questOnly) return; setManual(true); setSlide(index); };
  const move = (direction: number) => change(slideOrder[(slideOrder.indexOf(slide) + direction + slideOrder.length) % slideOrder.length]);
  // 7초마다 다음 배너로 — 마우스를 올리거나 포커스가 있으면 잠깐 멈추고, 직접 넘기면 그만둔다
  useEffect(() => {
    if (questOnly || paused || manual || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setSlide((current) => slideOrder[(slideOrder.indexOf(current) + 1) % slideOrder.length]), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [slide, paused, manual, questOnly]);
  const neighborhood = state.wishes.length > 0;
  const title = slide === 0 ? "오늘의 퀘스트를 확인하세요." : slide === 1 ? neighborhood ? "이웃이 찾는 아이템, 내 취향에도 딱." : "일상에 아이템을 장착하세요." : "당신의 데스크가 다음 주인공.";

  return <section aria-label="메인 추천 배너" aria-roledescription="캐러셀" className={`${styles.carousel} mx-auto w-full max-w-6xl px-12 py-6 md:px-14 md:py-10 xl:px-8`}>
    <div tabIndex={0} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} className={`pixel-panel relative focus-visible:outline-2 focus-visible:outline-mint ${styles.unframed}`} onKeyDown={(event) => { if (slide === 3 || event.target instanceof HTMLSelectElement) return; if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); } }}
      onTouchStart={(event) => { if (event.target instanceof Element && event.target.closest("a, button, select")) { start.current = null; return; } const touch = event.touches[0]; start.current = { x: touch.clientX, y: touch.clientY }; }}
      onTouchCancel={() => { start.current = null; }}
      onTouchEnd={(event) => { const touch = event.changedTouches[0]; if (start.current && slide !== 3) { const dx = touch.clientX - start.current.x; const dy = touch.clientY - start.current.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1); } start.current = null; }}>
      <div role="group" aria-roledescription="슬라이드" aria-label={`${slideOrder.indexOf(slide) + 1}/${slideOrder.length} ${labels[slide]}`} className="relative isolate grid min-h-[640px] grid-cols-1 items-center gap-6 overflow-hidden rounded-t-[inherit] px-5 py-8 md:h-[508px] md:min-h-0 md:grid-cols-2 md:gap-8 md:px-10 md:py-10 lg:gap-12">
        {slide === 4 ? <>
          <div className="min-w-0">
            {/* 무대는 유저의 정체성 자리 — 아바타를 만들면 슬라임 대신 내 캐릭터가, 콜라보 시즌엔 그 세계관 무대가 선다 */}
            <p className="mb-4 font-pixel text-xs tracking-widest text-mint">PLAYER IDENTITY</p>
            <h1 className="font-pixel text-3xl font-bold leading-tight text-ink md:text-4xl">{user?.avatarUrl
              ? <>오늘의 주인공,<br /><span className="break-all text-mint">{user.nickname}</span></>
              : <>이 무대의 주인공은<br /><span className="text-mint">당신의 캐릭터.</span></>}</h1>
            <p className="mt-4 text-sm leading-relaxed text-sub">픽셀 아바타를 만들면 슬라임 대신 내가 무대에 서요.<br />콜라보 시즌엔 무대도 그 세계관으로 갈아입어요.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {/* 비로그인이면 아바타 안내 화면을 거치지 않고 바로 로그인 → 끝나면 아바타 만들기로 */}
              <Link href={user?.avatarUrl ? "/products" : user ? "/mypage/avatar" : "/login?next=/mypage/avatar"} className="btn-lime px-4 py-3 text-sm font-bold">{user?.avatarUrl ? "▶ 오늘의 장비 고르기" : "▶ 내 픽셀 아바타 만들기"}</Link>
              <Link href={user?.avatarUrl ? "/mypage/avatar" : "/products"} className="btn-pixel px-4 py-3 text-sm font-bold">{user?.avatarUrl ? "아바타 꾸미기" : "아이템 둘러보기"}</Link>
            </div>
          </div>
          {/* 넓은 화면은 슬라이드 높이가 고정이라 4:3 무대가 잘리지 않게 폭을 맞추고, 오른쪽 끝을 헤더·상품 목록과 맞춘다 */}
          <div className={`${styles.stageSlot} w-full min-w-0`}><HeroStage wide /></div>
        </> : slide === 3 ? <div className="min-w-0 md:col-span-2"><WorldMapTeaser embedded /></div> : <>
        {slide === 1 && <div aria-hidden="true" className={`${styles.lookbookBg} pointer-events-none absolute -z-10`}>
          {/* 사진 가장자리를 배경으로 녹여 상자 없이 — 글자 쪽은 투명하게 */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 최적화된 정적 배경 WebP */}
          <img src={theme.image} alt="" className="h-full w-full object-cover" />
        </div>}
        <div className="min-w-0">
          <p className="mb-4 font-pixel text-xs tracking-widest text-mint">{slide === 0 ? "PIXEL QUEST" : slide === 1 ? "DESK LOOKBOOK" : "COMING SOON"}</p>
          {/* 월드맵 배너처럼 두 줄로 — 쉼표나 "을/를 " 뒤에서 줄바꿈 */}
          <h1 className="font-pixel text-3xl font-bold leading-tight text-ink md:text-4xl">{splitTitle(title)}</h1>
          <p className="mt-4 min-h-14 text-sm leading-relaxed text-sub">{slide === 0 ? "도착한 선물과 매칭, 진행 중인 거래를 한눈에 확인하세요." : slide === 1 ? neighborhood ? "공개 기준을 충족한 우리 동네의 인기 찜 상품을 살펴보세요." : "키캡·장패드·소품으로 나만의 데스크를 꾸며보세요." : "취향으로 꾸민 데스크를 만나는 토너먼트를 준비하고 있어요."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn-lime px-4 py-3 text-sm font-bold" href={slide === 0 ? user ? "/local/trades/mine" : "/login" : slide === 1 ? `/lookbook?theme=${theme.slug}` : "/lookbook"}>{slide === 0 ? user ? "내 거래 보기 →" : "로그인하고 퀘스트 보기 →" : slide === 1 ? `${theme.name} 테마 상품 보기 →` : "데스크 테마 둘러보기 →"}</Link>
            {slide === 0 && <Link className="btn-pixel px-4 py-3 text-sm font-bold" href="/mypage/gifts">선물함 보기 →</Link>}
            {/* 룩북은 두 번째 버튼 자리에서 바로 테마를 바꾼다 */}
            {slide === 1 && <ThemePicker themes={deskThemes} value={themeIndex} onChange={setThemeIndex} />}
          </div>
          {slide === 2 && <p className="mt-4 text-xs text-dim">준비 중 · 투표와 알림 신청은 아직 제공하지 않아요.</p>}
        </div>
        <div className="min-w-0">
          {slide === 0 ? <div className="rounded-lg border border-line bg-panel-2 p-5">
            <h2 className="font-pixel text-lg text-mint">MY QUEST</h2>
            {loading || busy ? <p role="status" className="mt-5 animate-pulse text-sub">활동을 확인하고 있어요…</p> : !user ? <p className="mt-5 text-sub">로그인하면 내 선물과 거래를 확인할 수 있어요.</p> : state.activity ? <dl className="mt-5 grid grid-cols-3 gap-2">{[["수락 대기 선물", state.activity.gifts], ["현재 매칭", state.activity.matches], ["진행 중 거래", state.activity.trades]].map(([label, count]) => <div key={label} className="rounded border border-line bg-panel p-3"><dt className="text-xs text-sub">{label}</dt><dd className="mt-3 text-3xl font-bold text-mint">{count}</dd></div>)}</dl> : <p className="mt-5 text-sub">활동을 불러오지 못했어요.</p>}
            {user && !loading && !busy && state.activity && <div className="mt-4 space-y-2">
              <h3 className="text-xs font-bold tracking-wide text-sub">활동 바로가기</h3>
              <Link href="/mypage/gifts" className="flex items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2 text-sm hover:border-mint focus-visible:outline-2 focus-visible:outline-mint">
                <span>🎁 {state.activity.gifts > 0 ? `수락을 기다리는 선물 ${state.activity.gifts}개` : "수락 대기 중인 선물이 없어요"}</span><span aria-hidden="true" className="text-mint">→</span>
              </Link>
              <Link href="/local/trades/mine" className="flex items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2 text-sm hover:border-mint focus-visible:outline-2 focus-visible:outline-mint">
                <span>🤝 {state.activity.matches > 0 ? `현재 거래 매칭 ${state.activity.matches}개 확인하기` : "현재 연결된 거래 매칭이 없어요"}</span><span aria-hidden="true" className="text-mint">→</span>
              </Link>
              <Link href="/local/trades/mine" className="flex items-center justify-between gap-3 rounded border border-line bg-panel px-3 py-2 text-sm hover:border-mint focus-visible:outline-2 focus-visible:outline-mint">
                <span>📋 {state.activity.trades > 0 ? `진행 중인 내 거래 ${state.activity.trades}개 관리하기` : "진행 중인 내 거래가 없어요"}</span><span aria-hidden="true" className="text-mint">→</span>
              </Link>
              {state.activity.gifts === 0 && state.activity.matches === 0 && state.activity.trades === 0 && <p className="pt-1 text-xs leading-relaxed text-sub">아직 진행 중인 퀘스트가 없어요. <Link href="/local/trades" className="text-mint underline underline-offset-4">동네 교환글 둘러보기 →</Link></p>}
            </div>}
            {user && state.error && <button type="button" onClick={() => setRetry((value) => value + 1)} className="btn-pixel mt-4 px-3 py-2 text-xs">다시 확인</button>}
          </div> : slide === 1 ? <div className="self-end rounded-lg border border-line bg-night/85 p-3 md:p-4">
            <h2 className="mb-3 text-sm font-bold text-ink">{theme.name} 테마 추천</h2>
            {themeProducts?.slug !== theme.slug ? <p role="status" className="animate-pulse py-8 text-sm text-sub">테마 상품을 불러오고 있어요…</p> : <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{themeProducts.items.slice(0, 3).map((product) => <Link key={product.id} href={`/products/${product.id}`} className="min-w-0 rounded border border-line bg-panel p-2 hover:border-mint focus-visible:outline-2 focus-visible:outline-mint">
                {/* eslint-disable-next-line @next/next/no-img-element -- 상품 목록과 동일한 이미지 방식 */}
                <img src={product.imageUrl} alt={product.name} className="aspect-[2/1] w-full rounded object-cover" />
                <p className="mt-2 truncate text-xs text-ink">{product.name}</p>
                <p className="mt-1 text-xs font-bold text-lime">{product.price.toLocaleString("ko-KR")}원</p>
              </Link>)}</div>
              {themeProducts.failed && <p role="status" className="mt-3 text-xs text-sub">일부 상품을 불러오지 못했어요. 테마 상품 보기에서 다시 확인해 주세요.</p>}
            </>}
            <p className="mt-3 text-xs text-sub">AI 연출 이미지 · 실제 크기와 형태는 상세 정보 참고</p>
            {neighborhood && <ul className="mt-3 space-y-1 text-xs">{state.wishes.map((item) => <li key={item.product.id}><Link href={`/products/${item.product.id}`} className="text-sub hover:text-mint">동네 인기 찜 · {item.product.name} · {item.count}명 →</Link></li>)}</ul>}
          </div> : <div>
            {/* 생성 이미지는 실제 상품의 정확한 크기·형태를 보장하지 않습니다. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 정적 룩북 파일 */}
            <img src={slide === 1 ? theme.image : "/images/lookbook/retro.webp"} alt={slide === 1 ? `${theme.name} 상품으로 꾸민 데스크` : "토너먼트 분위기의 레트로 데스크"} className="aspect-video w-full rounded-lg object-cover" />
            <p className="mt-2 text-xs text-dim">AI 연출 이미지</p>
            {slide === 1 && neighborhood && <ul className="mt-3 space-y-1 text-sm">{state.wishes.map((item) => <li key={item.product.id}><Link href={`/products/${item.product.id}`} className="text-sub hover:text-mint">{item.product.name} · {item.count}명 찜 →</Link></li>)}</ul>}
            {slide === 1 && state.error && <p className="mt-2 text-xs text-sub">동네 정보 일부를 확인하지 못해 데스크 추천을 보여드려요.</p>}
          </div>}
        </div>
        </>}
      </div>
      {!questOnly && <>
      {/* 번호 탭 — 세 배너를 한 줄로 묶어 보여 주고, 진행 막대로 다음 배너까지 남은 시간 표시 */}
      <div className={`${styles.controls} flex items-center gap-2`}>
        <div className="flex min-w-0 flex-1 gap-1 sm:gap-4" role="group" aria-label="슬라이드 선택">{slideOrder.map((id, index) => <button type="button" key={id} aria-label={`${index + 1}번 ${labels[id]}`} aria-current={slide === id ? "true" : undefined} onClick={() => change(id)}
          className={`${styles.tab} group min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-mint sm:flex-none sm:basis-44`}>
          <span className={`${styles.track} block`}>{slide === id && <span key={`${slide}:${paused}`} className={`${styles.bar} ${paused || manual ? styles.barFull : ""} block`} />}</span>
          <span className={`mt-2 flex items-baseline gap-2 truncate text-xs ${slide === id ? "text-ink" : "text-dim group-hover:text-sub"}`}><span className="font-pixel">{String(index + 1).padStart(2, "0")}</span><span className="truncate font-semibold">{labels[id]}</span></span>
        </button>)}</div>
        <div className="flex shrink-0 gap-1">
          <button type="button" aria-label="이전 슬라이드" onClick={() => move(-1)} className={`${styles.arrow} grid size-10 place-items-center text-2xl text-sub hover:text-mint focus-visible:outline-2 focus-visible:outline-mint`}>‹</button>
          <button type="button" aria-label="다음 슬라이드" onClick={() => move(1)} className={`${styles.arrow} grid size-10 place-items-center text-2xl text-sub hover:text-mint focus-visible:outline-2 focus-visible:outline-mint`}>›</button>
        </div>
        <span aria-live="polite" aria-atomic="true" className="sr-only">{slideOrder.indexOf(slide) + 1}/{slideOrder.length} {slide === 4 ? "이 무대의 주인공은 당신의 캐릭터." : slide === 3 ? "우리 동네에도 같은 덕후가 있을까?" : title}</span>
      </div>
      </>}
    </div>
  </section>;
}

/** 배너 제목을 두 줄로 — 쉼표가 있으면 그 뒤, 없으면 가운데 띄어쓰기에서 */
function splitTitle(title: string) {
  const at = title.includes(", ") ? title.indexOf(", ") + 1 : title.lastIndexOf(" ", Math.ceil(title.length / 2) + 2);
  if (at <= 0) return title;
  return <>{title.slice(0, at).trim()}<br />{title.slice(at).trim()}</>;
}
