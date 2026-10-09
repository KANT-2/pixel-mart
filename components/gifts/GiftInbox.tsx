"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useLocalResource } from "@/components/local/useLocalResource";
import { LocalError, LocalSkeleton } from "@/components/local/LocalStates";
import { ApiError } from "@/lib/api";
import { giftApi } from "@/lib/gifts";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";
import { rarityOf } from "@/utils/gameItem";
import type { ApiGift } from "@/types/api";

type Box = "received" | "sent";

export default function GiftInbox() {
  const { user, loading } = useAuth();
  const params = useSearchParams();
  const box: Box = params.get("box") === "sent" ? "sent" : "received";
  if (loading) return <LocalSkeleton label="선물함 불러오는 중" />;
  if (!user) return <div className="pixel-panel p-8 text-center">
    <p className="mb-4 text-sub">선물함을 보려면 로그인해 주세요.</p>
    <Link href="/login?next=/mypage/gifts" className="btn-lime inline-flex min-h-11 items-center px-5 font-bold">로그인</Link>
  </div>;
  return <GiftList key={`${user.id}:${box}`} box={box} />;
}

function GiftList({ box }: { box: Box }) {
  const load = useCallback((signal: AbortSignal) => giftApi.list(box, signal), [box]);
  const gifts = useLocalResource(load);
  const tab = "btn-pixel inline-flex min-h-11 items-center px-4 text-sm font-bold aria-[current=page]:border-lime aria-[current=page]:text-lime";
  return <div className="space-y-5">
    <nav aria-label="선물함" className="flex gap-2">
      <Link href="/mypage/gifts" aria-current={box === "received" ? "page" : undefined} className={tab}>받은 선물</Link>
      <Link href="/mypage/gifts?box=sent" aria-current={box === "sent" ? "page" : undefined} className={tab}>보낸 선물</Link>
    </nav>
    {gifts.error ? <LocalError message={gifts.error} onRetry={() => void gifts.refresh()} />
      : gifts.loading || !gifts.data ? <LocalSkeleton label="선물 불러오는 중" />
        : gifts.data.length === 0 ? <div className="pixel-panel p-10 text-center">
          <p className="font-pixel text-sm tracking-widest text-dim">EMPTY</p>
          <p className="mt-3">{box === "received" ? "아직 받은 선물이 없어요." : "아직 보낸 선물이 없어요."}</p>
          <Link href="/local/trades" className="btn-pixel mt-5 inline-flex min-h-11 items-center px-5 text-sm font-bold">거래소 둘러보기</Link>
        </div>
          : <ul className="space-y-4">{gifts.data.map((gift) => <li key={gift.id}><GiftRow gift={gift} onChanged={() => void gifts.refresh()} /></li>)}</ul>}
  </div>;
}

const STATUS_TONE: Record<ApiGift["status"], string> = {
  pending: "border-lime/50 text-lime",
  accepted: "border-mint/50 text-mint",
  declined: "border-line text-sub",
};

function GiftRow({ gift, onChanged }: { gift: ApiGift; onChanged: () => void }) {
  const rarity = rarityOf(gift.product.price);
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const canAnswer = gift.box === "received" && gift.status === "pending";

  async function run(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await action(); setMode("idle"); onChanged(); }
    catch (cause) { setError(cause instanceof ApiError || cause instanceof Error ? cause.message : "처리하지 못했어요."); }
    finally { lock.current = false; setBusy(false); }
  }

  const nameOk = name.trim().length >= 1 && name.trim().length <= 50;
  const addressOk = address.trim().length >= 1 && address.trim().length <= 200;

  return <article className="pixel-panel p-4">
    <div className="flex gap-3">
      <div className="item-slot grid size-16 shrink-0 place-items-center overflow-hidden" style={{ ["--rarity" as string]: rarity.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 상품 이미지 */}
        <img src={gift.product.imageUrl} alt="" className="size-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded border-2 px-1.5 py-0.5 text-[11px] font-bold ${STATUS_TONE[gift.status]}`}>{gift.statusLabel}</span>
          <span className="text-xs text-dim">{gift.box === "received" ? `${gift.counterpart}에게서` : `${gift.counterpart}에게`} · {formatDate(gift.createdAt)}</span>
        </div>
        <p className="mt-1 font-bold" style={{ color: rarity.color }}>{gift.product.name} × {gift.quantity}</p>
        <p className="text-xs text-dim">{rarity.label} · {formatPrice(gift.totalPrice)}</p>
        {gift.message && <p className="mt-2 whitespace-pre-line break-words rounded-md border-2 border-frame bg-night p-2 text-sm text-sub">“{gift.message}”</p>}
      </div>
    </div>
    {gift.orderId && <Link href={`/mypage/orders/${gift.orderId}`} className="mt-3 inline-block text-sm font-semibold text-mint hover:underline">배송 현황 보기 →</Link>}
    {canAnswer && mode === "idle" && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => setMode("accept")} className="btn-lime h-10 px-4 text-sm font-bold">받기</button>
      <button type="button" onClick={() => setMode("decline")} className="btn-pixel h-10 px-4 text-sm font-bold">거절</button>
    </div>}
    {canAnswer && mode === "accept" && <form className="mt-3 space-y-3 rounded-md border-2 border-frame bg-night p-3" onSubmit={(event) => {
      event.preventDefault();
      if (nameOk && addressOk) void run(() => giftApi.accept(gift.id, { recipientName: name.trim(), address: address.trim() }));
    }}>
      <p className="text-xs text-sub">받을 이름과 주소를 적어 주세요. <strong className="text-ink">보낸 이웃에게는 보이지 않아요.</strong></p>
      <label className="block text-sm font-semibold">받는 사람<input value={name} maxLength={50} onChange={(event) => setName(event.target.value)} className="pixel-input mt-1 block h-10 w-full px-3 text-sm" /></label>
      <label className="block text-sm font-semibold">주소<input value={address} maxLength={200} onChange={(event) => setAddress(event.target.value)} className="pixel-input mt-1 block h-10 w-full px-3 text-sm" /></label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !nameOk || !addressOk} className="btn-lime h-10 px-4 text-sm font-bold disabled:opacity-50">{busy ? "처리 중…" : "이 주소로 받기"}</button>
        <button type="button" disabled={busy} onClick={() => setMode("idle")} className="btn-pixel h-10 px-4 text-sm font-bold">취소</button>
      </div>
    </form>}
    {canAnswer && mode === "decline" && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border-2 border-frame bg-night p-3">
      <p className="text-sm">선물을 거절할까요? 보낸 이웃에게는 환불돼요.</p>
      <button type="button" disabled={busy} onClick={() => void run(() => giftApi.decline(gift.id))} className="btn-pixel h-9 px-3 text-sm font-bold text-pink">{busy ? "처리 중…" : "거절하기"}</button>
      <button type="button" disabled={busy} onClick={() => setMode("idle")} className="btn-pixel h-9 px-3 text-sm font-bold">취소</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-pink">{error}</p>}
  </article>;
}
