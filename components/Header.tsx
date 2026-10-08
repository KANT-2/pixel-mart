import Link from "next/link";
import CartButton from "@/components/CartButton";
import UserMenu from "@/components/UserMenu";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/products", label: "전체 상품" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-night/70 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-2 gap-y-2 px-4 py-3 sm:flex-nowrap sm:gap-4 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-pixel text-base font-bold tracking-wide sm:text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- 과제 권장: 설정 없이 쓰는 일반 img */}
          <img src="/images/logo-invader.svg" alt="" className="h-6 w-auto" />
          PIXEL MART
        </Link>

        <nav className="order-last flex w-full items-center justify-center gap-1 text-sm font-semibold text-sub sm:order-none sm:ml-auto sm:w-auto">
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

        {/* 도전 과제 B: 장바구니 담은 개수 뱃지 (클라이언트 컴포넌트) */}
        <div className="ml-auto flex items-center gap-2 sm:ml-0"><CartButton /><UserMenu /></div>
      </div>
    </header>
  );
}
