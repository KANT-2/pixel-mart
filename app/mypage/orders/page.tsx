import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import OrderList from "@/components/orders/OrderList";
import { OrderSkeleton } from "@/components/orders/OrderStates";
import { parseOrderPage } from "@/utils/orders";

export const metadata: Metadata = { title: "주문 내역 | PIXEL MART" };

export default function OrdersPage({ searchParams }: PageProps<"/mypage/orders">) {
  return (
    <section className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8">
        <Link href="/mypage" className="mb-6 inline-block text-sm text-sub hover:text-ink">← 마이페이지</Link>
        <p className="stage-kicker mb-2 font-pixel text-sm text-mint">MY ORDERS</p>
        <h1 className="text-3xl font-extrabold">주문 내역</h1>
        <p className="mt-3 text-sm text-sub">주문한 아이템과 배송 진행 상황을 확인하세요.</p>
      </header>
      <Suspense fallback={<OrderSkeleton />}>
        <OrdersQuery searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

interface OrdersQueryProps { searchParams: PageProps<"/mypage/orders">["searchParams"]; }

async function OrdersQuery({ searchParams }: OrdersQueryProps) {
  const { page } = await searchParams;
  const currentPage = parseOrderPage(page);
  return <OrderList key={currentPage} page={currentPage} />;
}
