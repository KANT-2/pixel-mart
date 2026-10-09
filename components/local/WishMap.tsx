"use client";

import PixelIcon from "@/components/PixelIcon";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import PixelMap, { type MapBlock } from "@/components/local/PixelMap";
import { useLocalProfile, useRegions } from "@/components/local/LocalProvider";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, LocalSkeleton, localInput, localToolbar } from "@/components/local/LocalStates";
import { localApi } from "@/lib/local";
import { MAP_VIEWS } from "@/lib/localMapData";
import { formatPrice } from "@/utils/formatPrice";
import { rarityOf } from "@/utils/gameItem";
import { giftHref } from "@/utils/gift";
import { containsContact } from "@/utils/localTrades";
import { viewCodeFor, viewTrail } from "@/utils/localMap";
import type { ApiRegion, ApiTradePost } from "@/types/api";

const HEART = "/images/hero-heart.svg";

function wishHref(region: string | null, nickname: string | null) {
  const params = new URLSearchParams();
  if (region !== null) params.set("region", region);
  if (nickname) params.set("q", nickname);
  const query = params.toString();
  return `/local/wish-map${query ? `?${query}` : ""}`;
}

/** 위시맵 — 픽셀 지도 위에 동네별 WISH(갖고 싶은 아이템) 하트, 고른 동네의 WISH 글에서 바로 선물 */
export default function WishMap() {
  const params = useSearchParams();
  const regions = useRegions();
  const profile = useLocalProfile();
  const catalog = useMemo(() => regions.data ?? [], [regions.data]);
  const byCode = useMemo(() => new Map(catalog.map((region) => [region.code, region])), [catalog]);
  const nickname = params.get("q")?.trim().slice(0, 30) || null;
  // URL에 지역이 없으면 내 동네부터 (빈 값은 "전체"를 고른 상태)
  const focus = params.has("region") ? params.get("region") || null : profile.data?.region?.code ?? null;
  const viewCode = viewCodeFor(focus, catalog, MAP_VIEWS);
  const view = MAP_VIEWS[viewCode];
  const selected = focus && focus !== viewCode && view.legend.includes(focus) ? focus : null;
  const go = useCallback((region: string | null, q: string | null = null) => window.history.pushState(null, "", wishHref(region ?? "", q)), []);

  const loadCounts = useCallback((signal: AbortSignal) => localApi.wishWants(view.legend, signal), [view.legend]);
  const counts = useLocalResource(loadCounts);
  const blocks: MapBlock[] = view.legend.map((code) => {
    const row = counts.data?.find((item) => item.regionCode === code);
    const count = row?.count ?? 0;
    return { code, name: byCode.get(code)?.name ?? code, count: count || null, pins: Array(Math.min(count, 4)).fill(HEART), sample: row?.sample ?? false, hint: "WISH", unit: "개" };
  });
  const choose = (code: string) => {
    if (MAP_VIEWS[code]) go(code); // 시·구는 지도 안으로
    else go(selected === code ? viewCode : code);
  };
  const trail = viewTrail(viewCode, catalog);
  const place = selected ?? (viewCode || null);

  if (regions.error) return <LocalError message={regions.error} onRetry={() => void regions.refresh()} />;
  return <div className="space-y-3">
    {/* 탭 공통 도구 막대 — 왼쪽 지도 위치, 오른쪽 동네·닉네임 찾기 */}
    <div className={localToolbar}>
      <nav aria-label="지도 위치" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 px-1 font-pixel text-sm">
          <button type="button" onClick={() => go("")} className="rounded px-1.5 py-1 text-mint hover:bg-panel">전체</button>
          {trail.map((code) => <span key={code} className="flex items-center gap-1">
            <span aria-hidden="true" className="text-dim">›</span>
            <button type="button" onClick={() => go(code)} aria-current={code === viewCode ? "location" : undefined}
              className="rounded px-1.5 py-1 text-sub hover:bg-panel aria-[current=location]:text-ink">{byCode.get(code)?.name ?? code}</button>
          </span>)}
        </nav>
      <WishSearch key={nickname ?? ""} regions={catalog} nickname={nickname} onRegion={(code) => go(code)} onNickname={(q) => go(focus, q)} />
    </div>

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="mx-auto w-full" style={{ maxWidth: `calc((100dvh - 15rem) * ${view.cols / view.rows})` }}>
        {counts.error ? <LocalError message={counts.error} onRetry={() => void counts.refresh()} busy={counts.loading} /> : (
          <PixelMap view={view} blocks={blocks} selected={selected} seedKey="wish" onSelect={choose}
            label={`${trail.length ? byCode.get(viewCode)?.name : "서비스 지역 전체"} 위시맵${counts.loading ? " (불러오는 중)" : ""}`} />
        )}
        <p className="mt-2 text-xs leading-relaxed text-dim">
          <PixelIcon name="heart" className="mr-1 size-3.5" />하트는 그 동네에서 진행 중인 WISH(갖고 싶은 아이템) 글이에요. 지역을 누르면 안으로 들어가고, 동네를 고르면 그 동네 글 목록이 열려요. 닉네임은 &lsquo;위시맵에 닉네임 공개&rsquo;를 켠 이웃만 보여요.
        </p>
      </div>
      {nickname
        ? <WantPanel key={`q:${nickname}`} title={`'${nickname}' 검색`} kicker="PLAYER SEARCH" region={null} nickname={nickname} onClear={() => go(focus)} />
        : <WantPanel key={`r:${place ?? ""}`} title={place ? byCode.get(place)?.fullName ?? place : "서비스 지역 전체"} kicker={selected ? "NEIGHBORHOOD" : "AREA"} region={place} nickname={null} />}
    </div>
  </div>;
}

