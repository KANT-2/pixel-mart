import Link from "next/link";
import type { ReactNode } from "react";
import type { ApiTradePost, TradeProximity } from "@/types/api";
import { TRADE_KINDS, TRADE_CONDITIONS, TRADE_METHODS, TRADE_STATUSES, proximityLabel, containsContact } from "@/utils/localTrades";
import { interestLabel } from "@/utils/local";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";

interface TradeCardProps { post: ApiTradePost; proximity?: TradeProximity | null; actions?: ReactNode; }

export default function TradeCard({ post, proximity = null, actions }: TradeCardProps) {
  // 응답이 확장돼도 작성자·계정·장소 필드를 카드로 넘겨 펼치지 않습니다.
  const itemName = containsContact(post.itemName) ? "연락처가 포함된 물건명은 표시하지 않아요" : post.itemName;
  const content = containsContact(post.content) ? "연락처가 포함된 내용은 표시하지 않아요." : post.content;
  return <article aria-label={itemName} className="flex h-full min-w-0 flex-col pixel-panel p-5">
    <div className="mb-4 flex flex-wrap gap-2 text-xs"><span className="rounded border border-violet/40 px-2 py-1 text-violet">{TRADE_KINDS.find((item) => item.value === post.kind)?.label}</span>
      <span className="rounded bg-panel-2 px-2 py-1 text-sub">{TRADE_STATUSES[post.status]}</span>
      {post.isSample && <span className="rounded border border-violet/40 px-2 py-1 text-violet">샘플 데이터</span>}
      {proximity && <span className="rounded border border-mint/30 px-2 py-1 text-mint">{proximityLabel(proximity)}</span>}
    </div>
    <h3 className="break-words text-lg font-bold">{itemName}</h3>
    {post.interest && <p className="mt-2 text-xs text-dim">{interestLabel(post.interest)}</p>}
    <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
      <dt className="text-dim">물건 상태</dt><dd>{TRADE_CONDITIONS.find((item) => item.value === post.condition)?.label ?? "상태 미지정"}</dd>
      <dt className="text-dim">희망 가격</dt><dd className="font-bold text-mint">{post.price === null ? "가격 미정" : formatPrice(post.price)}</dd>
      <dt className="text-dim">거래 방식</dt><dd>{TRADE_METHODS.find((item) => item.value === post.tradeMethod)?.label}</dd>
    </dl>
    {content && <p className="mt-4 whitespace-pre-line break-words text-sm leading-relaxed text-sub">{content}</p>}
    {post.product && <Link href={`/products/${post.product.id}`} className="mt-4 flex items-center gap-3 rounded-lg border border-line p-3 focus-visible:outline-2 focus-visible:outline-mint">
      {/* eslint-disable-next-line @next/next/no-img-element -- 연결 상품의 API 이미지를 사용합니다. */}
      <img src={post.product.imageUrl} alt="" className="size-14 shrink-0 rounded bg-panel-2 object-cover" />
      <span className="min-w-0 break-words text-sm">{post.product.name}<span className="mt-1 block text-xs text-mint">상품 상세 →</span></span>
    </Link>}
    <time dateTime={post.createdAt} className="mt-auto block pt-5 text-xs text-dim">{formatDate(post.createdAt)}</time>
    {actions}
  </article>;
}
