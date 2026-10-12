import type { ReactNode } from "react";

interface LocalPageHeaderProps { kicker: string; title: string; description: string; actions?: ReactNode; }

/** PIXEL LOCAL 탭 공통 머리 — 덕력지도·거래·교환·위시맵이 같은 자리에 같은 크기로 */
export default function LocalPageHeader({ kicker, title, description, actions }: LocalPageHeaderProps) {
  // 모바일은 제목과 버튼만 한 줄로 — 영문 라벨·설명은 sm 이상에서
  return <header className="mb-3 flex items-center justify-between gap-3 sm:mb-4 sm:flex-wrap sm:items-end sm:gap-x-6 sm:gap-y-3">
    <div className="min-w-0">
      <p className="stage-kicker mb-1.5 hidden font-pixel text-sm text-mint sm:block">{kicker}</p>
      <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
      <p className="mt-1.5 hidden text-sm text-sub sm:block">{description}</p>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}
