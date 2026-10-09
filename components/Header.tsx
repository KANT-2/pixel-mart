import Link from "next/link";
import { Suspense } from "react";
import CartButton from "@/components/CartButton";
import HeaderSearch from "@/components/HeaderSearch";
import UserMenu from "@/components/UserMenu";
import HeaderNav, { HeaderNavFallback } from "@/components/HeaderNav";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-night/70 backdrop-blur-md">
      <div className="relative mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 md:px-8 lg:flex-nowrap lg:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-pixel text-base font-bold tracking-wide sm:text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- 과제 권장: 설정 없이 쓰는 일반 img */}
          <img src="/images/logo-invader.svg" alt="" className="h-6 w-auto" />
          PIXEL MART
        </Link>

        <nav aria-label="주 메뉴" className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain lg:order-none lg:ml-auto lg:w-auto lg:flex-1">
          <Suspense fallback={<HeaderNavFallback />}><HeaderNav /></Suspense>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <CartButton />
          <div className="h-10 w-10 shrink-0 lg:w-48 xl:w-56">
            <Suspense fallback={<div role="status" aria-label="검색창 불러오는 중" className="h-full w-full animate-pulse rounded-lg bg-panel" />}>
              <HeaderSearch />
            </Suspense>
          </div>
          <UserMenu compact />
        </div>
      </div>
    </header>
  );
}
