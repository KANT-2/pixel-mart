export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

function apiPath(path: string) {
  return `/api/${path.replace(/^\/?api\//, "").replace(/^\/+/, "")}`;
}

function errorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || !("detail" in body)) return;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail.flatMap((item: unknown) =>
      item && typeof item === "object" && "msg" in item && typeof item.msg === "string" ? [item.msg] : [],
    ).join(" · ") || undefined;
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    if (response.ok) throw new ApiError("서버 응답을 읽을 수 없습니다", response.status);
  }
  if (!response.ok) {
    throw new ApiError(
      response.status === 401 ? "로그인이 필요합니다" : errorDetail(body) ?? "요청을 처리하지 못했습니다",
      response.status,
    );
  }
  return body as T;
}

function clientRequest<T>(method: string, path: string, body?: unknown, init?: RequestInit) {
  return request<T>(apiPath(path), {
    ...init,
    credentials: "same-origin",
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => clientRequest<T>("GET", path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => clientRequest<T>("POST", path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => clientRequest<T>("PATCH", path, body, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) => clientRequest<T>("PUT", path, body, init),
  delete: <T = void>(path: string, init?: RequestInit) => clientRequest<T>("DELETE", path, undefined, init),
};

export function serverFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (typeof window !== "undefined") throw new Error("serverFetch는 서버에서만 사용할 수 있습니다");
  const base = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
  const timeout = AbortSignal.timeout(3000);
  return request<T>(`${base}${apiPath(path)}`, {
    ...init,
    cache: "no-store",
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
}
