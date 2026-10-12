/**
 * Kịch bản giả lập để kiểm tra trạng thái giao diện, đọc từ URL:
 *   ?demo=empty    → tài khoản mới, chưa có dữ liệu
 *   ?demo=loading  → request không bao giờ trả về (xem skeleton)
 *   ?demo=error    → các API danh sách giao dịch trả lỗi (xem trạng thái lỗi)
 * Mặc định: dữ liệu đầy đủ, độ trễ mạng ~500ms.
 */
export type MockScenario = "default" | "empty" | "loading" | "error";

export function getScenario(): MockScenario {
  if (typeof window === "undefined") return "default";
  const value = new URLSearchParams(window.location.search).get("demo");
  return value === "empty" || value === "loading" || value === "error" ? value : "default";
}

export function simulateLatency(ms = 500): Promise<void> {
  if (getScenario() === "loading") return new Promise(() => {});
  return new Promise((resolve) => setTimeout(resolve, ms + Math.random() * 200));
}

/** Ném lỗi mạng giả khi đang ở kịch bản ?demo=error */
export function failIfErrorScenario(): void {
  if (getScenario() === "error") {
    throw new Error("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé.");
  }
}
