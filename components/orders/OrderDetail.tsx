"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import CancelRequestForm from "@/components/orders/CancelRequestForm";
import OrderProgress from "@/components/orders/OrderProgress";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import { OrderLoginPrompt, OrderNotFound, OrderSkeleton } from "@/components/orders/OrderStates";
import { useOrderResource } from "@/components/orders/useOrderResource";
import { ApiError } from "@/lib/api";
import { ordersApi } from "@/lib/orders";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";
import { canAdvanceOrder, canCancelOrder, validateCancelReason } from "@/utils/orders";

interface OrderDetailProps {
  id: number;
  placed: boolean;
}

const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint";

export default function OrderDetail({ id, placed }: OrderDetailProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const path = `/mypage/orders/${id}`;

  // Cache Components가 보관한 화면도 떠나는 즉시 개인 데이터와 진행 중 요청을 비웁니다.
  if (pathname !== path) return null;
  if (loading) return <OrderSkeleton />;
  if (!user) return <OrderLoginPrompt next={placed ? `${path}?placed=1` : path} />;
  return <OrderDetailContents key={`${user.id}:${id}`} id={id} placed={placed} />;
}

function OrderDetailContents({ id, placed }: OrderDetailProps) {
  const { pending: authPending } = useAuth();
  const load = useCallback((signal: AbortSignal) => ordersApi.detail(id, signal), [id]);
  const { data: order, loading, error, errorStatus, refresh, replaceData } = useOrderResource(load);
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<number | null>(null);
  const [cancellationAccepted, setCancellationAccepted] = useState(false);
  const busy = useRef(false);
  const lifetime = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  const reload = async () => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || busy.current || authPending) return;
    try {
      await refresh();
      if (!signal.aborted) {
        setCancellationAccepted(false);
        setMutationError(null);
      }
    } catch {
      // 조회 실패는 공통 조회 상태에 표시하고, 접수된 취소 신청은 다시 보내지 않습니다.
    }
  };

  const mutate = async (action: "cancel" | "advance", reason = "") => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || busy.current || authPending || loading || !order || cancellationAccepted) return;
    if (action === "cancel" && (!canCancelOrder(order.status) || validateCancelReason(reason).error)) return;
    if (action === "advance" && (process.env.NODE_ENV !== "development" || !canAdvanceOrder(order.status))) return;
    busy.current = true;
    setPending(true);
    setMutationError(null);
    let accepted = false;
    try {
      if (action === "advance") {
        const updated = await ordersApi.advance(id, signal);
        if (!signal.aborted) replaceData(updated);
      } else {
        await ordersApi.cancel(id, validateCancelReason(reason).value, signal);
        if (signal.aborted) return;
        accepted = true;
        setCancellationAccepted(true);
        await refresh();
        if (!signal.aborted) setCancellationAccepted(false);
      }
    } catch (cause) {
      if (signal.aborted || (cause instanceof Error && cause.name === "AbortError")) return;
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 404)) {
        setAccessStatus(cause.status);
      } else if (accepted) {
        setMutationError("취소 신청은 접수됐어요. 최신 주문 상태를 다시 불러와 주세요.");
      } else {
        setMutationError(cause instanceof ApiError ? cause.message : "요청을 처리하지 못했어요. 주문 상태를 확인한 뒤 다시 시도해 주세요.");
        // 다른 탭에서 주문이 바뀐 경우에도 서버 오류 문구를 유지하며 현재 상태를 확인합니다.
        try { await refresh(); } catch { /* 조회 오류는 공통 상태에서 안내합니다. */ }
      }
    } finally {
      if (!signal.aborted) {
        busy.current = false;
        setPending(false);
      }
    }
  };

  if (errorStatus === 401 || accessStatus === 401) return <OrderLoginPrompt next={`/mypage/orders/${id}`} />;
  if (errorStatus === 404 || accessStatus === 404) return <OrderNotFound />;
  if (!order && loading) return <OrderSkeleton />;

  const blocked = pending || loading || authPending;

  return <div className="space-y-6">
    {(error || mutationError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pink/30 bg-panel p-4">
      <p className="min-w-0 text-sm leading-relaxed text-pink">{mutationError ?? error}</p>
      <button type="button" disabled={blocked} onClick={() => { void reload(); }} className={`shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-bold disabled:opacity-50 ${focusClass}`}>다시 불러오기</button>
    </div>}
    {order && <>
      {placed && <div role="status" className="rounded-xl border border-mint/30 bg-mint/5 p-5">
        <p className="font-extrabold text-mint">주문이 완료됐어요!</p>
        <p className="mt-2 text-sm leading-relaxed text-sub">아래는 서버에 접수된 실제 주문 내역이에요. 데모 주문으로 실제 결제는 발생하지 않아요.</p>
      </div>}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold">주문 번호 #{order.id}</p>
          <p className="mt-1 text-sm text-sub">주문일 <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time></p>
        </div>
        <OrderStatusBadge status={order.status} label={order.statusLabel} />
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <OrderProgress order={order} />
          <section aria-labelledby="ordered-items-title" className="overflow-hidden rounded-2xl border border-line bg-panel">
            <h2 id="ordered-items-title" className="px-5 pt-5 text-lg font-extrabold sm:px-6">주문한 아이템</h2>
            <ul className="divide-y divide-line px-5 sm:px-6">
              {order.items.map((item) => <li key={item.product.id} className="flex items-start gap-4 py-5">
                <Link href={`/products/${item.product.id}`} className={`shrink-0 rounded-lg ${focusClass}`} tabIndex={-1} aria-hidden="true">
                  {/* 주문 상품 이미지는 API의 외부 URL과 로컬 폴백 경로를 함께 사용합니다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.product.imageUrl} alt="" className="aspect-square size-16 rounded-lg bg-panel-2 object-cover sm:size-20" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${item.product.id}`} className={`break-words text-sm font-bold leading-relaxed hover:text-mint ${focusClass}`}>{item.product.name}</Link>
                  <p className="mt-2 text-xs leading-relaxed text-sub">{formatPrice(item.unitPrice)} · {item.quantity}개</p>
                  <p className="mt-2 text-sm font-extrabold">{formatPrice(item.subtotal)}</p>
                  {order.status === "delivered" && <>
                    <Link href={`/products/${item.product.id}#reviews`} className={`mt-3 inline-flex rounded-lg border border-line bg-panel-2 px-3 py-2 text-xs font-bold text-mint ${focusClass}`}>리뷰 쓰기</Link>
                  </>}
                </div>
              </li>)}
            </ul>
          </section>
          {cancellationAccepted ? <div role="status" className="rounded-xl border border-mint/30 bg-panel p-5 text-sm leading-relaxed text-mint">취소 신청이 접수됐어요. 최신 주문 상태를 확인해 주세요.</div> :
            canCancelOrder(order.status) && <CancelRequestForm busy={blocked} onSubmit={(reason) => mutate("cancel", reason)} />}
          {process.env.NODE_ENV === "development" && canAdvanceOrder(order.status) && !cancellationAccepted && <section className="rounded-xl border border-violet/30 bg-panel p-5">
            <p className="text-sm font-bold text-violet">개발용 · 배송 시연</p>
            <p className="mt-2 text-xs leading-relaxed text-sub">로컬 데모 주문의 배송을 다음 단계로 진행해요.</p>
            <button type="button" disabled={blocked} onClick={() => { void mutate("advance"); }} className={`mt-4 rounded-lg border border-line bg-panel-2 px-4 py-3 text-sm font-bold disabled:opacity-50 ${focusClass}`}>{pending ? "처리 중…" : "다음 배송 단계로"}</button>
          </section>}
        </div>
        <aside aria-label="주문 배송지와 합계" className="min-w-0 rounded-2xl border border-line bg-panel p-5 lg:sticky lg:top-28">
          <h2 className="text-lg font-extrabold">배송지</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div><dt className="text-sub">받는 사람</dt><dd className="mt-1 break-words font-semibold">{order.recipientName}</dd></div>
            <div><dt className="text-sub">주소</dt><dd className="mt-1 whitespace-pre-line break-words leading-relaxed">{order.address}</dd></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5"><dt className="font-bold">주문 금액</dt><dd className="text-2xl font-extrabold text-mint">{formatPrice(order.totalPrice)}</dd></div>
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-dim">실제 결제가 없는 데모 주문이에요.</p>
        </aside>
      </div>
    </>}
    <Link href="/mypage/orders" className={`inline-flex rounded-lg border border-line bg-panel px-5 py-3 text-sm font-bold ${focusClass}`}>← 주문 내역으로</Link>
  </div>;
}
