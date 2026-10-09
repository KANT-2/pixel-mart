import { api, ApiError } from "@/lib/api";
import type { ApiCart } from "@/types/api";
import { applyCartChanges, parseQuantityInput, type CartChange } from "@/utils/cart";

export interface CartSnapshot {
  cart: ApiCart | null;
  loading: boolean;
  error: string | null;
  pendingIds: readonly number[];
}

interface Completion {
  resolve: () => void;
  reject: (error: Error) => void;
}

type CartOperation =
  | { kind: "get" }
  | { kind: "add"; productId: number; quantity: number }
  | { kind: "update"; productId: number; quantity: number }
  | { kind: "remove"; productId: number };

type Task = CartOperation & { completions: Completion[] };

function requestError(error: unknown): Error {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.name === "TimeoutError") return new Error("응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.");
  return new Error("장바구니를 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

export function createCartStore(enabled: boolean) {
  let snapshot: CartSnapshot = { cart: null, loading: enabled, error: null, pendingIds: [] };
  let confirmed: ApiCart | null = null;
  let error: string | null = null;
  let errorProductId: number | null = null;
  let active = false;
  let generation = 0;
  let current: Task | null = null;
  let controller: AbortController | null = null;
  let queue: Task[] = [];
  const listeners = new Set<() => void>();

  function publish() {
    const pending = current ? [current, ...queue] : queue;
    const changes: CartChange[] = pending.flatMap((task) => task.kind === "update" || task.kind === "remove" ? [task] : []);
    snapshot = {
      cart: applyCartChanges(confirmed, changes),
      loading: enabled && pending.some((task) => task.kind === "get"),
      error,
      pendingIds: [...new Set(pending.flatMap((task) => task.kind === "get" ? [] : [task.productId]))],
    };
    listeners.forEach((listener) => listener());
  }

  async function execute(task: Task, token: number, signal: AbortSignal) {
    try {
      const init = { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) };
      const result = task.kind === "get"
        ? await api.get<ApiCart>("/cart", { ...init, cache: "no-store" })
        : task.kind === "add"
          ? await api.post<ApiCart>("/cart/items", { productId: task.productId, quantity: task.quantity }, init)
          : task.kind === "update"
            ? await api.patch<ApiCart>(`/cart/items/${task.productId}`, { quantity: task.quantity }, init)
            : await api.delete<ApiCart>(`/cart/items/${task.productId}`, init);
      if (!active || generation !== token) return;
      confirmed = result;
      if (errorProductId === (task.kind === "get" ? null : task.productId)) error = null;
      task.completions.forEach(({ resolve }) => resolve());
    } catch (reason) {
      if (!active || generation !== token) return;
      const failure = requestError(reason);
      error = failure.message;
      errorProductId = task.kind === "get" ? null : task.productId;
      task.completions.forEach(({ reject }) => reject(failure));
    } finally {
      if (active && generation === token) {
        current = null;
        controller = null;
        publish();
        pump();
      }
    }
  }

  function pump() {
    if (!active || current || queue.length === 0) return;
    current = queue.shift()!;
    controller = new AbortController();
    void execute(current, generation, controller.signal);
  }

  function enqueue(operation: CartOperation): Promise<void> {
    if (!enabled) return Promise.reject(new Error("로그인이 필요합니다"));
    if (!active) return Promise.reject(new Error("장바구니를 준비하고 있어요. 잠시 후 다시 시도해 주세요."));
    if ((operation.kind === "add" || operation.kind === "update") && parseQuantityInput(String(operation.quantity)) === null) {
      return Promise.reject(new Error("수량은 1~99 사이의 정수로 입력해 주세요."));
    }
    const pending = current ? [current, ...queue] : queue;
    if (operation.kind !== "get" && pending.some((task) => task.kind === "remove" && task.productId === operation.productId)) {
      return Promise.reject(new Error("삭제 중인 상품이에요. 잠시 기다려 주세요."));
    }
    error = null;
    errorProductId = null;
    return new Promise<void>((resolve, reject) => {
      const completion = { resolve, reject };
      const lastSameProduct = operation.kind === "get" ? undefined : queue.findLast((task) => task.kind !== "get" && task.productId === operation.productId);
      if (operation.kind === "update" && lastSameProduct?.kind === "update") {
        lastSameProduct.quantity = operation.quantity;
        lastSameProduct.completions.push(completion);
      } else {
        const completions = [completion];
        if (operation.kind === "remove") {
          // 삭제로 대체된 미전송 수량은 나중에 다시 살아나지 않게 제거합니다.
          queue = queue.filter((task) => {
            if (task.kind !== "update" || task.productId !== operation.productId) return true;
            completions.push(...task.completions);
            return false;
          });
        }
        queue.push({ ...operation, completions });
      }
      publish();
      // 전체 장바구니 응답끼리 덮어쓰지 않도록 GET도 같은 줄에서 처리합니다.
      pump();
    });
  }

  const refresh = () => enqueue({ kind: "get" });

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (active) return;
      active = true;
      generation += 1;
      if (enabled) void refresh().catch(() => {});
    },
    stop() {
      active = false;
      generation += 1;
      controller?.abort();
      const cancelled = new DOMException("장바구니 요청이 취소되었습니다.", "AbortError");
      const tasks = current ? [current, ...queue] : queue;
      tasks.forEach((task) => task.completions.forEach(({ reject }) => reject(cancelled)));
      current = null;
      controller = null;
      queue = [];
      publish();
    },
    add: (productId: number, quantity: number) => enqueue({ kind: "add", productId, quantity }),
    update: (productId: number, quantity: number) => enqueue({ kind: "update", productId, quantity }),
    remove: (productId: number) => enqueue({ kind: "remove", productId }),
    refresh,
  };
}
