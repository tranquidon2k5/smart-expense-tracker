/** Quy tắc gamification (PRD §6) — dùng chung cho mock frontend và backend */
import { addDays } from "./dates";

export const LEVEL_TITLES: Record<number, string> = {
  1: "Người mới ghi sổ",
  2: "Người ghi chép",
  3: "Người tập tiết kiệm",
  4: "Người giữ nhịp",
  5: "Thủ quỹ chăm chỉ",
  6: "Thủ quỹ đáng tin",
  7: "Người lập kế hoạch",
  8: "Chuyên gia ngân sách",
  9: "Nhà quản lý tài chính",
  10: "Bậc thầy chi tiêu",
};

export function levelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? LEVEL_TITLES[10];
}

/** Mốc chuỗi → XP thưởng (PRD §6.2, §6.4) */
export const STREAK_MILESTONES: Record<number, number> = { 3: 50, 7: 100, 14: 150, 30: 300, 60: 400, 100: 500 };

/** Thẻ đóng băng: nhận 1 thẻ mỗi 7 ngày chuỗi, giữ tối đa 2 */
export const FREEZE_EVERY_DAYS = 7;
export const FREEZE_MAX = 2;

/** Bảng điểm XP có giới hạn theo ngày (PRD §6.4) */
export const XP_RULES = {
  add_transaction: { xp: 10, dailyLimit: 10 },
  review: { xp: 5, dailyLimit: 10 },
} as const;
export type XpAction = keyof typeof XP_RULES;

/** XP cần để lên cấp n = 100 × n (PRD §6.4) */
export function levelFromXp(totalXp: number) {
  let level = 1;
  let floor = 0;
  while (totalXp >= floor + 100 * (level + 1)) {
    floor += 100 * (level + 1);
    level += 1;
  }
  return { level, xpInLevel: totalXp - floor, xpForNextLevel: 100 * (level + 1) };
}

/**
 * Tính chuỗi hiện tại và kỷ lục từ nhật ký: ngày có hoạt động +1, ngày đóng băng giữ nguyên,
 * ngày trống làm chuỗi về 0. Chuỗi hiện tại tính đến `until` (hôm qua nếu hôm nay chưa ghi).
 */
export function computeStreaks(activeDates: Set<string>, frozenDates: Set<string>, from: string, until: string) {
  let current = 0;
  let longest = 0;
  for (let d = from; d <= until; d = addDays(d, 1)) {
    if (activeDates.has(d)) current += 1;
    else if (!frozenDates.has(d)) current = 0;
    longest = Math.max(longest, current);
  }
  return { current, longest };
}

/** Mốc chuỗi kế tiếp sau `current` ngày */
export function nextMilestone(current: number): { days: number; xp: number; remaining: number } | null {
  const days = Object.keys(STREAK_MILESTONES)
    .map(Number)
    .find((d) => d > current);
  return days ? { days, xp: STREAK_MILESTONES[days], remaining: days - current } : null;
}

/** Chèn biến vào câu khích lệ (PRD §6.3) */
export function fillTemplate(
  template: string,
  vars: { name?: string; streak?: number; longest?: number; amount?: string },
): string {
  return template
    .replaceAll("{name}", vars.name ?? "")
    .replaceAll("{streak}", String(vars.streak ?? 0))
    .replaceAll("{longest}", String(vars.longest ?? 0))
    .replaceAll("{amount}", vars.amount ?? "");
}

/** Tên gọi trong câu khích lệ: tên cuối của họ tên Việt Nam */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/).at(-1) ?? "";
}