interface WishSearchProps { regions: ApiRegion[]; nickname: string | null; onRegion: (code: string) => void; onNickname: (q: string) => void; }

/** 동네 이름 또는 닉네임으로 찾기 — 전국으로 늘어나도 긴 목록 없이 */
function WishSearch({ regions, nickname, onRegion, onNickname }: WishSearchProps) {
  const [mode, setMode] = useState<"region" | "nickname">(nickname ? "nickname" : "region");
  const [text, setText] = useState(nickname ?? "");
  const keyword = text.trim();
  const matches = mode === "region" && keyword ? regions.filter((region) => region.fullName.includes(keyword)).slice(0, 6) : [];
  const [notFound, setNotFound] = useState(false);
  const pick = (code: string) => { onRegion(code); setText(""); setNotFound(false); };
  return <form role="search" aria-label="위시맵 찾기" className="flex w-full min-w-0 gap-1.5 sm:w-auto" onSubmit={(event) => {
    event.preventDefault();
    if (mode === "nickname" && keyword) onNickname(keyword);
    else if (matches[0]) pick(matches[0].code);
    else if (keyword) setNotFound(true);
  }}>
    <div role="group" aria-label="찾는 방법" className="segmented h-11 text-xs font-bold">
      <button type="button" aria-pressed={mode === "region"} onClick={() => { setMode("region"); setText(""); }}>동네</button>
      <button type="button" aria-pressed={mode === "nickname"} onClick={() => { setMode("nickname"); setText(""); }}>닉네임</button>
    </div>
    <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
      <label htmlFor="wish-search" className="sr-only">{mode === "region" ? "동네 이름" : "닉네임"}</label>
      <input id="wish-search" value={text} onChange={(event) => { setText(event.target.value.slice(0, mode === "region" ? 20 : 30)); setNotFound(false); }}
        placeholder={mode === "region" ? "동네 검색 (예: 판교)" : "닉네임으로 찾기"} autoComplete="off" enterKeyHint="search"
        onKeyDown={(event) => { if (event.key === "Escape") setText(""); }} className={localInput} />
      {matches.length > 0 && <ul aria-label="동네 검색 결과" className="pixel-panel absolute inset-x-0 top-full z-20 mt-1 overflow-hidden">
        {matches.map((region) => <li key={region.code}>
          <button type="button" onClick={() => pick(region.code)} className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2">{region.fullName}</button>
        </li>)}
      </ul>}
      {notFound && <p role="status" className="absolute left-0 top-full z-20 mt-1 rounded bg-night px-2 py-1 text-xs text-pink">없는 동네예요.</p>}
    </div>
    <button type="submit" disabled={!keyword} className="btn-lime h-11 shrink-0 px-3 text-sm font-bold disabled:opacity-50">찾기</button>
  </form>;
}

interface WantPanelProps { title: string; kicker: string; region: string | null; nickname: string | null; onClear?: () => void; }

