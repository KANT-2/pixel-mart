"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { TraderPanel } from "@/components/local/TradeWindow";
import { TradeLogin } from "@/components/local/TradeStates";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, LocalSkeleton } from "@/components/local/LocalStates";
import { localApi } from "@/lib/local";
import { ApiError } from "@/lib/api";
import { giftApi } from "@/lib/gifts";
import { containsContact } from "@/utils/localTrades";
import { formatPrice } from "@/utils/formatPrice";
import { rarityOf } from "@/utils/gameItem";
import type { ApiGift, ApiProduct, ApiTradePost } from "@/types/api";

/** 이웃에게 선물 — 받는 사람은 위시맵 WISH 글 작성자, 결제는 데모 */
export default function GiftCheckout() {
  const { user, loading } = useAuth();
  const params = useSearchParams();
  const postId = Number(params.get("post"));
  const next = `/local/gift?${params.toString()}`;
  if (loading) return <div role="status" aria-label="불러오는 중" className="h-96 animate-pulse rounded-md bg-panel" />;
  if (!user) return <TradeLogin next={next} />;
  if (!Number.isSafeInteger(postId) || postId <= 0) return <div className="pixel-panel p-8 text-center">
    <p>선물할 WISH 글을 찾지 못했어요.</p><Link href="/local/wish-map" className="btn-pixel mt-4 inline-flex min-h-11 items-center px-5">위시맵으로</Link>
  </div>;
  return <GiftTarget key={`${user.id}:${postId}`} postId={postId} />;
}

function GiftTarget({ postId }: { postId: number }) {
  const load = useCallback((signal: AbortSignal) => localApi.trade(postId, signal), [postId]);
  const post = useLocalResource(load);
  if (post.loading) return <LocalSkeleton label="WISH 글 불러오는 중" />;
  if (post.error || !post.data) return <LocalError message={post.error ?? "WISH 글을 찾지 못했어요."} onRetry={() => void post.refresh()} />;
  const reason = post.data.kind !== "want" ? "구하는 글(WISH)에만 선물할 수 있어요."
    : post.data.isMine ? "내 글에는 선물할 수 없어요."
      : post.data.isSample ? "샘플 글에는 선물할 수 없어요."
        : !post.data.product ? "PIXEL MART 상품을 위시한 글에만 선물할 수 있어요."
        : post.data.status !== "open" ? "이미 끝난 글이에요." : null;
  if (reason) return <div className="pixel-panel p-8 text-center">
    <p>{reason}</p><Link href="/local/wish-map" className="btn-pixel mt-4 inline-flex min-h-11 items-center px-5">위시맵으로</Link>
  </div>;
  return <GiftForm post={post.data} product={post.data.product!} />;
}

