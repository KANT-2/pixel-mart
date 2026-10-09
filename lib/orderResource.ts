import { ApiError } from "@/lib/api";

export interface OrderResourceSnapshot<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  errorStatus: number | null;
}

export function createOrderResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  let snapshot: OrderResourceSnapshot<T> = { data: null, loading: true, error: null, errorStatus: null };
  let active = false;
  let generation = 0;
  let controller: AbortController | null = null;
  let rejectPending: ((reason: Error) => void) | null = null;
  const listeners = new Set<() => void>();

  function publish(next: OrderResourceSnapshot<T>) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function cancelPending() {
    generation += 1;
    controller?.abort();
    controller = null;
    rejectPending?.(new DOMException("주문 조회가 취소되었습니다.", "AbortError"));
    rejectPending = null;
  }

  function refresh(): Promise<T> {
    cancelPending();
    if (!active) {
      const cancelled = Promise.reject<T>(new DOMException("주문 화면이 닫혔습니다.", "AbortError"));
      void cancelled.catch(() => {});
      return cancelled;
    }
    controller = new AbortController();
    const signal = controller.signal;
    const token = generation;
    publish({ ...snapshot, loading: true, error: null, errorStatus: null });
    const promise = new Promise<T>((resolve, reject) => {
      rejectPending = reject;
      void (async () => {
        try {
          const data = await load(signal);
          if (!active || token !== generation) return;
          publish({ data, loading: false, error: null, errorStatus: null });
          resolve(data);
        } catch (reason) {
          if (!active || token !== generation) return;
          const message = reason instanceof ApiError ? reason.message
            : reason instanceof Error && reason.name === "TimeoutError" ? "응답이 늦어지고 있어요. 다시 시도해 주세요."
              : "주문 정보를 불러오지 못했어요. 다시 시도해 주세요.";
          publish({ ...snapshot, loading: false, error: message, errorStatus: reason instanceof ApiError ? reason.status : null });
          reject(reason);
        } finally {
          if (token === generation) {
            controller = null;
            rejectPending = null;
          }
        }
      })();
    });
    // 자동 조회와 화면 해제도 같은 경로를 사용하므로 취소를 처리하지 않아도 안전하게 합니다.
    void promise.catch(() => {});
    return promise;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (active) return;
      active = true;
      void refresh().catch(() => {});
    },
    stop() {
      active = false;
      cancelPending();
      publish({ data: null, loading: false, error: null, errorStatus: null });
    },
    refresh,
    replaceData(data: T) {
      if (!active) return;
      cancelPending();
      publish({ data, loading: false, error: null, errorStatus: null });
    },
  };
}
