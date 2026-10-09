import Link from "next/link";
import { localButton } from "@/components/local/LocalStates";
import { safeNextPath } from "@/utils/safeNextPath";

export function TradeNotice() {
  return <p className="mb-6 rounded-xl border border-violet/30 bg-panel p-4 text-sm leading-relaxed text-sub"><span className="mr-2 font-pixel text-xs text-violet">SAFE TRADE</span>같은 구·생활권의 물건을 발견하는 게시판이에요. 연락처·정확한 장소는 적을 수 없어요.</p>;
}
interface TradeLoginProps { next: string; }
export function TradeLogin({ next }: TradeLoginProps) {
  return <div className="pixel-panel p-8 text-center"><h2 className="text-xl font-bold">로그인하고 내 거래·교환을 시작해 보세요</h2>
    <p className="mt-3 text-sm text-sub">게시판과 Wish Map은 로그인 없이 둘러볼 수 있어요.</p>
    <Link href={`/login?next=${encodeURIComponent(safeNextPath(next))}`} className={`${localButton} mt-5`}>로그인</Link>
  </div>;
}
export function TradeRegionPrompt() {
  return <div className="pixel-panel p-8 text-center"><h2 className="text-xl font-bold">먼저 내 지역을 설정해 주세요.</h2>
    <p className="mt-3 text-sm text-sub">글은 내 동네 설정에 저장한 지역으로 등록돼요.</p><Link href="/local/settings" className={`${localButton} mt-5`}>내 동네 설정</Link>
  </div>;
}
