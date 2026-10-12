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
