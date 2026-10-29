/**
 * Dịch nội dung mặc định đến từ dữ liệu (danh mục, ví, nhiệm vụ, huy hiệu, danh hiệu cấp độ).
 * Dữ liệu trong database luôn là tiếng Việt; ở tiếng Anh, chuỗi nào khớp đúng một mục mặc định thì
 * hiện bản dịch, còn tên người dùng tự đặt (danh mục riêng, ví "Quỹ du lịch"…) giữ nguyên.
 */
import { getActiveLocale } from "./core";

const EN: Record<string, string> = {
  // Danh mục mặc định
  "Ăn uống": "Food & drinks",
  "Di chuyển": "Transport",
  "Học tập": "Education",
  "Giải trí": "Entertainment",
  "Mua sắm": "Shopping",
  "Hoá đơn": "Bills",
  "Hóa đơn": "Bills",
  "Sức khoẻ": "Health",
  "Sức khỏe": "Health",
  Khác: "Other",
  Lương: "Salary",
  Thưởng: "Bonus",
  "Thu khác": "Other income",
  // Nhiệm vụ mặc định
  "Ghi ít nhất 3 giao dịch": "Log at least 3 transactions",
  "Hỏi trợ lý AI 1 câu": "Ask the AI assistant 1 question",
  "Duyệt hết giao dịch chờ": "Review all pending transactions",
  "Ghi chép đủ 5/7 ngày": "Log on 5 of 7 days",
  "Duyệt 10 giao dịch AI chờ xác nhận": "Review 10 AI-pending transactions",
  // Huy hiệu mặc định
  "Bước đầu tiên": "First step",
  "Ghi giao dịch đầu tiên": "Log your first transaction",
  "Lửa nhỏ": "Small flame",
  "Giữ chuỗi 7 ngày liên tiếp": "Keep a 7-day streak",
  "Lửa bền": "Steady flame",
  "Giữ chuỗi 30 ngày liên tiếp": "Keep a 30-day streak",
  "Lửa bất diệt": "Eternal flame",
  "Giữ chuỗi 100 ngày liên tiếp": "Keep a 100-day streak",
  "Trò chuyện cùng AI": "Chatting with AI",
  "Hỏi trợ lý AI 10 câu": "Ask the AI assistant 10 questions",
  "Người lập kế hoạch": "Planner",
  "Đặt ngân sách đủ 3 danh mục": "Set budgets for 3 categories",
  "Giữ đúng lời hứa": "Promise kept",
  "Cả tháng không danh mục nào vượt ngân sách": "A whole month with no category over budget",
  "Nhà sưu tầm": "Collector",
  "Ghi đủ 100 giao dịch": "Log 100 transactions",
  "Thầy giáo của AI": "AI's teacher",
  "Sửa phân loại của AI 20 lần": "Correct the AI's categories 20 times",
  // Danh hiệu cấp độ (shared/gamification-rules.ts)
  "Người mới ghi sổ": "Fresh bookkeeper",
  "Người ghi chép": "Note taker",
  "Người tập tiết kiệm": "Saver in training",
  "Người giữ nhịp": "Steady logger",
  "Thủ quỹ chăm chỉ": "Diligent treasurer",
  "Thủ quỹ đáng tin": "Trusted treasurer",
  // "Người lập kế hoạch" (cấp 7) trùng tên huy hiệu ở trên
  "Chuyên gia ngân sách": "Budget expert",
  "Nhà quản lý tài chính": "Finance manager",
  "Bậc thầy chi tiêu": "Spending master",
};

/** Tên/nội dung mặc định theo ngôn ngữ đang dùng; chuỗi người dùng tự đặt giữ nguyên */
export function tc(text: string): string;
export function tc(text: string | null | undefined): string | null | undefined;
export function tc(text: string | null | undefined) {
  if (!text || getActiveLocale() === "vi") return text;
  return EN[text.trim()] ?? text;
}

/** Các trường chứa tên/nội dung mặc định trong dữ liệu trả về từ service */
const LOCALIZED_KEYS = new Set(["name", "title", "condition", "levelTitle", "nextLevelTitle", "categoryName"]);

/**
 * Dịch các trường tên mặc định trong dữ liệu (đi sâu vào object/mảng). Dùng cho dữ liệu chỉ để xem;
 * trang Quản trị và form sửa cần bản gốc tiếng Việt nên không gọi hàm này.
 */
export function localizeData<T>(data: T): T {
  if (getActiveLocale() === "vi") return data;
  const walk = (value: unknown, key?: string): unknown => {
    if (typeof value === "string") return key && LOCALIZED_KEYS.has(key) ? tc(value) : value;
    if (Array.isArray(value)) return value.map((v) => walk(v));
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
    }
    return value;
  };
  return walk(data) as T;
}
