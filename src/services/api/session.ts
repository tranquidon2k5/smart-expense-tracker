/**
 * Phiên đăng nhập ở chế độ api: lấy từ GET /auth/me (cookie httpOnly — giao diện không đọc token).
 * `undefined` = đang hỏi server, `null` = chưa đăng nhập / hết phiên.
 */
import type { AuthSession } from "@/types";
import { http, onSessionExpired } from "../http";

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: AuthSession | null | undefined;
let loading = false;

function set(session: AuthSession | null) {
  cache = session;
  listeners.forEach((l) => l());
}

function load() {
  if (loading || cache !== undefined || typeof window === "undefined") return;
  // Không có cookie vai trò (đặt cùng lúc với refresh token) → chắc chắn chưa đăng nhập, khỏi gọi API
  if (!document.cookie.split("; ").some((c) => c.startsWith("st_role="))) {
    set(null);
    return;
  }
  loading = true;
  http
    .get<AuthSession>("/auth/me")
    .then((s) => set(s))
    .catch(() => set(null))
    .finally(() => {
      loading = false;
    });
}

// Refresh token hết hạn / bị thu hồi (vd. tài khoản bị khoá) → về trang đăng nhập
onSessionExpired(() => {
  if (cache) set(null);
});

export function getApiSession(): AuthSession | null | undefined {
  return cache;
}

export function setApiSession(session: AuthSession | null): void {
  set(session);
}

export function subscribeApiSession(listener: Listener): () => void {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}
