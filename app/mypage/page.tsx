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
    <Link href="/products" className="inline-block rounded-lg border border-line bg-panel px-6 py-3 font-semibold">상품 둘러보기</Link>
  </section>;
}
