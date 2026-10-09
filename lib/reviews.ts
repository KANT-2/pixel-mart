import { api, ApiError } from "@/lib/api";
import type { ApiReview, ApiReviewPage } from "@/types/api";
import { reviewPageAfterReload } from "@/utils/productFeedback";

export interface ReviewInput { rating: number; content: string; }

function options(signal?: AbortSignal): RequestInit {
  const timeout = AbortSignal.timeout(10000);
  return { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
}

export const reviewsApi = {
  list: (productId: number, page: number, signal?: AbortSignal) =>
    api.get<ApiReviewPage>(`/products/${productId}/reviews?page=${page}&size=10`, options(signal)),
  create: (productId: number, input: ReviewInput, signal?: AbortSignal) =>
    api.post<ApiReview>(`/products/${productId}/reviews`, input, options(signal)),
  remove: (productId: number, reviewId: number, signal?: AbortSignal) =>
    api.delete<{ message: string }>(`/products/${productId}/reviews/${reviewId}`, options(signal)),
};

interface ReviewSnapshot {
  data: ApiReviewPage | null;
  loading: boolean;
  error: string | null;
  requestedPage: number;
}

// isMine은 사용자별 값이므로 서버 캐시와 분리하고, 늦은 응답으로 덮어쓰지 않습니다.
export function createReviewStore(productId: number, transport = reviewsApi) {
  let snapshot: ReviewSnapshot = { data: null, loading: true, error: null, requestedPage: 1 };
  let active = false;
  let generation = 0;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  function publish(next: ReviewSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  async function load(page = 1) {
    controller?.abort();
    const token = ++generation;
    if (!active) return;
    controller = new AbortController();
    const signal = controller.signal;
    const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
    publish({ ...snapshot, loading: true, error: null, requestedPage });
    try {
      let data = await transport.list(productId, requestedPage, signal);
      if (!active || token !== generation) return;
      const correctedPage = reviewPageAfterReload(data);
      if (correctedPage !== data.page) {
        publish({ ...snapshot, requestedPage: correctedPage });
        data = await transport.list(productId, correctedPage, signal);
      }
      if (!active || token !== generation) return;
      publish({ data, loading: false, error: null, requestedPage: data.page });
    } catch (cause) {
      if (!active || token !== generation) return;
      publish({ ...snapshot, loading: false, error: cause instanceof ApiError ? cause.message : "리뷰를 불러오지 못했어요. 다시 시도해 주세요." });
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { if (!active) { active = true; void load(); } },
    stop() { active = false; ++generation; controller?.abort(); publish({ data: null, loading: true, error: null, requestedPage: 1 }); },
    load,
  };
}
