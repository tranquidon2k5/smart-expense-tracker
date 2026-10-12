/**
 * Kịch bản giả lập để kiểm tra trạng thái giao diện, đọc từ URL:
 *   ?demo=empty    → tài khoản mới, chưa có dữ liệu
 *   ?demo=loading  → request không bao giờ trả về (xem skeleton)
 * Mặc định: dữ liệu đầy đủ, độ trễ mạng ~500ms.
 */
export type MockScenario = "default" | "empty" | "loading";

export function getScenario(): MockScenario {
  if (typeof window === "undefined") return "default";
  const value = new URLSearchParams(window.location.search).get("demo");
  return value === "empty" || value === "loading" ? value : "default";
}

export function simulateLatency(ms = 500): Promise<void> {
  if (getScenario() === "loading") return new Promise(() => {});
  return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 200));
}
