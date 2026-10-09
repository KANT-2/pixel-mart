import type { ReactNode } from "react";

interface GameOverScreenProps {
  /** 픽셀 큰 글자 (예: "GAME OVER") */
  headline: string;
  /** 작은 상태 표시 (예: "404") */
  code?: string;
  title: string;
  message: string;
  children?: ReactNode;
}

/** 찾을 수 없음·오류 화면 — 게임 오버 화면처럼, 쓰러진 슬라임과 CONTINUE 안내 */
export default function GameOverScreen({ headline, code, title, message, children }: GameOverScreenProps) {
  return <section className="mx-auto max-w-xl px-4 py-16 text-center md:py-24">
    <div className="pixel-panel px-6 py-10">
      <p className="font-pixel text-4xl text-pink drop-shadow-[3px_3px_0_#3a1030] md:text-5xl">{headline}</p>
      {code && <p className="mt-2 font-pixel text-xs tracking-[0.3em] text-dim">STAGE {code}</p>}
      {/* 쓰러진 슬라임 — 장식 */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 작은 픽셀 SVG를 보간 없이 표시 */}
      <img src="/images/hero-slime.svg" alt="" width={96} height={72} className="mx-auto my-6 h-auto w-24 rotate-180 opacity-80 [image-rendering:pixelated]" />
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-3 text-sub">{message}</p>
      <p className="mt-6 font-pixel text-xs tracking-[0.3em] text-lime motion-safe:animate-[pulse_1.2s_steps(2)_infinite]">CONTINUE?</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  </section>;
}
