import { ApiError } from "@/lib/api";

export interface LocalSnapshot<T> { data: T | null; loading: boolean; error: string | null; status: number | null; }

export function createLocalResource<T>(load: (signal: AbortSignal) => Promise<T>, delay = 0) {
  let snapshot: LocalSnapshot<T> = { data: null, loading: true, error: null, status: null };
  let active = false;
  let generation = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  function publish(next: LocalSnapshot<T>) { snapshot = next; listeners.forEach((listener) => listener()); }
  function cancel() { ++generation; controller?.abort(); clearTimeout(timer); }
  async function refresh() {
    cancel();
    if (!active) return;
    const token = generation;
    controller = new AbortController();
    publish({ ...snapshot, loading: true, error: null, status: null });
    try {
      const data = await load(controller.signal);
      if (active && token === generation) publish({ data, loading: false, error: null, status: null });
    } catch (cause) {
      if (active && token === generation) publish({ ...snapshot, loading: false,
        error: cause instanceof ApiError ? cause.message : "정보를 불러오지 못했어요. 다시 시도해 주세요.",
        status: cause instanceof ApiError ? cause.status : null });
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { if (active) return; active = true; if (delay) timer = setTimeout(() => void refresh(), delay); else void refresh(); },
    stop() { active = false; cancel(); publish({ data: null, loading: true, error: null, status: null }); },
    refresh,
    replace(data: T) { if (!active) return; cancel(); publish({ data, loading: false, error: null, status: null }); },
  };
}
