import Link from "next/link";
import { Suspense } from "react";
import CartButton from "@/components/CartButton";
import HeaderSearch from "@/components/HeaderSearch";
import UserMenu from "@/components/UserMenu";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/products", label: "전체 상품" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-night/70 backdrop-blur-md">
      <div className="relative mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 md:px-8 lg:flex-nowrap lg:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-pixel text-base font-bold tracking-wide sm:text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- 과제 권장: 설정 없이 쓰는 일반 img */}
          <img src="/images/logo-invader.svg" alt="" className="h-6 w-auto" />
          PIXEL MART
        </Link>

        <div className="order-last flex w-full items-center gap-2 lg:order-none lg:ml-auto lg:w-auto lg:gap-4">
          <nav className="flex flex-1 items-center justify-center gap-1 text-sm font-semibold text-sub">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-lg px-2 py-2 transition-colors hover:bg-white/5 hover:text-ink sm:px-3"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="h-10 w-10 shrink-0 lg:w-56">
            <Suspense fallback={<div role="status" aria-label="검색창 불러오는 중" className="h-full w-full animate-pulse rounded-lg bg-panel" />}>
              <HeaderSearch />
            </Suspense>
          </div>
        </div>

        {/* 도전 과제 B: 장바구니 담은 개수 뱃지 (클라이언트 컴포넌트) */}
        <div className="ml-auto flex items-center gap-2 lg:ml-0"><CartButton /><UserMenu /></div>
      </div>
    </header>
  );
}
