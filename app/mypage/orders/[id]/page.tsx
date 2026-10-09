import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import OrderDetail from "@/components/orders/OrderDetail";
import { OrderSkeleton } from "@/components/orders/OrderStates";
import { parseOrderId } from "@/utils/orders";

export const metadata: Metadata = { title: "주문 상세 | PIXEL MART" };

// 개인 주문 ID는 빌드에서 조회하지 않고 Suspense 안에서 요청 시 해석합니다.
export default function OrderDetailPage({ params, searchParams }: PageProps<"/mypage/orders/[id]">) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">
      <header className="mb-8">
        <Link href="/mypage/orders" className="mb-6 inline-block text-sm text-sub hover:text-ink">← 주문 내역</Link>
        <p className="stage-kicker mb-2 font-pixel text-sm text-mint">ORDER LOG</p>
        <h1 className="text-3xl font-extrabold">주문 상세</h1>
      </header>
      <Suspense fallback={<OrderSkeleton />}>
        <OrderQuery params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function OrderQuery({ params, searchParams }: PageProps<"/mypage/orders/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const orderId = parseOrderId(id);
  if (orderId === null) notFound();
  return <OrderDetail key={orderId} id={orderId} placed={query.placed === "1"} />;
}
