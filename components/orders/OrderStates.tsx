import Link from "next/link";
import { safeNextPath } from "@/utils/safeNextPath";

interface OrderLoginPromptProps {
  next: string;
}

export function OrderLoginPrompt({ next }: OrderLoginPromptProps) {
  return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">PLAYER LOGIN</p>
    <h2 className="text-xl font-extrabold">로그인하고 주문을 확인해 보세요</h2>
    <p className="mt-3 text-sm leading-relaxed text-sub">주문 내역과 배송 진행 상황은 로그인한 계정에 저장돼요.</p>
    <Link href={`/login?next=${encodeURIComponent(safeNextPath(next))}`} className="mt-7 inline-flex btn-lime px-6 py-3 font-bold text-lime-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">로그인하기</Link>
  </div>;
}

export function OrderSkeleton() {
  return <div role="status" aria-label="주문 불러오는 중" className="space-y-5">
    <span className="sr-only">주문 정보를 불러오고 있어요.</span>
    <div className="h-24 animate-pulse rounded-2xl bg-panel motion-reduce:animate-none" />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">{[0, 1].map((key) => <div key={key} className="h-40 animate-pulse rounded-2xl bg-panel motion-reduce:animate-none" />)}</div>
      <div className="h-64 animate-pulse rounded-2xl bg-panel motion-reduce:animate-none" />
    </div>
  </div>;
}

export function OrderNotFound() {
  return <div className="pixel-panel px-5 py-16 text-center">
    <p className="mb-3 font-pixel text-violet" aria-hidden="true">ORDER NOT FOUND</p>
    <h2 className="text-xl font-extrabold">주문을 찾을 수 없어요</h2>
    <p className="mt-3 text-sm leading-relaxed text-sub">주문 번호를 확인하거나 내 주문 목록에서 다시 선택해 주세요.</p>
    <Link href="/mypage/orders" className="mt-7 inline-flex btn-pixel px-6 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint">주문 내역 보기</Link>
  </div>;
}
