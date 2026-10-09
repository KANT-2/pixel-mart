"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useWishlist } from "@/components/WishlistProvider";
import Pagination from "@/components/Pagination";
import ProductCard from "@/components/ProductCard";
import type { ApiWishlistItem } from "@/types/api";
import { safeNextPath } from "@/utils/safeNextPath";

const PAGE_SIZE = 12;
const WISHLIST_PATH = "/mypage/wishlist";
const focusClass = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint";

interface WishlistContentsProps {
  page: number;
}

export default function WishlistContents({ page }: WishlistContentsProps) {
  const { user, loading: authLoading, pending: authPending } = useAuth();
  const { items, ready, loading, error, revision, refresh } = useWishlist();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryPages = searchParams.getAll("page");
  const queryPage = queryPages.length === 1 ? queryPages[0] : null;
  const numericPage = queryPage && /^[1-9]\d*$/.test(queryPage) ? Number(queryPage) : 1;
  const activePage = Number.isSafeInteger(numericPage) ? numericPage : 1;
  const next = safeNextPath(page > 1 ? `${WISHLIST_PATH}?page=${page}` : WISHLIST_PATH);

  // 숨겨진 캐시 페이지의 카드 기록을 비워 재방문할 때 최신 목록으로 시작합니다.
  if (pathname !== WISHLIST_PATH || activePage !== page) return null;
  if (authLoading || (user && !ready && (loading || !error))) return <WishlistSkeleton />;

  if (!user) return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">PLAYER LOGIN</p>
    <h2 className="text-xl font-bold">로그인하고 취향을 모아 보세요</h2>
    <p className="mt-3 text-sm text-sub">찜한 아이템은 다시 로그인해도 그대로 있어요.</p>
    <Link href={`/login?next=${encodeURIComponent(next)}`} className={`mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink ${focusClass}`}>로그인하기</Link>
  </div>;

  return <>
    {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-pink/30 bg-panel p-4">
      <p className="text-sm text-pink">{error}</p>
      <button type="button" disabled={loading || authPending} onClick={() => { void refresh().catch(() => undefined); }}
        className={`rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50 ${focusClass}`}>다시 시도</button>
    </div>}
    {ready ? <WishlistGrid key={`${user.id}:${page}:${revision}`} page={page} items={items} /> :
      <p className="py-12 text-center text-sub">찜한 아이템을 불러오지 못했어요. 다시 시도해 주세요.</p>}
  </>;
}

interface WishlistGridProps extends WishlistContentsProps {
  items: readonly ApiWishlistItem[];
}

function WishlistGrid({ page, items }: WishlistGridProps) {
  const router = useRouter();
  const { pending: authPending } = useAuth();
  const { wishedIds, pendingIds, loading, refresh } = useWishlist();
  const [display, setDisplay] = useState({ source: items, items });

  if (display.source !== items) {
    // 현재 화면에서 해제한 카드의 위치는 남기고 새로 찜한 상품만 앞에 합칩니다.
    const knownIds = new Set(display.items.map((item) => item.product.id));
    const currentById = new Map(items.map((item) => [item.product.id, item]));
    setDisplay({
      source: items,
      items: [
        ...items.filter((item) => !knownIds.has(item.product.id)),
        ...display.items.map((item) => currentById.get(item.product.id) ?? item),
      ],
    });
  }

  const totalPages = Math.max(1, Math.ceil(display.items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = display.items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (page !== currentPage) router.replace(currentPage > 1 ? `${WISHLIST_PATH}?page=${currentPage}` : WISHLIST_PATH, { scroll: false });
  }, [page, currentPage, router]);

  if (display.items.length === 0) return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">FIND YOUR FAVORITES</p>
    <h2 className="text-xl font-extrabold sm:text-2xl">아직 찜한 아이템이 없어요</h2>
    <p className="mt-3 text-sm text-sub">마음에 드는 상품의 하트를 눌러 모아 보세요.</p>
    <Link href="/products" className={`mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink ${focusClass}`}>상품 보러가기</Link>
  </div>;

  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">찜한 아이템 <span className="text-pink">{wishedIds.size}개</span></p>
        <p className="mt-1 text-xs text-sub">최근 찜한 순 · {currentPage} / {totalPages} 페이지</p>
      </div>
      <button type="button" disabled={loading || authPending} onClick={() => { void refresh().catch(() => undefined); }}
        className={`btn-pixel px-4 py-2 text-sm font-semibold disabled:opacity-50 ${focusClass}`}>목록 새로고침</button>
    </div>
    <p className="mb-6 text-sm leading-relaxed text-sub">해제한 아이템은 이 화면에 잠시 남아요. 하트를 다시 누르면 복구할 수 있어요.</p>
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {pageItems.map(({ product }) => <li key={product.id} className="min-w-0">
        <ProductCard product={product} muted={!wishedIds.has(product.id)} />
        <p className="mt-2 min-h-10 px-1 text-xs leading-5 text-sub" aria-live="polite">
          {!wishedIds.has(product.id) && "찜을 해제했어요 · 하트를 누르면 복구돼요."}
        </p>
      </li>)}
    </ul>
    <p role="status" className="mt-3 min-h-5 text-center text-xs text-sub">
      {pendingIds.length > 0 ? "찜 목록을 저장하고 있어요." : loading ? "찜 목록을 확인하고 있어요." : ""}
    </p>
    <Pagination currentPage={currentPage} totalPages={totalPages} basePath={WISHLIST_PATH} />
  </>;
}

export function WishlistSkeleton() {
  return <div role="status" aria-label="찜한 아이템 불러오는 중">
    <span className="sr-only">찜한 아이템을 불러오고 있어요.</span>
    <div className="mb-6 h-10 w-40 animate-pulse rounded-lg bg-panel" />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((key) => <div key={key} className="aspect-[3/4] animate-pulse rounded-2xl bg-panel" />)}
    </div>
  </div>;
}
