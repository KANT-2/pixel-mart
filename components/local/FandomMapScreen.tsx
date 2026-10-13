"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InterestFilter from "@/components/local/InterestFilter";
import PixelMap, { type MapBlock } from "@/components/local/PixelMap";
import { useLocalProfile, useRegions } from "@/components/local/LocalProvider";
import { useLocalResource } from "@/components/local/useLocalResource";
import { useRegionLocator } from "@/components/local/useRegionLocator";
import { LocalError, localButton, localInput, localToolbar } from "@/components/local/LocalStates";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import NeighborCard from "@/components/local/NeighborCard";
import { MapNotes, SearchToggle, searchRow } from "@/components/local/MobileToggles";
import { HEAT_COLORS, HEAT_LABELS, characterIcon, shortRegionName } from "@/utils/mapSprites";
import { loadMapBlocks } from "@/lib/fandomMapData";
import { localApi } from "@/lib/local";
import { MAP_VIEWS } from "@/lib/localMapData";
import { interestProductHref, localHref, localSettingsHref, parseLocalQuery } from "@/utils/local";
import { viewCodeFor, viewTrail } from "@/utils/localMap";
import type { ApiBuyerRanking, ApiFandomRank, ApiMapCard, ApiRegion } from "@/types/api";


export default function FandomMapScreen() {
  const params = useSearchParams();
  const query = parseLocalQuery(params);
  const regions = useRegions();
  const profile = useLocalProfile();
  const catalog = useMemo(() => regions.data ?? [], [regions.data]);
  // URL에 지역이 없으면 저장한 내 동네부터 보여 준다 (빈 값은 "전체"를 고른 상태)
  const focus = query.hasRegion ? query.region : profile.data?.region?.code ?? null;
  const viewCode = viewCodeFor(focus, catalog, MAP_VIEWS);
  const view = MAP_VIEWS[viewCode];
  const selected = focus && focus !== viewCode && view.legend.includes(focus) ? focus : null;
  const byCode = useMemo(() => new Map(catalog.map((region) => [region.code, region])), [catalog]);

  const go = useCallback((region: string | null, interest = query.interest) => {
    window.history.pushState(null, "", localHref(region, "all", interest));
  }, [query.interest]);

  const loadBlocks = useCallback((signal: AbortSignal) => loadMapBlocks(viewCode, view.legend, query.interest, signal), [viewCode, view.legend, query.interest]);
  const blocks = useLocalResource(loadBlocks);
  // 칩은 취향을 골라도 바뀌지 않게 '전체' 기준 인기 취향으로 (같은 요청은 캐시돼 다시 받지 않음)
  const loadAllBlocks = useCallback((signal: AbortSignal) => loadMapBlocks(viewCode, view.legend, null, signal), [viewCode, view.legend]);
  const allBlocks = useLocalResource(loadAllBlocks);
  const loadInterests = useCallback((signal: AbortSignal) => localApi.interests("", undefined, signal), []);
  const interests = useLocalResource(loadInterests);
  const locator = useRegionLocator(catalog);
  // 들어올 때마다(새로고침·재입장) 캐릭터 자리를 새로 섞는다 — 같은 방문 안에서는 고정
  const [visit] = useState(() => Math.random().toString(36).slice(2, 8));

  const interestName = interests.data?.find((item) => item.id === query.interest)?.name;
  const mapBlocks: MapBlock[] = view.legend.map((code) => {
    const data = blocks.data?.find((block) => block.code === code);
    const region = byCode.get(code);
    const name = region ? shortRegionName(region.name, region.level) : code;
    // 이름표: "서울 · 슬라임 64명" — 취향을 고르면 그 취향, 아니면 그 지역 1위 취향
    const tag = (query.interest !== null ? interestName : data?.topInterest) ?? undefined;
    return { code, name, tag, count: data?.count ?? null, pins: data?.pins ?? [], sample: data?.sample ?? false, ranked: data?.ranked ?? false,
      hint: data?.real ? "지도 표시 이웃" : query.interest === null && data?.topInterest ? `${data.topInterest} 팬` : "같은 취향 이웃" };
  });

  // 캐릭터를 누르면 그 지역으로 가고, 오른쪽 구매 순위에서 그 캐릭터 줄을 강조한다
  // 캐릭터를 누르면 지도는 그대로 두고(뒤의 지역은 눌리지 않음) 그 캐릭터 지역의 순위를 패널에 연다 — 지도를 옮기면 풀림
  const [pinned, setPinned] = useState<{ view: string; code: string; rank: number | null; neighbor: Neighbor | null } | null>(null);
  const pin = pinned?.view === viewCode ? pinned : null;
  // 모바일: 검색 줄은 눌러서 펼치고, 지역 정보는 동네·캐릭터를 눌렀을 때 아래 시트로
  const [searchOpen, setSearchOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  // 펼치면 정보 윗부분이 화면에 들어오도록 조금만 스크롤 (지도는 위에 그대로)
  useEffect(() => {
    if (!sheet || window.matchMedia("(min-width: 640px)").matches) return;
    sheetRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [sheet, pinned]);
  const pickPin = (code: string, index: number) => {
    const block = mapBlocks.find((item) => item.code === code);
    const data = blocks.data?.find((item) => item.code === code);
    const card = data?.cards[index] ?? null;
    // 한 지역에 실제 이웃과 샘플 캐릭터가 섞일 수 있어 샘플 여부는 캐릭터마다 (카드가 없으면 실제 이웃)
    const neighbor = { avatar: block?.pins[index] ?? null, card, sample: Boolean(card?.isSample) };
    setPinned({ view: viewCode, code, rank: block?.ranked ? index + 1 : null, neighbor });
    setSheet(true);
  };
  const choose = (code: string) => {
    setPinned(null);
    if (MAP_VIEWS[code]) { go(code); return; } // 시·구는 지도 안으로
    setSheet(selected !== code);
    go(selected === code ? viewCode || "" : code); // 생활권은 선택/해제
  };
  const trail = viewTrail(viewCode, catalog);
  // 오른쪽 패널: 누른 캐릭터의 지역 → 고른 동네 → 보고 있는 지역
  const panelCode = pin?.code ?? selected ?? (viewCode || null);
  // 칩은 내 취향, 없으면 지금 지도에서 인기 있는 취향 몇 개만 — 나머지는 '취향 찾기'에서
  const saved = profile.data?.interests ?? [];
  const popularNames = [...new Set((allBlocks.data ?? []).map((block) => block.topInterest).filter(Boolean))];
  const popular = (interests.data ?? []).filter((item) => popularNames.includes(item.name)).slice(0, 5);
  const base = saved.length ? saved : popular;
  // 취향 찾기로 고른 취향도 칩으로 보여 준다 (옆 칩이 사라지지 않고 하나 더 붙음)
  const picked = interests.data?.find((item) => item.id === query.interest);
  const quickInterests = picked && !base.some((item) => item.id === picked.id) ? [...base, picked] : base;

  return <div className="space-y-3">
    {/* 1줄: 지도 위치 / 2줄: 왼쪽 취향 칩, 오른쪽 동네 검색 · 내 위치 — 위시맵과 같은 줄 구성이라 탭을 바꿔도 지도가 같은 자리 */}
    <nav aria-label="지도 위치" className="flex min-w-0 select-none flex-wrap items-center gap-1 font-pixel text-sm caret-transparent">
      <button type="button" onClick={() => go("")} aria-current={viewCode === "" ? "location" : undefined}
        className="rounded px-1.5 py-1 text-sub hover:bg-panel aria-[current=location]:text-mint">전체</button>
      {trail.map((code) => <span key={code} className="flex items-center gap-1">
        <span aria-hidden="true" className="text-dim">›</span>
        <button type="button" onClick={() => go(code)} aria-current={code === viewCode ? "location" : undefined}
          className="rounded px-1.5 py-1 text-sub hover:bg-panel aria-[current=location]:text-mint">{byCode.get(code)?.name ?? code}</button>
      </span>)}
    </nav>
    <div className={`${localToolbar} min-h-11 justify-between`}>
      <InterestFilter interests={interests.data ?? []} quick={quickInterests} selected={query.interest}
        onSelect={(id) => go(focus ?? "", id)} />
      <SearchToggle open={searchOpen} onToggle={() => setSearchOpen((value) => !value)} />
      <div className={`${searchRow(searchOpen)} sm:ml-auto`}>
      <RegionSearch regions={catalog} onPick={go} />
      <button type="button" onClick={() => locator.locate((code) => go(code))} disabled={locator.busy || locator.denied || !catalog.length}
        aria-label="내 위치로 보기 — 누를 때만 위치 권한을 요청하고 좌표는 저장하지 않아요" className={`${localButton} shrink-0 gap-1.5`}>
        <span aria-hidden="true">◎</span><span className="hidden sm:inline">{locator.busy ? "찾는 중…" : "내 위치로 보기"}</span></button>
      </div>
    </div>
    {locator.message && <p role="status" className="text-xs text-sub">{locator.message}</p>}

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="mx-auto w-full" style={{ maxWidth: `calc((100dvh - 15rem) * ${view.cols / view.rows})` }}>
        <div className="mb-2 flex items-center gap-2">
          <span aria-hidden="true" className="font-pixel text-sm text-lime">▮</span>
          <h2 className="text-base font-extrabold">{interestName ? `${interestName} 팬 분포` : "동네 인기 취향 분포"}</h2>
        </div>
        {blocks.error ? <LocalError message={blocks.error} onRetry={() => void blocks.refresh()} busy={blocks.loading} /> : (
          <PixelMap view={view} blocks={mapBlocks} selected={selected} seedKey={`${query.interest ?? "all"}:${visit}`} onSelect={choose} onPinSelect={pickPin} heat landmarks
            label={`${trail.length ? byCode.get(viewCode)?.name : "서비스 지역 전체"} 픽셀 지도${blocks.loading ? " (불러오는 중)" : ""}`} />
        )}
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-2 text-xs text-dim">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="지역 색 범례">
            <span className="font-bold text-sub">{interestName ?? "인기 취향"} 팬 수</span>
            {HEAT_LABELS.map((text, i) => <span key={text} className="flex items-center gap-1">
              <span aria-hidden="true" className="size-3 rounded-sm border border-night" style={{ background: HEAT_COLORS[i] }} />{text}
            </span>)}
          </div>
          <MapNotes><ul className="space-y-1">
            <li className="flex items-center gap-1.5"><PixelAvatar src={characterIcon("slime-1")} className="w-4" />캐릭터는 아바타 또는 장식이며 실제 위치·인원수와 일치하지 않아요.</li>
            <li className="flex items-center gap-1.5"><span aria-hidden="true" className="w-4 text-center">★</span>지역마다 구매 금액 상위 10명(금액 비공개) · 누르면 오른쪽 순위에서 찾아 줘요 · +/−로 확대</li>
          </ul></MapNotes>
        </div>
      </div>
      {/* 모바일: 지역을 고르기 전 안내 카드는 숨기고, 동네·캐릭터를 누르면 지도 아래에 펼친다 (지도를 가리지 않게) */}
      {panelCode && !sheet && <button type="button" onClick={() => setSheet(true)} className={`${localButton} w-full sm:hidden`}>
        {byCode.get(panelCode)?.name} 정보·구매 순위 보기
      </button>}
      <div ref={sheetRef} className={sheet ? "scroll-mt-20" : "hidden sm:block"} aria-label={sheet ? "지역 정보" : undefined}>
        {sheet && <div className="mb-2 flex justify-end sm:hidden">
          <button type="button" onClick={() => setSheet(false)} className="btn-pixel min-h-9 px-3 text-xs font-bold" aria-label="지역 정보 닫기">닫기 ✕</button>
        </div>}
        <PlacePanel code={panelCode} region={panelCode ? byCode.get(panelCode) ?? null : null}
          block={mapBlocks.find((block) => block.code === (pin?.code ?? selected)) ?? null} interestName={interestName} interest={query.interest}
          hasChildren={Boolean(panelCode && MAP_VIEWS[panelCode])} pickedRank={pin?.rank ?? null}
          // 닫기는 이웃 카드만 — 고른 지역 정보와 구매 순위는 그대로 둔다
          neighbor={pin?.neighbor ? { ...pin.neighbor, rank: pin.rank } : null} onCloseNeighbor={() => setPinned((current) => current && { ...current, neighbor: null })} />
      </div>
    </div>
  </div>;
}

interface RegionSearchProps { regions: ApiRegion[]; onPick: (code: string) => void; }

function RegionSearch({ regions, onPick }: RegionSearchProps) {
  const [text, setText] = useState("");
  const keyword = text.trim();
  const matches = keyword ? regions.filter((region) => region.fullName.includes(keyword)).slice(0, 6) : [];
  const [notFound, setNotFound] = useState(false);
  const pick = (code: string) => { onPick(code); setText(""); setNotFound(false); };
  const search = () => { if (matches[0]) pick(matches[0].code); else if (keyword) setNotFound(true); };
  return <form role="search" aria-label="동네 검색" onSubmit={(event) => { event.preventDefault(); search(); }} className="relative flex w-full min-w-0 gap-1.5 sm:w-80">
    <label htmlFor="region-search" className="sr-only">동네 검색</label>
    <input id="region-search" value={text} onChange={(event) => { setText(event.target.value.slice(0, 20)); setNotFound(false); }} placeholder="동네 검색 (예: 판교)"
      autoComplete="off" role="combobox" aria-expanded={matches.length > 0} aria-controls="region-search-list" enterKeyHint="search"
      onKeyDown={(event) => { if (event.key === "Escape") setText(""); }}
      className={`${localInput} min-w-0 flex-1`} />
    <button type="submit" className="btn-lime min-h-11 shrink-0 px-3 text-sm font-bold">찾기</button>
    {notFound && <p role="status" className="absolute left-0 top-full z-20 mt-1 rounded bg-night px-2 py-1 text-xs text-pink">없는 동네예요.</p>}
    {matches.length > 0 && <ul id="region-search-list" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden pixel-panel">
      {matches.map((region) => <li key={region.code} role="option" aria-selected={false}>
        <button type="button" onClick={() => pick(region.code)} className="block w-full px-3 py-2 text-left text-sm hover:bg-panel-2">{region.fullName}</button>
      </li>)}
    </ul>}
  </form>;
}

interface PlacePanelProps {
  code: string | null;
  region: ApiRegion | null;
  block: MapBlock | null;
  interest: number | null;
  interestName?: string;
  hasChildren: boolean;
  /** 지도에서 누른 캐릭터의 구매 순위 */
  pickedRank: number | null;
  /** 지도에서 누른 캐릭터의 이웃 카드 */
  neighbor: (Neighbor & { rank: number | null }) | null;
  onCloseNeighbor: () => void;
}

interface Neighbor { avatar: string | null; card: ApiMapCard | null; sample: boolean; }

function PlacePanel({ code, region, block, interest, interestName, hasChildren, pickedRank, neighbor, onCloseNeighbor }: PlacePanelProps) {
  const loadRanking = useCallback((signal: AbortSignal) => code ? localApi.ranking(code, "all", signal) : Promise.resolve([] as ApiFandomRank[]), [code]);
  const ranking = useLocalResource(loadRanking);
  const loadBuyers = useCallback((signal: AbortSignal) => code ? localApi.buyerRanking(code, interest ?? undefined, signal) : Promise.resolve(null as ApiBuyerRanking | null), [code, interest]);
  const buyers = useLocalResource(loadBuyers);
  if (!code || !region) return <PlaceGuide interest={interest} interestName={interestName} />;
  const top = (ranking.data ?? []).slice(0, 3);
  return <aside aria-label={`${region.fullName} 정보`} className="rounded-xl border-2 border-line bg-panel p-5">
    {neighbor && <div className="mb-4"><NeighborCard avatar={neighbor.avatar} card={neighbor.card} rank={neighbor.rank} sample={neighbor.sample} onClose={onCloseNeighbor} /></div>}
    <p className="font-pixel text-xs text-mint">{hasChildren ? "AREA" : "NEIGHBORHOOD"}</p>
    <h2 className="mt-1 break-keep text-lg font-extrabold">{region.fullName}</h2>
    {block && <p className="mt-3 text-sm">
      {block.count ? <><strong className="text-lime">{block.count}명</strong>의 {block.hint === "지도 표시 이웃" ? "이웃이 지도에 아바타를 보여 주고" : `${interestName ? `${interestName} 팬` : block.hint ?? "이웃"}이`} 있어요</> : "아직 이웃이 없어요"}
    </p>}
    {top.length > 0 && <div className="mt-4">
      <p className="mb-2 text-xs text-dim">이 동네 인기 취향</p>
      <ol className="space-y-1.5">{top.map((row) => <li key={row.interestId} className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate"><span className="mr-2 font-pixel text-violet">{row.rank}</span>{row.interest}</span>
        <span className="shrink-0 text-xs text-sub">{row.count}명</span>
      </li>)}</ol>
    </div>}
    <BuyerRanking ranking={buyers.data ?? null} loading={buyers.loading} picked={pickedRank} />
    <div className="mt-5 grid gap-2">
      <Link href={`/local/trades?region=${encodeURIComponent(code)}${interest ? `&interestId=${interest}` : ""}`} className={localButton}>이 동네 교환글 보기</Link>
      <Link href={interestProductHref(interestName)} className={localButton}>{interestName ? `${interestName} 관련 상품` : "상품 둘러보기"}</Link>
      <Link href={localSettingsHref(code)} className={localButton}>여기를 내 동네로</Link>
    </div>
  </aside>;
}

interface BuyerRankingProps { ranking: ApiBuyerRanking | null; loading: boolean; picked: number | null; }

/** 지역 구매 순위 TOP 10 — 금액은 비공개, 닉네임은 공개에 동의한 이웃만 (프로필 링크 없음) */
function BuyerRanking({ ranking, loading, picked }: BuyerRankingProps) {
  if (loading && !ranking) return <div className="mt-4 h-40 animate-pulse rounded bg-panel-2" />;
  if (!ranking) return null;
  return <section aria-label="구매 순위 TOP 10" className="mt-4">
    <p className="mb-2 flex items-center justify-between text-xs text-dim">
      <span>구매 순위 TOP 10</span>
      <span>금액 비공개</span>
    </p>
    {ranking.items.length === 0 ? <p className="text-sm text-sub">아직 순위에 오른 이웃이 없어요.</p> : (
      <ol className="space-y-1">{ranking.items.map((row) => <li key={row.rank} aria-current={row.rank === picked || undefined}
        className="flex items-center gap-2 rounded px-1 text-sm aria-[current=true]:bg-panel-2 aria-[current=true]:outline aria-[current=true]:outline-2 aria-[current=true]:outline-lime">
        <span className={`w-5 shrink-0 text-center font-pixel ${row.rank <= 3 ? "text-lime" : "text-violet"}`}>{row.rank}</span>
        <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded bg-panel-2">
          <PixelAvatar src={row.avatarUrl ?? "/images/hero-slime.svg"} className="max-h-6 max-w-6" />
        </span>
        <span className={`min-w-0 truncate ${row.nickname ? "" : "text-sub"}`}>{row.nickname ?? "이웃 플레이어"}</span>
      </li>)}</ol>
    )}
  </section>;
}

interface PlaceGuideProps { interest: number | null; interestName?: string; }

/** 지역을 고르기 전 — 지역을 누르면 볼 수 있는 것 세 가지 */
function PlaceGuide({ interest, interestName }: PlaceGuideProps) {
  const fan = interestName ?? "같은 취향";
  const about = interestName ? `${interestName} 관련 ` : "";
  const cards = [
    { title: "동네별 같은 취향 이웃", text: `해당 지역의 ${fan}을 좋아하는 이웃들을 볼 수 있어요.`, href: "/local/settings", icons: ["slime-2", "slime-1", "slime-3"] },
    { title: "거래·교환글", text: `해당 지역의 ${about}거래·교환글을 모아 볼 수 있어요.`, href: `/local/trades${interest ? `?interestId=${interest}` : ""}`, icons: ["robot-1", "bunny-1"] },
    { title: "관심 있는 상품", text: `해당 지역에서 인기 있는 ${about}상품을 볼 수 있어요.`, href: interestProductHref(interestName), icons: ["bear-2"] },
  ];
  return <aside aria-label="지역을 누르면 볼 수 있는 것" className="rounded-xl border-2 border-line bg-panel p-5">
    <h2 className="text-lg font-extrabold">지역을 누르면 무엇을 볼 수 있나요?</h2>
    <ul className="mt-4 space-y-2.5">{cards.map((card) => <li key={card.title}>
      <Link href={card.href} className="flex items-center gap-3 rounded-lg border-2 border-line bg-night p-3 hover:border-violet">
        <span aria-hidden="true" className="flex w-14 shrink-0 items-end justify-center -space-x-1">
          {card.icons.map((icon) => <PixelAvatar key={icon} src={characterIcon(icon)} className={card.icons.length > 1 ? "w-6" : "w-9"} />)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{card.title}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-sub">{card.text}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-dim">›</span>
      </Link>
    </li>)}</ul>
    <Link href="/local/settings" className="btn-lime mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-extrabold">
      <span aria-hidden="true">⚙</span>내 동네·취향 설정 <span aria-hidden="true">›</span>
    </Link>
    <p className="mt-3 text-center text-xs text-dim">관심 있는 동네와 취향을 선택하면, 더 재미있는 경험을 할 수 있어요.</p>
  </aside>;
}
