/**
 * Gọi REST backend (chế độ api). Cookie httpOnly đi kèm tự động (cùng origin qua Next rewrite).
 * - Lỗi `{ message, field, code }` → `AuthError` (có ô gây lỗi) / `ChatTimeoutError` / `ForbiddenError` / `Error`
 * - 401 → tự gọi /auth/refresh một lần rồi thử lại; vẫn 401 → báo "hết phiên"
 * - Header X-Celebrations → hiệu ứng chúc mừng; thao tác ghi thành công → báo dữ liệu đã đổi
 */
import { AuthError, ChatTimeoutError, ForbiddenError } from "./errors";
import { emitCelebrate, emitDataChanged, type Celebration } from "./events";

const BASE = "/api";
const NETWORK_ERROR = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé.";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Query = Record<string, string | number | boolean | null | undefined | readonly string[]>;

export interface RequestOptions {
  query?: Query;
  /** Không tự làm mới phiên khi 401 (các route đăng nhập/đăng ký) */
  noRefresh?: boolean;
  /** Không báo "dữ liệu đã đổi" sau thao tác ghi */
  silent?: boolean;
  signal?: AbortSignal;
}

type Field = ConstructorParameters<typeof AuthError>[1];

// ───────────── Hết phiên ─────────────

const expiredListeners = new Set<() => void>();

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

let refreshing: Promise<boolean> | null = null;

/** Gộp các lần làm mới đồng thời thành một request (refresh token xoay vòng chỉ dùng được một lần) */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// ───────────── Request ─────────────

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) params.set(k, v.join(","));
    } else params.set(k, String(v));
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ""}`;
}

function send(method: Method, url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
}

function decodeCelebrations(raw: string | null): Celebration[] {
  if (!raw) return [];
  try {
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Celebration[];
  } catch {
    return [];
  }
}

async function toError(res: Response): Promise<Error> {
  let body: { message?: string; field?: string; code?: string } = {};
  try {
    body = await res.json();
  } catch {
    // body không phải JSON (proxy lỗi, máy chủ tắt)
  }
  const message = body.message || (res.status >= 500 ? "Máy chủ gặp lỗi. Thử lại sau ít phút nhé." : NETWORK_ERROR);
  if (body.code === "CHAT_TIMEOUT") return new ChatTimeoutError();
  if (res.status === 403 && body.code === "FORBIDDEN") return new ForbiddenError();
  if (body.field || res.url.includes(`${BASE}/auth/`)) return new AuthError(message, body.field as Field);
  const error = new Error(message);
  (error as Error & { status?: number; code?: string }).status = res.status;
  (error as Error & { code?: string }).code = body.code;
  return error;
}

export async function request<T>(method: Method, path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  let res: Response;
  try {
    res = await send(method, url, body, options.signal);
    if (res.status === 401 && !options.noRefresh) {
      if (await refreshSession()) res = await send(method, url, body, options.signal);
      if (res.status === 401) expiredListeners.forEach((l) => l());
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new Error(NETWORK_ERROR);
  }
  if (!res.ok) throw await toError(res);

  decodeCelebrations(res.headers.get("X-Celebrations")).forEach(emitCelebrate);
  if (method !== "GET" && !options.silent) emitDataChanged();
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("Content-Type") ?? "";
  return (type.includes("application/json") ? await res.json() : await res.text()) as T;
}

export const http = {
  get: <T>(path: string, query?: Query, options?: RequestOptions) => request<T>("GET", path, undefined, { ...options, query }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("POST", path, body ?? {}, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", path, body ?? {}, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PATCH", path, body ?? {}, options),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("DELETE", path, body, options),
};
