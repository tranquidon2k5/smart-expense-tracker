/** Báo cho các màn hình đang mở rằng dữ liệu đã đổi (vd. vừa ghi giao dịch). */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitDataChanged(): void {
  listeners.forEach((l) => l());
}

// ───────────── Chúc mừng thành tích (F11–F14) ─────────────

export type CelebrationKind = "streak" | "badge" | "level" | "mission";

export interface Celebration {
  kind: CelebrationKind;
  title: string;
  description: string;
  /** Tên icon Lucide (Flame, Award…) */
  icon: string;
  xp?: number;
}

type CelebrationListener = (c: Celebration) => void;
const celebrationListeners = new Set<CelebrationListener>();

export function onCelebrate(listener: CelebrationListener): () => void {
  celebrationListeners.add(listener);
  return () => celebrationListeners.delete(listener);
}

export function emitCelebrate(c: Celebration): void {
  celebrationListeners.forEach((l) => l(c));
}
