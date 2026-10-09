import { api } from "@/lib/api";
import type { ApiCancelRequest, ApiOrder, ApiOrderDetail, ApiOrderSummary, Page } from "@/types/api";

export interface OrderInput {
  recipientName: string;
  address: string;
}

function requestOptions(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

export const ordersApi = {
  create: ({ recipientName, address }: OrderInput, signal?: AbortSignal) =>
    // 서버 장바구니 전체로 주문하므로 화면의 상품·금액은 전송하지 않습니다.
    api.post<ApiOrder>("/orders", { recipientName, address }, requestOptions(signal)),
  list: (page: number, signal?: AbortSignal) =>
    api.get<Page<ApiOrderSummary>>(`/orders?page=${page}&size=10`, requestOptions(signal)),
  detail: (id: number, signal?: AbortSignal) =>
    api.get<ApiOrderDetail>(`/orders/${id}`, requestOptions(signal)),
  cancel: (id: number, reason: string, signal?: AbortSignal) =>
    api.post<ApiCancelRequest>(`/orders/${id}/cancel-requests`, { reason }, requestOptions(signal)),
  advance: (id: number, signal?: AbortSignal) =>
    api.post<ApiOrderDetail>(`/dev/orders/${id}/advance`, undefined, requestOptions(signal)),
};
