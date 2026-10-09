import { fandomPresentation } from "@/utils/local";
import type { ApiFandom } from "@/types/api";

interface FandomCountProps { row: Pick<ApiFandom, "count" | "belowThreshold" | "isSample">; maximum?: number; }

export default function FandomCount({ row, maximum = 1 }: FandomCountProps) {
  const view = fandomPresentation(row);
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className={`${view.count === null ? "text-base text-sub" : "text-2xl text-mint"}`}>{view.label}</strong>
      {view.sample && <span className="rounded border border-violet/40 bg-panel-2 px-2 py-1 text-xs text-violet">{view.sample}</span>}
    </div>
    {view.count === null ? <p className="mt-3 text-xs text-dim">아직 소수의 팬이 있어요</p>
      : <div aria-hidden="true" className="mt-4 h-2 overflow-hidden bg-panel-2"><div className="h-full bg-mint" style={{ width: `${Math.min(100, view.count / Math.max(1, maximum) * 100)}%` }} /></div>}
  </div>;
}
