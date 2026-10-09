import Link from "next/link";
import { safeNextPath } from "@/utils/safeNextPath";

export const localButton = "inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-panel px-4 py-2 text-sm font-semibold text-ink hover:bg-panel-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
export const localInput = "min-h-11 w-full min-w-0 rounded-lg border border-line bg-night px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-mint disabled:opacity-50";

interface LocalSkeletonProps { label?: string; }
export function LocalSkeleton({ label = "동네 정보 불러오는 중" }: LocalSkeletonProps) {
  return <div role="status" aria-label={label} className="space-y-4">
    <div className="h-24 animate-pulse rounded-xl bg-panel" />
    <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((id) => <div key={id} className="h-32 animate-pulse rounded-xl bg-panel" />)}</div>
  </div>;
}

interface LocalErrorProps { message: string; onRetry: () => void; busy?: boolean; }
export function LocalError({ message, onRetry, busy = false }: LocalErrorProps) {
  return <div role="alert" className="rounded-xl border border-pink/30 bg-panel p-5">
    <p className="break-words text-sm text-pink">{message}</p>
    <button type="button" onClick={onRetry} disabled={busy} className={`${localButton} mt-3`}>다시 시도</button>
  </div>;
}

interface LocalLoginProps { next: string; }
export function LocalLogin({ next }: LocalLoginProps) {
  return <div className="rounded-xl border border-line bg-panel p-8 text-center">
    <h2 className="text-lg font-bold">로그인하고 내 동네와 취향을 설정해 보세요</h2>
    <p className="mt-3 text-sm leading-relaxed text-sub">덕력지도는 로그인 없이도 둘러볼 수 있어요.</p>
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      <Link href={`/login?next=${encodeURIComponent(safeNextPath(next))}`} className={localButton}>로그인</Link>
      <Link href="/local" className={localButton}>덕력지도 보기</Link>
    </div>
  </div>;
}
