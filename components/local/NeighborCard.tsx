"use client";

import Link from "next/link";
import { useCallback } from "react";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import PixelIcon from "@/components/PixelIcon";
import { useLocalResource } from "@/components/local/useLocalResource";
import { localApi } from "@/lib/local";
import type { ApiBadge, ApiMapCard, ApiMyActivity } from "@/types/api";


interface NeighborCardProps {
  avatar: string | null;
  card: ApiMapCard | null;
  /** 이 동네 구매 순위 (순위가 없는 핀이면 null) */
  rank: number | null;
  sample: boolean;
  onClose?: () => void;
}

/**
 * 지도에서 누른 캐릭터의 이웃 카드 — 하트(지역 커뮤니티 참여도)·코인(완료한 교환·거래 구간)·뱃지·공개 취향.
 * 카드 공개에 동의한 이웃만 내용이 있고, 정확한 점수·금액·위치·프로필 링크는 보여 주지 않는다. 내 카드만 정확한 점수와 진행도.
 */
export default function NeighborCard({ avatar, card, rank, sample, onClose }: NeighborCardProps) {
  const name = card?.nickname ? `${card.nickname} 님` : "이웃 플레이어";
  return <section aria-label="이웃 카드" className="relative rounded-xl border-2 border-line bg-night p-4">
    {onClose && <button type="button" onClick={onClose} aria-label="이웃 카드 닫기" className="absolute right-2 top-2 rounded px-1.5 text-sm text-dim hover:text-ink">✕</button>}
    {card ? <div className="flex items-center justify-between gap-2 pr-6">
      <Hearts count={card.hearts} />
      <span className="shrink-0 whitespace-nowrap rounded border border-lime/40 px-1.5 py-0.5 font-pixel text-[11px] text-lime">LV.{card.lv} {card.level}</span>
    </div> : null}
    <div className={`flex items-center gap-3 ${card ? "mt-3" : "pr-6"}`}>
      <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-panel-2">
        <PixelAvatar src={avatar ?? "/images/hero-slime.svg"} className="size-12 object-contain" />
      </span>
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 font-bold"><span className="truncate">{card?.isMe ? "나" : name}</span>
          {sample && <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] font-normal text-dim">샘플</span>}
        </p>
        {/* 샘플 캐릭터는 실제 구매가 없으므로 순위를 보여 주지 않는다 */}
        {sample ? <p className="mt-0.5 text-xs text-dim">시연용 샘플 캐릭터예요</p>
          : rank && <p className="mt-0.5 text-xs text-sub">이 동네 구매 {rank}위 <span className="text-dim">· 금액 비공개</span></p>}
      </div>
    </div>
    {card ? <>
      <ul className="mt-3 grid grid-cols-2 gap-1.5 text-center text-[11px]">
        <Tile icon={<PixelIcon name="coin" className="size-4" />} label="교환·거래" value={card.coinBand ?? "아직 없음"} />
        <Tile icon={<PixelIcon name="heart" className="size-4" />} label="취향" value={card.interests.length ? card.interests.join("·") : "비공개"} />
      </ul>
      <BadgeRow badge={card.badge ?? null} count={card.badgeCount ?? 0} />
      {card.isMe ? <>
        <MyProgress />
        {card.isPublic === false && <p className="mt-2 text-xs leading-relaxed text-sub">
          내 카드는 지금 나에게만 보여요. <Link href="/local/settings" className="text-mint underline">내 동네·취향 설정</Link>에서 &lsquo;지도에서 내 이웃 카드 보여 주기&rsquo;를 켜면 이웃에게도 보여요.
        </p>}
      </> : !sample && card.wantCount > 0 && card.nickname && <Link href={`/local/wish-map?nickname=${encodeURIComponent(card.nickname)}`}
          className="btn-pixel mt-3 flex min-h-10 w-full items-center justify-center text-sm font-bold">
          WANT {card.wantCount}개 보기 · 선물하기
        </Link>}
    </> : <p className="mt-3 rounded-lg bg-panel-2 p-3 text-xs leading-relaxed text-sub">
      이 이웃은 이웃 카드를 공개하지 않았어요. 아래 구매 순위에서 위치만 볼 수 있어요.
    </p>}
  </section>;
}

/** 하트는 최대 99개라 아이콘 하나 + "×N" 숫자로 */
function Hearts({ count }: { count: number }) {
  return <span role="img" aria-label={`하트 ${count}개`} className="flex shrink-0 items-center gap-1">
    <PixelIcon name="heart" className={`size-5 ${count ? "" : "opacity-25 grayscale"}`} />
    <span aria-hidden="true" className={`font-pixel text-sm ${count ? "text-pink" : "text-dim"}`}>×{count}</span>
  </span>;
}

/** 대표 뱃지 한 줄 — 받은 것 중 가장 받기 어려운 뱃지와 받은 수 */
function BadgeRow({ badge, count }: { badge: ApiBadge | null; count: number }) {
  return <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-line bg-panel px-2.5 py-2 text-left">
    {badge ? <PixelAvatar src={badge.image} className="size-7 shrink-0" /> : <PixelIcon name="star" className="size-5 shrink-0 opacity-40" />}
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] text-dim">대표 뱃지</span>
      <span className="block truncate text-xs font-bold text-ink" title={badge?.description}>{badge ? badge.name : "아직 없음"}</span>
    </span>
    {count > 1 && <span className="shrink-0 text-[11px] text-sub">외 <strong className="text-lime">{count - 1}</strong>개</span>}
  </div>;
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <li className="rounded-lg border border-line bg-panel px-1.5 py-2">
    <span className="flex justify-center">{icon}</span>
    <span className="mt-1 block text-dim">{label}</span>
    <span className="mt-0.5 block truncate font-bold text-ink" title={value}>{value}</span>
  </li>;
}

/** 내 카드 — 정확한 점수와 다음 하트까지 (나에게만) */
function MyProgress() {
  const load = useCallback((signal: AbortSignal) => localApi.myActivity(signal), []);
  const mine = useLocalResource(load);
  if (mine.loading && !mine.data) return <div className="mt-3 h-14 animate-pulse rounded bg-panel-2" />;
  const data: ApiMyActivity | null = mine.data ?? null;
  if (!data) return null;
  const goal = data.nextHeartAt;
  return <div className="mt-3 rounded-lg bg-panel-2 p-3 text-xs">
    <p className="flex justify-between"><span className="text-sub">내 활동 점수</span><strong>{data.score}점 · 교환·거래 {data.coins}건</strong></p>
    {goal ? <>
      <div className="mt-2 h-2 overflow-hidden rounded bg-night" aria-hidden="true">
        <div className="h-full bg-pink" style={{ width: `${Math.min(100, (data.score / goal) * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-sub">다음 하트까지 <strong className="text-ink">{goal - data.score}점</strong> — WANT 등록·거래 완료·선물로 채워요</p>
    </> : <p className="mt-1.5 text-lime">하트를 모두 채웠어요!</p>}
    <p className="mt-1.5 text-dim">다른 이웃에게는 하트 개수와 교환 구간만 보여요.</p>
  </div>;
}
