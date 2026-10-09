"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import CartItemRow from "@/components/cart/CartItemRow";
import { formatPrice } from "@/utils/formatPrice";

export default function CartContents() {
  const { user, loading: authLoading, pending: authPending } = useAuth();
  const { cart, loading, error, pendingIds, refresh } = useCart();

  if (authLoading || (user && !cart && loading)) return <CartSkeleton />;

  if (!user) return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">PLAYER LOGIN</p>
    <h2 className="text-xl font-bold">로그인하고 장바구니를 채워 보세요</h2>
    <p className="mt-3 text-sm text-sub">담아 둔 아이템은 다시 로그인해도 그대로 있어요.</p>
    <Link href="/login?next=/cart" className="mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink">로그인하기</Link>
  </div>;

  return <>
    {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pink/30 bg-panel p-4">
      <p className="text-sm text-pink">{error}</p>
      <button type="button" disabled={loading || authPending} onClick={() => { void refresh().catch(() => undefined); }}
        className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">다시 불러오기</button>
    </div>}
    {!cart ? <p className="py-12 text-center text-sub">장바구니를 불러오지 못했어요. 다시 시도해 주세요.</p> : cart.items.length === 0 ?
      <div className="pixel-panel px-5 py-16 text-center">
        <p className="mb-3 font-pixel text-violet" aria-hidden="true">EMPTY INVENTORY</p>
        <h2 className="text-2xl font-extrabold">아이템이 없어요</h2>
        <p className="mt-3 text-sm text-sub">나만의 데스크를 채울 첫 아이템을 찾아보세요.</p>
        <Link href="/products" className="mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink">상품 둘러보기</Link>
      </div> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <p className="font-semibold">담은 상품 <span className="text-mint">{cart.items.length}종</span></p>
            <Link href="/products" className="text-sub hover:text-ink">쇼핑 계속하기 →</Link>
          </div>
          <ul className="space-y-4">
            {cart.items.map((item) => <CartItemRow key={item.product.id} item={item} disabled={authPending} />)}
          </ul>
        </div>
        <aside aria-label="장바구니 합계" className="pixel-panel p-5 lg:sticky lg:top-24">
          <h2 className="mb-5 text-lg font-extrabold">담은 아이템 합계</h2>
          <dl className="space-y-4">
            <div className="flex justify-between gap-3 text-sm"><dt className="text-sub">총 수량</dt><dd className="font-semibold">{cart.totalQuantity}개</dd></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4"><dt className="font-semibold">총 상품 금액</dt><dd className="text-2xl font-extrabold text-lime">{formatPrice(cart.totalPrice)}</dd></div>
          </dl>
          <Link href="/checkout" className="mt-6 flex min-h-11 w-full items-center justify-center btn-lime px-4 py-3 font-bold text-lime-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet">주문하기</Link>
          <p role="status" className="mt-4 min-h-5 text-center text-xs text-sub">{pendingIds.length > 0 ? "변경 사항을 저장하고 있어요." : loading ? "장바구니를 확인하고 있어요." : "장바구니는 로그인 계정에 저장돼요."}</p>
        </aside>
      </div>}
  </>;
}

function CartSkeleton() {
  return <div role="status" aria-label="장바구니 불러오는 중" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
    <span className="sr-only">장바구니를 불러오고 있어요.</span>
    <div className="space-y-4">{[0, 1].map((key) => <div key={key} className="h-44 animate-pulse rounded-2xl bg-panel" />)}</div>
    <div className="h-64 animate-pulse rounded-2xl bg-panel" />
  </div>;
}
