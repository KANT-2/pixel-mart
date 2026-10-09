"use client";

import Link from "next/link";
import GameOverScreen from "@/components/GameOverScreen";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <GameOverScreen headline="ERROR!" title="화면을 불러오지 못했어요" message="잠시 후 다시 시도해 주세요. 계속되면 홈에서 다시 시작해 주세요.">
    <button type="button" onClick={reset} className="btn-lime inline-flex min-h-11 items-center px-6 py-2 font-bold">▶ 다시 시도 CONTINUE</button>
    <Link href="/" className="btn-pixel inline-flex min-h-11 items-center px-6 py-2 font-bold">홈으로</Link>
  </GameOverScreen>;
}
