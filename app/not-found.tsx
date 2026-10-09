import type { Metadata } from "next";
import Link from "next/link";
import GameOverScreen from "@/components/GameOverScreen";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요 | PIXEL MART" };

export default function NotFound() {
  return <GameOverScreen headline="GAME OVER" code="404" title="페이지를 찾을 수 없어요" message="주소가 잘못되었거나 사라진 페이지예요.">
    <Link href="/" className="btn-lime inline-flex min-h-11 items-center px-6 py-2 font-bold">▶ 홈으로 CONTINUE</Link>
    <Link href="/products" className="btn-pixel inline-flex min-h-11 items-center px-6 py-2 font-bold">상품 둘러보기</Link>
  </GameOverScreen>;
}
