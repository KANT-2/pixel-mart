import type { ReactNode } from "react";

interface LocalPageHeaderProps { kicker: string; title: string; description: string; actions?: ReactNode; }

/** PIXEL LOCAL 탭 공통 머리 — 덕력지도·거래·교환·위시맵이 같은 자리에 같은 크기로 */
export default function LocalPageHeader({ kicker, title, description, actions }: LocalPageHeaderProps) {
  return <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
    <div className="min-w-0">
      <p className="stage-kicker mb-1.5 font-pixel text-sm text-mint">{kicker}</p>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-1.5 text-sm text-sub">{description}</p>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}