function WantPanel({ title, kicker, region, nickname, onClear }: WantPanelProps) {
  const loadWants = useCallback((signal: AbortSignal) => localApi.wants(region, nickname, signal), [region, nickname]);
  const wants = useLocalResource(loadWants);
  const loadTop = useCallback((signal: AbortSignal) => region ? localApi.wishMap(region, signal) : Promise.resolve([]), [region]);
  const top = useLocalResource(loadTop);
  const rows = wants.data?.items ?? [];
  const popular = (top.data ?? []).filter((row) => row.count >= 5).slice(0, 3);
  return <aside aria-label={`${title} WISH 글`} className="pixel-panel overflow-hidden">
    <header className="border-b-2 border-frame bg-panel-2 px-4 py-3">
      <p className="font-pixel text-[10px] tracking-widest text-lime">▶ {kicker}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <h2 className="min-w-0 break-keep text-lg font-extrabold">{title}</h2>
        {onClear && <button type="button" onClick={onClear} className="btn-pixel h-8 shrink-0 px-2.5 text-xs font-bold">지우기</button>}
      </div>
      {wants.data && <p className="mt-1 text-sm text-sub"><PixelIcon name="heart" className="mr-1 size-3.5" />WISH <strong className="text-pink">{wants.data.total}</strong>개</p>}
    </header>
    <div className="max-h-[min(60dvh,32rem)] overflow-y-auto p-3">
      {wants.error ? <LocalError message={wants.error} onRetry={() => void wants.refresh()} />
        : wants.loading ? <LocalSkeleton label="WISH 글 불러오는 중" />
          : rows.length ? <ul className="space-y-2">{rows.map((post) => <li key={post.id}><WantRow post={post} /></li>)}</ul>
            : <div className="p-4 text-center text-sm text-sub">
              <p className="font-pixel text-xs tracking-widest text-dim">EMPTY</p>
              <p className="mt-2">{nickname ? "닉네임을 공개한 이웃 중에 찾지 못했어요." : "아직 이 동네에 WISH 글이 없어요."}</p>
            </div>}
    </div>
    <footer className="space-y-3 border-t-2 border-frame p-3">
      {popular.length > 0 && <div>
        <p className="mb-1.5 font-pixel text-[10px] tracking-widest text-dim"><PixelIcon name="heart" className="mr-1 size-3" />이 동네 인기 찜</p>
        <ol className="space-y-1">{popular.map((row) => <li key={row.product.id} className="flex items-center justify-between gap-2 text-xs">
          <Link href={`/products/${row.product.id}`} className="min-w-0 truncate hover:text-mint"><span className="mr-1.5 font-pixel text-violet">{row.rank}</span>{row.product.name}</Link>
          <span className="shrink-0 text-dim">{row.count}명</span>
        </li>)}</ol>
      </div>}
    </footer>
  </aside>;
}

function WantRow({ post }: { post: ApiTradePost }) {
  const rarity = rarityOf(post.price ?? post.product?.price);
  const name = containsContact(post.itemName) ? "물건명 비공개" : post.itemName;
  // 선물은 사이트 상품을 위시한 이웃의 글에만
  const giftable = !post.isMine && !post.isSample && post.status === "open" && Boolean(post.product);
  return <article className="flex gap-2.5 rounded-md border-2 border-frame bg-night/60 p-2">
    <div className="relative grid size-12 shrink-0 place-items-end justify-center overflow-hidden rounded bg-[linear-gradient(#17123a,#2a1f5c)]">
      {post.author?.avatarUrl ? <PixelAvatar src={post.author.avatarUrl} alt="" className="size-10 object-bottom" /> : (
        // eslint-disable-next-line @next/next/no-img-element -- 픽셀 슬라임
        <img src="/images/hero-slime.svg" alt="" className={`size-10 object-contain object-bottom [image-rendering:pixelated] ${post.author ? "" : "brightness-75 grayscale-[40%]"}`} />
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs text-dim">
        <span className={post.author ? "font-bold text-ink" : ""}>{post.isMine ? "나" : post.author?.nickname ?? "이웃 플레이어"}</span> · {post.regionName.split(" ").at(-1)}
      </p>
      <p className="truncate font-bold" style={{ color: rarity.color }}><PixelIcon name="heart" className="mr-1 size-3.5" />{name}</p>
      <p className="truncate text-[11px] text-dim">{post.price !== null ? `희망가 ${formatPrice(post.price)}` : post.product ? `연결 상품 ${post.product.name}` : "가격 제안"}</p>
    </div>
    {giftable
      ? <Link href={giftHref(post)} aria-label={`${name} 선물하기`} className="btn-lime inline-flex h-9 shrink-0 items-center self-center px-2.5 text-xs font-bold"><PixelIcon name="chest" className="mr-1 size-3.5" />선물하기</Link>
      : <span title={post.isMine ? "내 글" : post.isSample ? "이 글에는 선물할 수 없어요" : "PIXEL MART 상품을 위시한 글에만 선물할 수 있어요"} className="btn-pixel inline-flex h-9 shrink-0 cursor-not-allowed items-center self-center px-2.5 text-xs font-bold opacity-40">선물하기</span>}
  </article>;
}
