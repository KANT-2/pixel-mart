import type { ApiOrderDetail } from "@/types/api";

// 미도달 단계에만 사용하며, 서버 STATUS_LABELS와 테스트로 일치 여부를 확인합니다.
export const DELIVERY_STEPS = [
  { status: "paid", label: "주문 완료" },
  { status: "preparing", label: "상품 준비중" },
  { status: "shipping", label: "배송중" },
  { status: "delivered", label: "배송 완료" },
] as const;

export function getDeliverySteps(order: Pick<ApiOrderDetail, "status" | "timeline">) {
  if (order.status === "cancel_requested" || order.status === "cancelled") return [];
  const currentIndex = DELIVERY_STEPS.findIndex((step) => step.status === order.status);
  return DELIVERY_STEPS.map((step, index) => {
    const reached = currentIndex >= index;
    // 취소 거절 후 같은 단계가 다시 기록되어도 최신 서버 라벨을 우선합니다.
    const entry = order.timeline.findLast((entry) => entry.status === step.status);
    return { ...step, label: reached && entry ? entry.label : step.label, reached, current: currentIndex === index };
  });
}

export function canCancelOrder(status: string): boolean {
  return status === "paid" || status === "preparing";
}

export function canAdvanceOrder(status: string): boolean {
  return status === "paid" || status === "preparing" || status === "shipping";
}

export interface OrderFormErrors {
  recipientName?: string;
  address?: string;
}

export function validateOrderForm(recipientName: string, address: string) {
  const values = { recipientName: recipientName.trim(), address: address.trim() };
  const errors: OrderFormErrors = {};
  if (!values.recipientName) errors.recipientName = "받는 사람을 입력해 주세요.";
  else if (Array.from(values.recipientName).length > 50) errors.recipientName = "받는 사람은 50자 이내로 입력해 주세요.";
  if (!values.address) errors.address = "주소를 입력해 주세요.";
  else if (Array.from(values.address).length > 200) errors.address = "주소는 200자 이내로 입력해 주세요.";
  return { values, errors, valid: Object.keys(errors).length === 0 };
}

export function validateCancelReason(reason: string) {
  const value = reason.trim();
  const error = !value ? "취소 사유를 입력해 주세요."
    : Array.from(value).length > 200 ? "취소 사유는 200자 이내로 입력해 주세요." : null;
  return { value, error };
}

export function parseOrderId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && String(id) === value ? id : null;
}

export function parseOrderPage(value: unknown): number {
  return typeof value === "string" ? parseOrderId(value) ?? 1 : 1;
}
