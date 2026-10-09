import Link from "next/link";
import PixelIcon from "@/components/PixelIcon";
import type { ReactNode } from "react";
import type { ApiTradePost, TradeProximity } from "@/types/api";
import { TRADE_METHODS, TRADE_STATUSES, proximityLabel, containsContact } from "@/utils/localTrades";
import { interestLabel } from "@/utils/local";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";
import { durabilityOf, rarityOf, TRADE_KIND_GAME } from "@/utils/gameItem";

interface TradeCardProps { post: ApiTradePost; proximity?: TradeProximity | null; actions?: ReactNode; }

/** 게임 거래소의 아이템 목록 한 칸 — 아이템 칸·등급 색·내구도·코인 가격 */
export default function TradeCard({ post, proximity = null, actions }: TradeCardProps) {
  // 응답이 확장돼도 작성자·계정·장소 필드를 카드로 넘겨 펼치지 않습니다.
  const itemName = containsContact(post.itemName) ? "연락처가 포함된 물건명은 표시하지 않아요" : post.itemName;
  const content = containsContact(post.content) ? "연락처가 포함된 내용은 표시하지 않아요." : post.content;
  const kind = TRADE_KIND_GAME[post.kind] ?? TRADE_KIND_GAME.have;
  const rarity = rarityOf(post.price ?? post.product?.price);
  const durability = durabilityOf(post.condition);
  const method = TRADE_METHODS.find((item) => item.value === post.tradeMethod)?.label;
  return <article aria-label={itemName} className={`flex h-full min-w-0 flex-col pixel-panel p-4 ${post.status !== "open" ? "opacity-60" : ""}`}>
    <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
      <span className={`rounded border-2 px-1.5 py-0.5 font-pixel ${kind.tone}`}><PixelIcon name={kind.icon} className="mr-1 size-3.5" />{kind.tag}</span>
      <span className="text-sub">{kind.label}</span>
      {post.status !== "open" && <span className="rounded bg-panel-2 px-1.5 py-0.5 text-sub">{TRADE_STATUSES[post.status]}</span>}
      {proximity && <span className="rounded border border-mint/40 px-1.5 py-0.5 text-mint">{proximityLabel(proximity)}</span>}
    </div>
    <div className="flex gap-3">
      <div className="item-slot grid size-20 shrink-0 place-items-center overflow-hidden" style={{ ["--rarity" as string]: rarity.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 연결 상품 이미지 또는 픽셀 보물상자 */}
        <img src={post.product?.imageUrl ?? "/images/hero-chest.svg"} alt=""
          className={post.product ? "size-full object-cover" : "size-12 [image-rendering:pixelated]"} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-words font-bold leading-snug" style={{ color: rarity.color }}>{itemName}</h3>
        <p className="mt-0.5 font-pixel text-[10px] tracking-wider text-dim">{rarity.label}{post.interest ? ` · ${interestLabel(post.interest)}` : ""}</p>
        <p className="mt-2 flex items-center gap-1.5 font-extrabold text-lime">
          {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 코인 */}
          <img src="/images/hero-coin.svg" alt="" className="size-4 [image-rendering:pixelated]" />
          {post.price === null ? <span className="text-sub">가격 제안</span> : formatPrice(post.price)}
        </p>
      </div>
    </div>
    <dl className="mt-3 space-y-2 text-xs">
      <div>
        <dt className="mb-1 flex justify-between text-dim"><span>내구도</span><span>{durability?.label ?? "상태 미지정"}</span></dt>
        <dd className="durability"><span style={{ width: `${durability?.percent ?? 0}%` }} /></dd>
      </div>
      <div className="flex justify-between gap-2"><dt className="text-dim">거래 방식</dt><dd>{method}</dd></div>
    </dl>
    {content && <p className="mt-3 whitespace-pre-line break-words rounded-md border-2 border-frame bg-night p-2.5 text-sm leading-relaxed text-sub">“{content}”</p>}
    {post.product && <Link href={`/products/${post.product.id}`} className="mt-3 text-xs font-semibold text-mint hover:underline focus-visible:outline-2 focus-visible:outline-mint">
      {post.product.name} 상점에서 보기 →
    </Link>}
    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
      <time dateTime={post.createdAt} className="text-[11px] text-dim">{formatDate(post.createdAt)}</time>
    </div>
    {actions}
  </article>;
}
