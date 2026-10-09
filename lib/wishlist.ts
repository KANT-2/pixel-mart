import { api, ApiError } from "@/lib/api";
import type { ApiWishlistItem, Page } from "@/types/api";

export interface WishlistSnapshot {
  items: readonly ApiWishlistItem[];
  wishedIds: ReadonlySet<number>;
  ready: boolean;
  loading: boolean;
  error: string | null;
  errors: ReadonlyMap<number, string>;
  pendingIds: readonly number[];
  revision: number;
}

interface Completion {
  resolve: () => void;
  reject: (error: Error) => void;
}

type Operation = { kind: "get" } | { kind: "set"; productId: number; wished: boolean };
type Task = Operation & { completions: Completion[] };

function requestError(error: unknown): Error {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.name === "TimeoutError") return new Error("응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.");
  return new Error("찜 목록을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
}

async function readAll(signal: AbortSignal): Promise<ApiWishlistItem[]> {
  const items = new Map<number, ApiWishlistItem>();
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    const result = await api.get<Page<ApiWishlistItem>>(`/wishlist?page=${page}&size=60`, {
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
    signal.throwIfAborted();
    totalPages = result.totalPages;
    for (const item of result.items) {
      const previous = items.get(item.product.id);
      if (!previous || Date.parse(item.createdAt) > Date.parse(previous.createdAt)) items.set(item.product.id, item);
    }
  }
  return [...items.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.product.id - a.product.id);
}

export function createWishlistStore(enabled: boolean) {
  let items: ApiWishlistItem[] = [];
  let ready = !enabled;
  let revision = 0;
  let loadError: string | null = null;
  const errors = new Map<number, string>();
  let snapshot: WishlistSnapshot = {
    items, wishedIds: new Set(), ready, loading: enabled, error: null, errors: new Map(), pendingIds: [], revision,
  };
  let active = false;
  let generation = 0;
  let current: Task | null = null;
  let controller: AbortController | null = null;
  let queue: Task[] = [];
  const listeners = new Set<() => void>();

  function publish() {
    const pending = current ? [current, ...queue] : queue;
    const wishedIds = new Set(items.map((item) => item.product.id));
    for (const task of pending) {
      if (task.kind === "set") {
        if (task.wished) wishedIds.add(task.productId);
        else wishedIds.delete(task.productId);
      }
    }
    snapshot = {
      items,
      wishedIds,
      ready,
      loading: enabled && pending.some((task) => task.kind === "get"),
      error: loadError ?? [...errors.values()].at(-1) ?? null,
      errors: new Map(errors),
      pendingIds: [...new Set(pending.flatMap((task) => task.kind === "set" ? [task.productId] : []))],
      revision,
    };
    listeners.forEach((listener) => listener());
  }

  async function execute(task: Task, token: number, signal: AbortSignal) {
    try {
      if (task.kind === "get") {
        const result = await readAll(signal);
        if (!active || generation !== token) return;
        // 모든 페이지를 확인하기 전에는 기존 하트와 목록을 바꾸지 않습니다.
        items = result;
        ready = true;
        revision += 1;
        loadError = null;
        errors.clear();
      } else {
        const init = { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) };
        if (task.wished) {
          const item = await api.put<ApiWishlistItem>(`/wishlist/${task.productId}`, undefined, init);
          if (!active || generation !== token) return;
          items = [item, ...items.filter((previous) => previous.product.id !== item.product.id)];
        } else {
          try {
            await api.delete(`/wishlist/${task.productId}`, init);
          } catch (reason) {
            if (!(reason instanceof ApiError && reason.status === 404)) throw reason;
          }
          if (!active || generation !== token) return;
          items = items.filter((item) => item.product.id !== task.productId);
        }
        errors.delete(task.productId);
      }
      task.completions.forEach(({ resolve }) => resolve());
    } catch (reason) {
      if (!active || generation !== token) return;
      const failure = requestError(reason);
      if (task.kind === "get") loadError = failure.message;
      else {
        errors.delete(task.productId);
        errors.set(task.productId, failure.message);
      }
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
    // 실패 직전 서버에 반영됐을 수 있어, 마지막 의도는 기존 값과 같아도 전송합니다.
    void execute(current, generation, controller.signal);
  }

  function enqueue(operation: Operation): Promise<void> {
    if (!enabled) return Promise.reject(new Error("로그인이 필요합니다"));
    if (!active || (operation.kind === "set" && (!ready || snapshot.loading))) {
      return Promise.reject(new Error("찜 목록을 준비하고 있어요. 잠시 후 다시 시도해 주세요."));
    }
    return new Promise<void>((resolve, reject) => {
      const completion = { resolve, reject };
      const previous = operation.kind === "set"
        ? queue.findLast((task) => task.kind === "set" && task.productId === operation.productId)
        : queue.at(-1);
      if (operation.kind === "set" && previous?.kind === "set") {
        previous.wished = operation.wished;
        previous.completions.push(completion);
      } else if (operation.kind === "get" && previous?.kind === "get") {
        previous.completions.push(completion);
      } else {
        queue.push({ ...operation, completions: [completion] });
      }
      publish();
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
      const cancelled = new DOMException("찜 요청이 취소되었습니다.", "AbortError");
      const tasks = current ? [current, ...queue] : queue;
      tasks.forEach((task) => task.completions.forEach(({ reject }) => reject(cancelled)));
      current = null;
      controller = null;
      queue = [];
      items = [];
      ready = !enabled;
      loadError = null;
      errors.clear();
      publish();
    },
    toggle: (productId: number) => enqueue({ kind: "set", productId, wished: !snapshot.wishedIds.has(productId) }),
    refresh,
  };
}