/** 선물은 이웃이 위시한 사이트 상품 그대로 — 수량·메시지만 고른다 */
function GiftForm({ post, product }: { post: ApiTradePost; product: ApiProduct }) {
  const postId = post.id, itemName = post.itemName, linked = product;
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ApiGift | null>(null);
  const lock = useRef(false);

  const contact = containsContact(message);
  const total = (product?.price ?? 0) * quantity;

  async function pay() {
    if (!product || lock.current || contact) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      setDone(await giftApi.send({ tradePostId: postId, productId: product.id, quantity, message: message.trim() }));
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "선물하지 못했어요. 다시 시도해 주세요.");
    } finally { lock.current = false; setBusy(false); }
  }

  if (done) return <div className="pixel-panel p-8 text-center">
    <p className="font-pixel text-sm tracking-widest text-lime">🎁 GIFT SENT!</p>
    <h2 className="mt-3 text-2xl font-extrabold">이웃에게 선물을 보냈어요</h2>
    <p className="mt-3 text-sm text-sub">{done.product.name} × {done.quantity} · {formatPrice(done.totalPrice)} (데모 결제)</p>
    <p className="mt-1 text-sm text-sub">이웃이 받기를 누르면 배송이 시작돼요. 거절하면 데모 환불돼요.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3">
      <Link href="/mypage/gifts?box=sent" className="btn-lime inline-flex min-h-11 items-center px-5 font-bold">보낸 선물 보기</Link>
      <Link href="/local/wish-map" className="btn-pixel inline-flex min-h-11 items-center px-5 font-bold">위시맵으로</Link>
    </div>
  </div>;

  const rarity = rarityOf(product?.price);
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="space-y-5">
      {/* 교환 창과 같은 형식 — 왼쪽 나(보낼 선물), 오른쪽 이웃 플레이어(구하는 물건) */}
      <section aria-label="선물 창" className="pixel-panel overflow-hidden">
        <header className="flex items-center gap-2 border-b-2 border-frame bg-panel-2 px-4 py-2">
          <p className="font-pixel text-xs tracking-widest text-lime">🎁 GIFT</p>
          <span className="text-[11px] text-dim">보내는 사람과 주소는 공개되지 않아요</span>
        </header>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2 p-3 sm:gap-3 sm:p-4">
          <TraderPanel name={user?.nickname ?? "나"} subtitle="나 · 보낼 선물" avatar={user?.avatarUrl ?? null} anonymous={false}
            item={product ? { name: product.name, imageUrl: product.imageUrl, price: product.price } : null} active onPick={() => undefined}
            priceLabel="선물 가격" priceText={product ? formatPrice(total) : "—"} flow="out" />
          <p aria-hidden="true" className="self-center font-pixel text-xl text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]">→</p>
          <TraderPanel name={post.author?.nickname ?? "이웃 플레이어"} subtitle={`💗 '${itemName}' 위시`} avatar={post.author?.avatarUrl ?? null} anonymous={!post.author}
            item={{ name: itemName, imageUrl: linked?.imageUrl ?? null, price: linked?.price ?? null }} active={false} onPick={() => undefined}
            priceLabel="받는 이웃" priceText={post.regionName.split(" ").at(-1) ?? "이웃"} flow="in" />
        </div>
      </section>
      <section className="pixel-panel space-y-4 p-5">
        <p className="font-pixel text-xs tracking-widest text-lime">▶ GIFT OPTIONS · 수량·메시지</p>
        <p className="text-sm text-sub">이웃이 위시한 <strong style={{ color: rarity.color }}>{product.name}</strong>을(를) 그대로 선물해요.</p>
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
          <label className="block text-sm font-semibold">수량
            <select value={quantity} disabled={busy} onChange={(event) => setQuantity(Number(event.target.value))} className="pixel-input mt-2 block h-10 w-28 px-3 text-sm">
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}개</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">메시지 <span className="font-normal text-dim">(선택, 100자)</span>
            <textarea value={message} maxLength={100} disabled={busy} onChange={(event) => setMessage(event.target.value)} rows={2}
              placeholder="구하던 아이템이라 선물해요!" aria-invalid={contact} className="pixel-input mt-2 block w-full p-3 text-sm" />
          </label>
        </div>
        {contact && <p role="alert" className="text-sm text-pink">연락처는 적을 수 없어요</p>}
      </section>
    </div>
    <aside className="pixel-panel self-start p-5">
      <p className="mb-3 font-pixel text-xs tracking-widest text-lime">▶ CHECKOUT</p>
      {product ? <div className="flex gap-3">
        <div className="item-slot grid size-16 shrink-0 place-items-center overflow-hidden" style={{ ["--rarity" as string]: rarity.color }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 상품 이미지 */}
          <img src={product.imageUrl} alt="" className="size-full object-cover" />
        </div>
        <div className="min-w-0"><p className="font-bold" style={{ color: rarity.color }}>{product.name}</p><p className="text-xs text-dim">{rarity.label} · {formatPrice(product.price)} × {quantity}</p></div>
      </div> : <p className="text-sm text-sub">선물할 상품을 골라 주세요.</p>}
      <p className="mt-4 flex items-center justify-between border-t-2 border-frame pt-3 font-bold">
        <span>합계</span>
        <span className="flex items-center gap-1.5 text-xl text-lime">
          {/* eslint-disable-next-line @next/next/no-img-element -- 픽셀 코인 */}
          <img src="/images/hero-coin.svg" alt="" className="size-5 [image-rendering:pixelated]" />{formatPrice(total)}
        </span>
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-pink">{error}</p>}
      <button type="button" disabled={!product || busy || contact} onClick={() => void pay()} className="btn-lime mt-4 min-h-12 w-full font-extrabold disabled:opacity-50">
        {busy ? "결제 중…" : "🎁 선물 결제하기"}
      </button>
      <p className="mt-2 text-center text-xs text-dim">데모: 실제 결제는 일어나지 않아요</p>
    </aside>
  </div>;
}
