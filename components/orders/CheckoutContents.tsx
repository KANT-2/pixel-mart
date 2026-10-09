"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { ApiError } from "@/lib/api";
import { ordersApi } from "@/lib/orders";
import type { ApiOrder } from "@/types/api";
import { formatPrice } from "@/utils/formatPrice";
import { validateOrderForm } from "@/utils/orders";

export default function CheckoutContents() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  // 완료한 주문을 보관한 화면이 새 체크아웃에서 다시 나타나지 않게 합니다.
  if (pathname !== "/checkout") return null;
  if (loading) return <CheckoutSkeleton />;
  if (!user) return <CheckoutLogin />;
  return <CheckoutForm key={user.id} />;
}

function CheckoutForm() {
  const { pending: authPending, refresh: refreshAuth } = useAuth();
  const { cart, loading, error: cartError, pendingIds, refresh } = useCart();
  const router = useRouter();
  const [recipientName, setRecipientName] = useState("");
  const [address, setAddress] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ recipientName?: string; address?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<ApiOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const locked = useRef(false);
  const confirmed = useRef(false);
  const sequence = useRef(0);
  const session = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    session.current = controller;
    if (authPending) controller.abort();
    return () => {
      // Cache Components로 화면이 숨겨져도 이전 요청은 이동·상태 갱신을 하지 않습니다.
      controller.abort();
      if (locked.current && !confirmed.current) setError("주문 요청 확인이 중단됐어요. 다시 주문하기 전에 주문 내역을 확인해 주세요.");
      locked.current = false;
      setBusy(false);
    };
  }, [authPending]);

  function isCurrent(controller: AbortController, request: number) {
    return !controller.signal.aborted && sequence.current === request;
  }

  async function syncCartAndOpen(order: ApiOrder, controller: AbortController, request: number) {
    setRefreshError(null);
    try {
      await refresh();
      if (isCurrent(controller, request)) router.replace(`/mypage/orders/${order.id}?placed=1`);
    } catch (cause) {
      if (!isCurrent(controller, request)) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setUnauthorized(true);
        void refreshAuth();
        return;
      }
      setRefreshError(cause instanceof Error ? cause.message : "장바구니를 다시 확인하지 못했어요.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || createdOrder || authPending || loading || pendingIds.length > 0 || !cart?.items.length) return;
    const validation = validateOrderForm(recipientName, address);
    setRecipientName(validation.values.recipientName);
    setAddress(validation.values.address);
    setFieldErrors(validation.errors);
    setError(null);
    if (!validation.valid) {
      const invalid = event.currentTarget.elements.namedItem(validation.errors.recipientName ? "recipientName" : "address");
      if (invalid instanceof HTMLElement) invalid.focus();
      return;
    }
    const controller = session.current;
    if (!controller || controller.signal.aborted) return;
    const request = ++sequence.current;
    locked.current = true;
    setBusy(true);
    try {
      const order = await ordersApi.create(validation.values, controller.signal);
      if (!isCurrent(controller, request)) return;
      // 다른 탭에서 장바구니가 바뀌었어도 확정된 품목·금액은 서버 응답만 씁니다.
      confirmed.current = true;
      setCreatedOrder(order);
      await syncCartAndOpen(order, controller, request);
    } catch (cause) {
      if (!isCurrent(controller, request)) return;
      if (cause instanceof ApiError && cause.status === 401) {
        setUnauthorized(true);
        void refreshAuth();
      } else {
        setError(cause instanceof ApiError ? cause.message : "주문 결과를 확인하지 못했어요. 다시 주문하기 전에 주문 내역을 확인해 주세요.");
      }
    } finally {
      if (isCurrent(controller, request)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  async function retryCartRefresh() {
    const controller = session.current;
    if (locked.current || authPending || !createdOrder || !controller || controller.signal.aborted) return;
    const request = ++sequence.current;
    locked.current = true;
    setBusy(true);
    try {
      // 이미 생성한 주문은 유지하고 GET /cart만 재시도합니다.
      await syncCartAndOpen(createdOrder, controller, request);
    } finally {
      if (isCurrent(controller, request)) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  if (unauthorized) return <CheckoutLogin />;
  if (createdOrder) return <div className="space-y-6">
    <div role="status" className="rounded-2xl border border-mint/30 bg-panel p-6">
      <p className="mb-3 font-pixel text-mint" aria-hidden="true">ORDER COMPLETE</p>
      <h2 className="text-xl font-extrabold">주문이 완료됐어요</h2>
      <p className="mt-2 text-sm text-sub">주문번호 #{createdOrder.id}</p>
      <p className="mt-3 text-sm text-sub">{busy ? "장바구니를 갱신한 뒤 주문 상세로 이동해요." : "아래는 서버에서 확정한 주문 내용이에요."}</p>
    </div>
    <CheckoutSummary items={createdOrder.items} totalPrice={createdOrder.totalPrice} confirmed />
    {refreshError && <p role="alert" className="rounded-xl border border-pink/30 bg-panel p-5 text-sm text-pink">주문은 완료됐지만 장바구니 갱신에 실패했어요. {refreshError}</p>}
    {!busy && <div className="flex flex-wrap items-center gap-4">
      <button type="button" disabled={authPending} onClick={() => void retryCartRefresh()}
        className="btn-lime px-5 py-3 font-bold text-lime-ink disabled:opacity-50">장바구니 갱신 후 주문 보기</button>
      <Link href={`/mypage/orders/${createdOrder.id}?placed=1`} className="text-sm text-sub underline underline-offset-4">주문 상세 보기</Link>
    </div>}
  </div>;

  if (!cart && loading) return <CheckoutSkeleton />;
  if (!cart) return <div role="alert" className="pixel-panel p-8 text-center">
    <p className="text-sub">{cartError ?? "장바구니를 불러오지 못했어요."}</p>
    <button type="button" disabled={loading || authPending} onClick={() => void refresh().catch(() => undefined)}
      className="mt-5 rounded-lg border border-line px-5 py-3 font-semibold disabled:opacity-50">다시 불러오기</button>
  </div>;
  if (cart.items.length === 0) return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">EMPTY INVENTORY</p>
    <h2 className="text-xl font-extrabold">주문할 아이템이 없어요</h2>
    <p className="mt-3 text-sm text-sub">마음에 드는 아이템을 장바구니에 담아 보세요.</p>
    <Link href="/products" className="mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink">상품 보러가기</Link>
  </div>;

  const disabled = busy || authPending;
  const cartPending = loading || pendingIds.length > 0;
  return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div className="min-w-0 space-y-4">
      <CheckoutSummary items={cart.items.map((item) => ({ ...item, unitPrice: item.product.price }))} totalPrice={cart.totalPrice} />
      <Link href="/cart" className="inline-flex py-2 text-sm text-sub hover:text-ink">← 장바구니 수정하기</Link>
    </div>
    <form onSubmit={submit} noValidate className="min-w-0 pixel-panel p-5 sm:p-6">
      <h2 className="mb-2 text-xl font-extrabold">배송지 입력</h2>
      <fieldset disabled={disabled} className="space-y-5">
        <div>
          <label htmlFor="recipientName" className="mb-2 block text-sm font-semibold">받는 사람</label>
          <input id="recipientName" name="recipientName" autoComplete="name" maxLength={50} value={recipientName}
            onChange={(event) => { setRecipientName(event.target.value); setFieldErrors((current) => ({ ...current, recipientName: undefined })); }}
            aria-invalid={Boolean(fieldErrors.recipientName)} aria-describedby={fieldErrors.recipientName ? "recipientName-error" : undefined}
            placeholder="받는 사람 이름" className="w-full min-w-0 pixel-input px-3 py-3 text-ink focus-visible:outline-2 focus-visible:outline-violet" />
          {fieldErrors.recipientName && <p id="recipientName-error" className="mt-2 text-sm text-pink">{fieldErrors.recipientName}</p>}
        </div>
        <div>
          <label htmlFor="address" className="mb-2 block text-sm font-semibold">주소</label>
          <textarea id="address" name="address" autoComplete="street-address" rows={3} maxLength={200} value={address}
            onChange={(event) => { setAddress(event.target.value); setFieldErrors((current) => ({ ...current, address: undefined })); }}
            aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? "address-error" : undefined}
            placeholder="주소와 상세 주소" className="w-full min-w-0 resize-y pixel-input px-3 py-3 text-ink focus-visible:outline-2 focus-visible:outline-violet" />
          {fieldErrors.address && <p id="address-error" className="mt-2 text-sm text-pink">{fieldErrors.address}</p>}
        </div>
      </fieldset>
      {(error || cartError) && <div role="alert" className="mt-5 text-sm text-pink">
        <p>{error ?? cartError}</p>
        {error && <Link href="/mypage/orders" className="mt-2 inline-flex text-sub underline underline-offset-4">주문 내역 확인</Link>}
      </div>}
      <p className="mt-5 text-xs leading-relaxed text-dim">주문 버튼을 누르면 서버 장바구니의 모든 상품으로 주문이 생성돼요.</p>
      <button type="submit" disabled={disabled || cartPending}
        className="mt-4 min-h-12 w-full btn-lime px-4 py-3 text-sm font-bold text-lime-ink disabled:opacity-50">{busy ? "주문 처리 중…" : "주문하기"}</button>
      <p role="status" className="mt-3 min-h-5 text-center text-xs text-sub">{cartPending ? "장바구니 변경 사항을 확인하고 있어요." : ""}</p>
    </form>
  </div>;
}

interface CheckoutSummaryProps {
  items: ApiOrder["items"];
  totalPrice: number;
  confirmed?: boolean;
}

function CheckoutSummary({ items, totalPrice, confirmed = false }: CheckoutSummaryProps) {
  return <section aria-label={confirmed ? "확정된 주문 내용" : "주문 상품 요약"} className="min-w-0 pixel-panel p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-extrabold">{confirmed ? "확정된 주문 상품" : "주문 상품"}</h2>
      <p className="text-sm text-sub">{items.length}종 · {items.reduce((sum, item) => sum + item.quantity, 0)}개</p>
    </div>
    <ul className="divide-y divide-line">
      {items.map((item) => <li key={item.product.id} className="flex min-w-0 gap-4 py-4 first:pt-0">
        <Link href={`/products/${item.product.id}`} className="size-20 shrink-0 overflow-hidden pixel-input" aria-label={`${item.product.name} 상품 보기`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- API 상품 이미지를 별도 최적화 서버 없이 표시합니다. */}
          <img src={item.product.imageUrl} alt={item.product.name} className="aspect-square h-full w-full object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/products/${item.product.id}`} className="break-words text-sm font-bold leading-relaxed hover:text-lime">{item.product.name}</Link>
          <p className="mt-2 text-xs text-sub">{formatPrice(item.unitPrice)} × {item.quantity}개</p>
          <p className="mt-2 text-sm font-semibold">{formatPrice(item.subtotal)}</p>
        </div>
      </li>)}
    </ul>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5">
      <span className="font-semibold">총 주문 금액</span><strong className="text-2xl font-extrabold text-lime">{formatPrice(totalPrice)}</strong>
    </div>
  </section>;
}

function CheckoutLogin() {
  return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">PLAYER LOGIN</p>
    <h2 className="text-xl font-extrabold">로그인하고 주문을 시작해 보세요</h2>
    <p className="mt-3 text-sm text-sub">로그인 계정에 담아 둔 장바구니로 주문해요.</p>
    <Link href="/login?next=/checkout" className="mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink">로그인하기</Link>
  </div>;
}

export function CheckoutSkeleton() {
  return <div role="status" aria-label="주문 정보 불러오는 중" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <span className="sr-only">주문 정보를 불러오고 있어요.</span>
    <div className="h-80 animate-pulse rounded-2xl bg-panel" /><div className="h-96 animate-pulse rounded-2xl bg-panel" />
  </div>;
}
