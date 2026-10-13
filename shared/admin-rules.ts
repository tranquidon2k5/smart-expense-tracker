/** Quy tắc trang quản trị (F15) — giao diện và backend kiểm tra giống nhau */
import type { MissionPeriod, MotivationContext } from "./types";

export const AI_FEATURE_LABEL = { extract: "Trích xuất câu", classify: "Phân loại", chat: "Trợ lý AI", motivation: "Câu khích lệ" } as const;

export const MOTIVATION_CONTEXTS: { value: MotivationContext; label: string; when: string }[] = [
  { value: "morning", label: "Chào buổi sáng", when: "Lần đăng nhập đầu tiên trong ngày" },
  { value: "after_transaction", label: "Sau khi ghi giao dịch", when: "Ngay khi lưu thành công" },
  { value: "streak_at_risk", label: "Sắp mất chuỗi", when: "Giờ nhắc (mặc định 20:00) nếu hôm nay chưa ghi" },
  { value: "streak_milestone", label: "Đạt mốc chuỗi", when: "Khi chạm mốc 3, 7, 14, 30…" },
  { value: "streak_lost", label: "Mất chuỗi", when: "Lần đăng nhập sau khi mất chuỗi" },
  { value: "welcome_back", label: "Quay lại sau thời gian dài", when: "Không đăng nhập từ 7 ngày" },
  { value: "budget_good", label: "Ngân sách tốt", when: "Cuối tuần, chi dưới 80% ngân sách" },
  { value: "first_day", label: "Ngày đầu tiên", when: "Tài khoản mới, chưa có giao dịch" },
];

/** Biến được phép chèn vào câu (PRD §6.3) */
export const MOTIVATION_VARIABLES = [
  { key: "{name}", label: "Tên", sample: "Lan" },
  { key: "{streak}", label: "Số ngày chuỗi", sample: "12" },
  { key: "{longest}", label: "Kỷ lục chuỗi", sample: "15" },
  { key: "{amount}", label: "Số tiền", sample: "45.000đ" },
] as const;

export function unknownVariables(template: string): string[] {
  const allowed = new Set<string>(MOTIVATION_VARIABLES.map((v) => v.key));
  return [...new Set(template.match(/\{[^}]*\}/g) ?? [])].filter((v) => !allowed.has(v));
}

export function previewTemplate(template: string): string {
  return MOTIVATION_VARIABLES.reduce((s, v) => s.split(v.key).join(v.sample), template);
}

/** Kiểm tra nhiệm vụ; trả câu lỗi tiếng Việt hoặc null */
export function missionError(input: { title: string; period: MissionPeriod; target: number; xp: number }): string | null {
  const title = input.title.trim();
  if (title.length < 5) return "Tên nhiệm vụ cần ít nhất 5 ký tự.";
  if (title.length > 80) return "Tên nhiệm vụ tối đa 80 ký tự.";
  if (!Number.isInteger(input.target) || input.target < 1 || input.target > 100) return "Mục tiêu là số nguyên từ 1 đến 100.";
  // Giới hạn XP theo PRD §6.4: nhiệm vụ ngày ~20 XP, tuần ~100 XP
  const maxXp = input.period === "daily" ? 50 : 200;
  if (!Number.isInteger(input.xp) || input.xp < 5 || input.xp > maxXp) {
    return `XP của nhiệm vụ ${input.period === "daily" ? "ngày" : "tuần"} trong khoảng 5–${maxXp}.`;
  }
  return null;
}

/** Mã nhiệm vụ từ tên: "Ghi 3 giao dịch" → "GHI_3_GIAO_DICH" */
export function missionCode(source: string): string {
  return source
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
}

/** Kiểm tra câu khích lệ; trả câu lỗi hoặc null */
export function motivationError(template: string): string | null {
  const t = template.trim();
  if (t.length < 10) return "Câu khích lệ cần ít nhất 10 ký tự.";
  if (t.length > 200) return "Câu khích lệ tối đa 200 ký tự để hiển thị gọn.";
  const bad = unknownVariables(t);
  return bad.length ? `Biến không hỗ trợ: ${bad.join(", ")}.` : null;
}
