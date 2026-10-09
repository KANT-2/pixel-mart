"use client";

import Link from "next/link";
import { useState } from "react";
import { giftHref } from "@/utils/gift";
import TradeCard from "@/components/local/TradeCard";
import PixelAvatar from "@/components/avatar/PixelAvatar";
import { containsContact, matchLabels } from "@/utils/localTrades";
import { formatPrice } from "@/utils/formatPrice";
import { rarityOf } from "@/utils/gameItem";
import type { ApiTradeMatch, ApiTradePost } from "@/types/api";

interface TradeWindowProps {
  match: ApiTradeMatch;
  me: { nickname: string; avatarUrl: string | null };
}

const SLOTS = 6;

/** 게임 교환 창 — 왼쪽은 나, 오른쪽은 이웃(익명), 아래는 고른 아이템 정보. 실제 교환·채팅·결제는 없는 시연용 */
export default function TradeWindow({ match, me }: TradeWindowProps) {
  const [picked, setPicked] = useState<"want" | "offer">("offer");
  const item = picked === "want" ? match.want : match.offer;
  return <section aria-label="교환 창" className="pixel-panel overflow-hidden">
    <header className="flex flex-wrap items-center gap-2 border-b-2 border-frame bg-panel-2 px-4 py-2">
      <p className="font-pixel text-xs tracking-widest text-lime">⇄ TRADE</p>
      {matchLabels(match.proximity, match.mutual).map((label) => <span key={label} className="rounded border border-mint/40 px-1.5 py-0.5 text-[11px] font-bold text-mint">{label}</span>)}
    </header>
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 p-3 sm:gap-3 sm:p-4">
      <TraderPanel name={me.nickname} subtitle="나 · 구하는 아이템" avatar={me.avatarUrl} anonymous={false}
        item={postItem(match.want)} active={picked === "want"} onPick={() => setPicked("want")} priceText="—" />
      <p aria-hidden="true" className="self-center font-pixel text-xl text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]">⇄</p>
      <TraderPanel name="이웃 플레이어" subtitle="같은 동네 · 가진 아이템" avatar={null} anonymous
        item={postItem(match.offer)} active={picked === "offer"} onPick={() => setPicked("offer")}
        priceText={match.offer.price === null ? "가격 제안" : formatPrice(match.offer.price)} />
    </div>
    <div className="border-t-2 border-frame bg-night/60 p-3 sm:p-4">
      <p className="mb-2 font-pixel text-[10px] tracking-widest text-dim">▶ ITEM INFO · {picked === "want" ? "내가 구하는 아이템" : "이웃의 아이템"}</p>
      <TradeCard post={item} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {match.offer.isSample
          ? <span className="btn-pixel inline-flex h-10 cursor-not-allowed items-center px-4 text-sm font-bold opacity-50" title="샘플 글에는 선물할 수 없어요">🎁 선물하기</span>
          : <Link href={giftHref(match.offer)} className="btn-lime inline-flex h-10 items-center px-4 text-sm font-bold">🎁 이 이웃에게 선물하기</Link>}
        <button type="button" disabled className="btn-pixel h-10 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">교환 신청 · 준비 중</button>
        <p className="text-xs text-dim">선물은 데모 결제로 이어져요. 채팅·연락처 없이 아이템과 조건만 주고받아요.{match.offer.isSample ? " (샘플 글에는 선물할 수 없어요)" : ""}</p>
      </div>
    </div>
  </section>;
}

/** 교환 창 아이템 칸에 올릴 물건 — 거래글·선물 상품 모두 이 모양으로 */
export interface TraderItem { name: string; imageUrl: string | null; price: number | null; }

export function postItem(post: ApiTradePost): TraderItem {
  return { name: containsContact(post.itemName) ? "물건명 비공개" : post.itemName, imageUrl: post.product?.imageUrl ?? null, price: post.price ?? post.product?.price ?? null };
}

interface TraderPanelProps {
  name: string;
  subtitle: string;
  avatar: string | null;
  anonymous: boolean;
  /** 비어 있으면 빈 칸(선물 고르기 전) */
  item: TraderItem | null;
  active: boolean;
  onPick: () => void;
  priceLabel?: string;
  priceText: string;
}

/** 교환 창 한쪽 — 캐릭터, 이름, 아이템 칸 6개, 가격 줄 */
export function TraderPanel({ name, subtitle, avatar, anonymous, item, active, onPick, priceLabel = "희망가", priceText }: TraderPanelProps) {
  const rarity = rarityOf(item?.price);
  const itemName = item?.name ?? "빈 칸";
  return <div className="flex min-w-0 flex-col rounded-md border-2 border-frame bg-panel">
    {/* 캐릭터 자리 — 이웃은 정책상 누구인지 보이지 않게 익명 슬라임 */}
    <div className="relative grid h-24 place-items-end justify-center overflow-hidden rounded-t bg-[linear-gradient(#17123a,#2a1f5c)] pb-1 sm:h-28">
      <div className="absolute inset-x-0 bottom-0 h-3 bg-[#2b2552]" />
      <div className="relative h-16 w-16 sm:h-20 sm:w-20">
        {avatar ? <PixelAvatar src={avatar} alt="" className="h-full w-full object-bottom" /> : (
          // eslint-disable-next-line @next/next/no-img-element -- 픽셀 슬라임
          <img src="/images/hero-slime.svg" alt="" className={`h-full w-full object-contain object-bottom [image-rendering:pixelated] ${anonymous ? "brightness-75 grayscale-[40%]" : ""}`} />
        )}
        {anonymous && <span aria-hidden="true" className="absolute -right-1 top-0 rounded bg-night px-1 font-pixel text-sm text-lime">?</span>}
      </div>
    </div>
    <div className="px-2 py-1.5 text-center">
      <p className="truncate text-sm font-bold">{name}</p>
      <p className="truncate text-[10px] text-dim">{subtitle}</p>
    </div>
    <div className="grid grid-cols-[repeat(3,minmax(0,4.5rem))] justify-center gap-1 px-2" aria-label={`${name}의 아이템 칸`}>
      {Array.from({ length: SLOTS }, (_, index) => index === 0
        ? <button key={index} type="button" onClick={onPick} aria-pressed={active} aria-label={`${itemName} 정보 보기`} title={itemName}
          className={`item-slot grid aspect-square place-items-center overflow-hidden ${active ? "ring-2 ring-lime" : ""}`} style={item ? { ["--rarity" as string]: rarity.color } : undefined}>
          {item ? (
            // eslint-disable-next-line @next/next/no-img-element -- 상품 이미지 또는 보물상자
            <img src={item.imageUrl ?? "/images/hero-chest.svg"} alt="" className={item.imageUrl ? "size-full object-cover" : "size-3/5 [image-rendering:pixelated]"} />
          ) : <span aria-hidden="true" className="font-pixel text-lg text-dim">+</span>}
        </button>
        : <span key={index} aria-hidden="true" className="aspect-square rounded border-2 border-frame bg-night" />)}
    </div>
    <p className="mt-auto flex items-center justify-between gap-1 border-t-2 border-frame px-2 py-1.5 text-xs">
      <span className="flex items-center gap-1 text-dim">
        {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 코인 */}
        <img src="/images/hero-coin.svg" alt="" className="size-3.5 [image-rendering:pixelated]" />{priceLabel}
      </span>
      <span className="truncate font-bold text-lime">{priceText}</span>
    </p>
  </div>;
}
