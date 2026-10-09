import type { Metadata } from "next";
import Link from "next/link";
import AvatarShortcut from "@/components/avatar/AvatarShortcut";

export const metadata: Metadata = { title: "마이페이지 | PIXEL MART" };

// TODO(#47): 프로필·뱃지와 로그인 사용자 전용 화면 연결
export default function MyPage() {
  return <section className="mx-auto max-w-xl px-4 py-20 text-center">
    <p className="mb-3 font-pixel text-mint">MY PLAYER</p>
    <h1 className="mb-4 text-3xl font-extrabold">마이페이지</h1>
    <p className="mb-8 text-sub">프로필과 뱃지를 모아 볼 공간을 준비 중이에요.</p>
    <AvatarShortcut />
    <Link href="/local/settings" className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2 font-pixel text-mint">LOC</span>
      <span><span className="block font-bold">내 동네·취향 설정 →</span><span className="mt-1 block text-sm text-sub">우리 동네의 취향을 발견하고 집계 참여 여부를 설정하세요.</span></span>
    </Link>
    <Link href="/mypage/orders" className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2 font-pixel text-mint">BOX</span>
      <span><span className="block font-bold">주문 내역 보기 →</span><span className="mt-1 block text-sm text-sub">주문한 아이템과 배송 진행 상황을 확인하세요.</span></span>
    </Link>
    <Link href="/mypage/wishlist" className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-panel p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">
      <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-panel-2 text-pink" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"><path d="M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2z" /></svg>
      </span>
      <span><span className="block font-bold">찜한 아이템 보기 →</span><span className="mt-1 block text-sm text-sub">마음에 드는 아이템을 한곳에 모아 보세요.</span></span>
    </Link>
    <Link href="/products" className="inline-block rounded-lg border border-line bg-panel px-6 py-3 font-semibold">상품 둘러보기</Link>
  </section>;
}
