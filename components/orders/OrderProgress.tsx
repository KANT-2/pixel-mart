import type { ApiOrderDetail } from "@/types/api";
import { getDeliverySteps } from "@/utils/orders";
import { formatDate } from "@/utils/formatDate";

interface OrderProgressProps {
  order: ApiOrderDetail;
}

export default function OrderProgress({ order }: OrderProgressProps) {
  const steps = getDeliverySteps(order);

  return <section aria-labelledby="order-progress-title" className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
      <h2 id="order-progress-title" className="text-lg font-extrabold">배송 현황</h2>
      <span className="font-pixel text-xs text-dim" aria-hidden="true">DELIVERY QUEST</span>
    </div>
    {steps.length > 0 ? <ol aria-label="배송 진행 단계" className="grid gap-3 sm:grid-cols-4">
      {steps.map((step, index) => <li key={step.status} aria-current={step.current ? "step" : undefined}
        className={`flex min-w-0 items-center gap-3 border-2 p-3 sm:flex-col sm:items-start ${step.current ? "border-mint bg-mint/5" : step.reached ? "border-line bg-panel-2" : "border-line"}`}>
        <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center border-2 font-pixel text-xs ${step.reached ? "border-mint text-mint" : "border-dim/40 text-dim"}`}>{index + 1}</span>
        <div className="min-w-0"><p className={`text-sm font-bold ${step.reached ? "text-ink" : "text-dim"}`}>{step.label}</p>
          <p className="mt-1 text-xs text-sub">{step.current ? "현재 단계" : step.reached ? "완료" : ""}</p></div>
      </li>)}
    </ol> : <div className="border-l-4 border-pink bg-panel-2 p-4">
      <p className="font-bold text-pink">{order.statusLabel}</p>
      <p className="mt-2 text-sm leading-relaxed text-sub">취소 진행 상황은 아래 주문 기록에서 확인해 주세요.</p>
    </div>}
    <h3 className="mb-5 mt-8 text-sm font-bold">주문 타임라인</h3>
    <ol aria-label="주문 상태 변경 기록" className="ml-2 border-l-2 border-line">
      {order.timeline.map((entry, index) => <li key={`${entry.status}:${entry.changedAt}:${index}`} className="relative pb-6 pl-6 last:pb-0">
        <span aria-hidden="true" className={`absolute -left-[6px] top-1 size-2.5 ${index === order.timeline.length - 1 ? "bg-mint" : "bg-dim"}`} />
        <p className="text-sm font-semibold">{entry.label}</p>
        <time dateTime={entry.changedAt} className="mt-1 block text-xs text-dim">{formatDate(entry.changedAt)}</time>
      </li>)}
    </ol>
  </section>;
}
