import { api } from "@/lib/api";
import type { ApiGift } from "@/types/api";

const options = (signal?: AbortSignal): RequestInit => ({ cache: "no-store", signal });

export const giftApi = {
  send: (body: { tradePostId: number; productId: number; quantity: number; message: string }, signal?: AbortSignal) =>
    api.post<ApiGift>("/gifts", body, options(signal)),
  list: (box: "received" | "sent", signal?: AbortSignal) => api.get<ApiGift[]>(`/gifts?box=${box}`, options(signal)),
  accept: (id: number, body: { recipientName: string; address: string }, signal?: AbortSignal) =>
    api.post<ApiGift>(`/gifts/${id}/accept`, body, options(signal)),
  decline: (id: number, signal?: AbortSignal) => api.post<ApiGift>(`/gifts/${id}/decline`, {}, options(signal)),
};
