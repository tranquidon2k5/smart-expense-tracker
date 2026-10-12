/**
 * Phiên đăng nhập giả lập, lưu ở localStorage để tải lại trang vẫn còn đăng nhập.
 * Bản thật: JWT do backend cấp (PRD §8), lưu trong cookie httpOnly — giao diện không đọc trực tiếp.
 */
import type { AuthSession } from "@/types";

const KEY = "so-tien:session";
type Listener = () => void;
const listeners = new Set<Listener>();

let cache: AuthSession | null | undefined;

function read(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function getStoredSession(): AuthSession | null {
  if (cache === undefined) cache = read();
  return cache;
}

export function setStoredSession(session: AuthSession | null): void {
  cache = session;
  try {
    if (session) window.localStorage.setItem(KEY, JSON.stringify(session));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Chế độ riêng tư chặn localStorage: phiên chỉ sống trong tab này
  }
  listeners.forEach((l) => l());
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  // Đăng xuất ở tab khác → tab này cũng đăng xuất
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
