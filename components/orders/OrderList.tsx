"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import Pagination from "@/components/Pagination";
import OrderStatusBadge from "@/components/orders/OrderStatusBadge";
import { OrderLoginPrompt, OrderSkeleton } from "@/components/orders/OrderStates";
import { useOrderResource } from "@/components/orders/useOrderResource";
import { ordersApi } from "@/lib/orders";
import { formatDate } from "@/utils/formatDate";
import { formatPrice } from "@/utils/formatPrice";

interface OrderListProps { page: number; }

export default function OrderList({ page }: OrderListProps) {
  const { user, loading } = useAuth();
  const next = page > 1 ? `/mypage/orders?page=${page}` : "/mypage/orders";
  if (loading) return <OrderSkeleton />;
  if (!user) return <OrderLoginPrompt next={next} />;
  return <AccountOrders key={`${user.id}:${page}`} page={page} />;
}

function AccountOrders({ page }: OrderListProps) {
  const router = useRouter();
  const { pending: authPending } = useAuth();
  const load = useCallback((signal: AbortSignal) => ordersApi.list(page, signal), [page]);
  const { data, loading, error, errorStatus, refresh } = useOrderResource(load);
  const lastPage = data ? Math.max(1, data.totalPages) : page;

  useEffect(() => {
    if (data && page > lastPage) router.replace(lastPage > 1 ? `/mypage/orders?page=${lastPage}` : "/mypage/orders", { scroll: false });
  }, [data, page, lastPage, router]);

  if (errorStatus === 401) return <OrderLoginPrompt next="/mypage/orders" />;
  if ((!data && loading) || page > lastPage) return <OrderSkeleton />;

  return (
    <>
      {error && <div role="alert" className="mb-6 rounded-xl border border-pink/30 bg-panel p-4">
        <p className="text-sm text-pink">{error}</p>
        <button type="button" disabled={loading || authPending} onClick={() => { void refresh().catch(() => undefined); }} className="mt-3 min-h-11 rounded-lg border border-line px-4 text-sm font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-violet">다시 시도</button>
      </div>}
      {data && (data.total === 0 ? (
        <div className="rounded-2xl border border-line bg-panel px-5 py-16 text-center">
          <p className="mb-3 font-pixel text-violet">EMPTY LOG</p>
          <h2 className="text-xl font-bold">아직 주문이 없어요</h2>
          <p className="mt-3 text-sm text-sub">마음에 드는 아이템을 찾아 첫 주문을 만들어 보세요.</p>
          <Link href="/products" className="mt-6 inline-flex rounded-lg bg-lime px-6 py-3 font-bold text-lime-ink">상품 보러가기</Link>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-sub">총 {data.total}건 · {data.page} / {data.totalPages} 페이지</p>
          <ul className="space-y-4">
            {data.items.map((order) => <li key={order.id}>
              <Link href={`/mypage/orders/${order.id}`} className="block rounded-2xl border border-line bg-panel p-4 hover:border-violet/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-dim">
                  <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
                  <span className="font-pixel">ORDER #{order.id}</span>
                </div>
                <div className="flex items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- API 상품 이미지를 일반 img로 표시합니다. */}
                  <img src={order.imageUrl} alt={order.title} className="size-20 shrink-0 rounded-lg bg-panel-2 object-cover sm:size-24" />
                  <div className="min-w-0 flex-1">
                    <OrderStatusBadge status={order.status} label={order.statusLabel} />
                    <h2 className="mt-2 break-words font-bold">{order.title}</h2>
                    <p className="mt-1 text-xs text-dim">상품 {order.itemCount}종</p>
                    <p className="mt-2 font-bold text-lime">{formatPrice(order.totalPrice)}</p>
                  </div>
                  <span aria-hidden="true" className="self-center text-sub">→</span>
                </div>
              </Link>
            </li>)}
          </ul>
          <Pagination currentPage={data.page} totalPages={data.totalPages} basePath="/mypage/orders" />
        </>
      ))}
    </>
  );
}
