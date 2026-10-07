import Link from "next/link";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/products", label: "전체 상품" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-night/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-pixel text-base font-bold tracking-wide sm:text-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- 과제 권장: 설정 없이 쓰는 일반 img */}
          <img src="/images/logo-invader.svg" alt="" className="h-6 w-auto" />
          PIXEL MART
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm font-semibold text-sub">
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

        {/* 도전 과제 B: 장바구니 담기 시 이 아이콘 옆에 숫자 뱃지 표시 */}
        <button
          type="button"
          aria-label="장바구니"
          className="grid size-10 place-items-center rounded-lg border border-line bg-white/5 transition-colors hover:border-violet/40"
        >
          <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" />
            <circle cx="9.5" cy="20" r="1.2" />
            <circle cx="17" cy="20" r="1.2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
