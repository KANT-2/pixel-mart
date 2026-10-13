import { api } from "@/lib/api";
import type { ApiNotification } from "@/types/api";

const options = (signal?: AbortSignal): RequestInit => ({ cache: "no-store", signal });

export const notificationApi = {
  list: (signal?: AbortSignal) => api.get<{ items: ApiNotification[]; unread: number }>("/notifications?limit=30", options(signal)),
  unread: (signal?: AbortSignal) => api.get<{ unread: number }>("/notifications/unread-count", options(signal)),
  /** ids가 없으면 모두 읽음 */
  read: (ids: number[] | null) => api.post<{ unread: number }>("/notifications/read", { ids }),
};
