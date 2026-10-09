import Link from "next/link";
import GameOverScreen from "@/components/GameOverScreen";

export default function ProductNotFound() {
  return <GameOverScreen headline="GAME OVER" code="404" title="상품을 찾을 수 없습니다" message="주소가 잘못되었거나 판매가 끝난 상품이에요.">
    <Link href="/products" className="btn-lime inline-flex min-h-11 items-center px-6 py-2 font-bold">▶ 상품 목록으로</Link>
    <Link href="/" className="btn-pixel inline-flex min-h-11 items-center px-6 py-2 font-bold">홈으로</Link>
  </GameOverScreen>;
}
