/** Truy vấn nội bộ trên mock db, có áp kịch bản (?demo=empty). Chỉ services dùng. */
import type { Badge, CategoryBreakdown, CategorySlice, MonthTotals, Transaction, TransactionView, Wallet } from "@/types";
import { emitCelebrate, type Celebration } from "../events";
import * as db from "./db";
import { getScenario } from "./scenario";

export function scopedTransactions(): Transaction[] {
  return getScenario() === "empty" ? [] : db.transactions;
}

export function scopedWallets(): Wallet[] {
  return getScenario() === "empty"
    ? db.wallets.map((w) => ({ ...w, balance: 0 }))
    : db.wallets;
}

export function toView(t: Transaction): TransactionView {
  return {
    ...t,
    category: db.categories.find((c) => c.id === t.categoryId)!,
    wallet: db.wallets.find((w) => w.id === t.walletId)!,
  };
}

// ───────────── Số liệu thống kê (dùng chung cho Tổng quan và Thống kê) ─────────────

/** Chỉ tính giao dịch đã xác nhận; giao dịch chờ duyệt chưa vào thống kê */
export function confirmedTransactions(): Transaction[] {
  return scopedTransactions().filter((t) => t.status === "confirmed");
}

export function sumTotals(list: readonly Transaction[]): MonthTotals {
  return list.reduce(
    (acc, t) => {
      acc[t.type] += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );
}

/** "2026-10", -1 → "2026-09" */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Danh sách tháng từ `from` tới `to` (tính cả hai đầu) */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 120; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

export const OTHER_COLOR = "#64748B";

/** Cơ cấu chi theo danh mục: tối đa `maxSlices` lát, quá thì gộp phần đuôi vào "Khác" (MASTER.md › Charts) */
export function buildBreakdown(expenses: readonly Transaction[], month: string, maxSlices = 5): CategoryBreakdown {
  const byCategory = new Map<string, number>();
  for (const t of expenses) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);

  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.length > maxSlices ? sorted.slice(0, maxSlices - 1) : sorted;
  const restAmount = sorted.slice(head.length).reduce((s, [, v]) => s + v, 0);

  const slices: CategorySlice[] = head.map(([id, amount]) => {
    const c = db.categories.find((x) => x.id === id)!;
    return { categoryId: id, name: c.name, color: c.color, amount, percent: (amount / total) * 100 };
  });
  if (restAmount > 0) {
    slices.push({ categoryId: null, name: "Khác", color: OTHER_COLOR, amount: restAmount, percent: (restAmount / total) * 100 });
  }
  return { month, total, slices };
}

/** Ảnh hưởng của một giao dịch lên số dư ví (thu +, chi −) */
export function applyToWallet(t: Pick<Transaction, "walletId" | "type" | "amount">, sign: 1 | -1): void {
  const wallet = db.wallets.find((w) => w.id === t.walletId);
  if (wallet) wallet.balance += sign * (t.type === "income" ? t.amount : -t.amount);
}

// ───────────── Chúc mừng → thông báo trong app ─────────────

/** Thời điểm hiện tại theo "hôm nay" của bộ dữ liệu demo + giờ thật (múi giờ +07:00) */
export function nowIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${db.MOCK_TODAY}T${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}+07:00`;
}

const CELEBRATION_LINK: Record<Celebration["kind"], string> = {
  streak: "/thanh-tich",
  badge: "/thanh-tich",
  level: "/thanh-tich",
  mission: "/",
};

/** Báo chúc mừng cho giao diện và lưu vào trung tâm thông báo (bảng notifications) */
export function celebrate(c: Celebration): void {
  db.notifications.unshift({
    id: `nt-${Date.now().toString(36)}-${db.notifications.length}`,
    userId: db.user.id,
    type: "celebration",
    title: c.xp ? `${c.title} +${c.xp} XP` : c.title,
    content: c.description,
    link: CELEBRATION_LINK[c.kind],
    isRead: false,
    createdAt: nowIso(),
  });
  emitCelebrate(c);
}

// ───────────── XP & cấp độ ─────────────

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

/** Cộng XP thô (thưởng mốc chuỗi, nhiệm vụ…) và chúc mừng nếu lên cấp */
export function addBonusXp(amount: number): void {
  if (amount <= 0) return;
  const before = levelFromXp(db.level.totalXp).level;
  db.level.totalXp += amount;
  const after = levelFromXp(db.level.totalXp).level;
  db.level.level = after;
  if (after > before) {
    celebrate({
      kind: "level",
      title: `Lên cấp ${after}!`,
      description: `Danh hiệu mới: ${db.LEVEL_TITLES[after] ?? db.LEVEL_TITLES[10]}. Bạn đang làm rất tốt.`,
      icon: "Star",
    });
  }
}

/** Bảng điểm XP có giới hạn theo ngày (PRD §6.4) */
export const XP_RULES = {
  add_transaction: { xp: 10, dailyLimit: 10 },
  review: { xp: 5, dailyLimit: 10 },
} as const;
export type XpAction = keyof typeof XP_RULES;

export interface XpAward {
  xp: number;
  /** true khi hành động này đã chạm giới hạn trong ngày → không cộng XP */
  limitReached: boolean;
  /** Số lần đã được cộng XP hôm nay cho loại hành động này (sau lần này) */
  countToday: number;
}

function syncXpDay(today: string) {
  const counts = db.session.xpCounts;
  if (counts.date !== today) {
    counts.date = today;
    counts.add_transaction = 0;
    counts.review = 0;
  }
  return counts;
}

/**
 * Cộng XP cho một hành động, tối đa `dailyLimit` lần/ngày mỗi loại (chống spam).
 * Bộ đếm reset khi sang ngày mới theo múi giờ người dùng.
 */
export function awardXp(action: XpAction, today: string = db.MOCK_TODAY): XpAward {
  const counts = syncXpDay(today);
  const rule = XP_RULES[action];
  if (counts[action] >= rule.dailyLimit) {
    return { xp: 0, limitReached: true, countToday: counts[action] };
  }
  counts[action] += 1;
  addBonusXp(rule.xp);
  return { xp: rule.xp, limitReached: false, countToday: counts[action] };
}

/** Ghi lại XP đã cộng cho một giao dịch mới (để trừ lại nếu xoá trong ngày) */
export function rememberTransactionXp(transactionId: string, xp: number, today: string = db.MOCK_TODAY): void {
  if (xp > 0) db.session.xpAwards[transactionId] = { xp, date: today };
}

/**
 * Xoá giao dịch trong cùng ngày đã ghi → trừ lại đúng XP đã cộng cho nó (PRD §13.1),
 * không để tổng XP âm, và trả lại một lượt trong giới hạn 10 lần/ngày.
 * Giao dịch ghi từ hôm trước, hoặc không được cộng XP, thì không trừ.
 * Trả về số XP thực sự đã trừ.
 */
export function revokeTransactionXp(transactionId: string, today: string = db.MOCK_TODAY): number {
  const award = db.session.xpAwards[transactionId];
  if (!award) return 0;
  delete db.session.xpAwards[transactionId];
  if (award.date !== today) return 0;
  const removed = Math.min(award.xp, db.level.totalXp);
  db.level.totalXp -= removed;
  db.level.level = levelFromXp(db.level.totalXp).level;
  const counts = syncXpDay(today);
  counts.add_transaction = Math.max(0, counts.add_transaction - 1);
  return removed;
}

// ───────────── Chuỗi ngày & nhiệm vụ ─────────────

export interface ActivityResult {
  /** Hành động đầu tiên trong ngày → chuỗi vừa tăng */
  streakIncreased: boolean;
  /** Vừa chạm mốc chuỗi (3, 7, 14, 30, 60, 100) */
  milestone: { days: number; xp: number } | null;
}

/**
 * Ghi nhận hành động hợp lệ cho chuỗi ngày (PRD §6.2: thêm giao dịch, duyệt giao dịch chờ…).
 * Lần đầu trong ngày: chuỗi +1, mỗi 7 ngày nhận 1 thẻ đóng băng (tối đa 2), chạm mốc thì
 * cộng XP thưởng và chúc mừng.
 */
export function recordActivity(actionType: "add_transaction" | "review_transaction" = "add_transaction"): ActivityResult {
  db.activityLogs.push({ id: `al-${Date.now()}-${db.activityLogs.length}`, userId: db.USER_ID, date: db.MOCK_TODAY, actionType });
  if (db.session.activeToday) return { streakIncreased: false, milestone: null };

  db.session.activeToday = true;
  db.streak.currentStreak += 1;
  db.streak.lastActiveDate = db.MOCK_TODAY;
  db.streak.longestStreak = Math.max(db.streak.longestStreak, db.streak.currentStreak);
  if (db.streak.currentStreak % 7 === 0 && db.streak.freezeCount < 2) db.streak.freezeCount += 1;
  bumpMission("m-w-5days");

  const days = db.streak.currentStreak;
  const xp = db.STREAK_MILESTONES[days];
  if (!xp) return { streakIncreased: true, milestone: null };
  addBonusXp(xp);
  celebrate({
    kind: "streak",
    title: `Chuỗi ${days} ngày!`,
    description: `Tuyệt vời! ${days} ngày liên tiếp, bạn đã có thói quen thật sự rồi.`,
    icon: "Flame",
    xp,
  });
  return { streakIncreased: true, milestone: { days, xp } };
}

/** Tăng tiến độ nhiệm vụ; hoàn thành thì cộng XP nhiệm vụ và báo chúc mừng nhẹ */
export function bumpMission(missionId: string, by = 1): void {
  const um = db.userMissions.find((m) => m.missionId === missionId);
  const mission = db.missions.find((m) => m.id === missionId);
  if (!um || !mission || um.progress >= mission.target) return;
  um.progress = Math.min(mission.target, um.progress + by);
  if (um.progress < mission.target) return;
  um.completedAt = new Date().toISOString();
  addBonusXp(mission.xp);
  celebrate({
    kind: "mission",
    title: "Hoàn thành nhiệm vụ",
    description: mission.title,
    icon: "ListChecks",
    xp: mission.xp,
  });
}

// ───────────── Huy hiệu (F14) ─────────────

export interface BadgeProgress {
  current: number;
  target: number;
}

/** Tiến độ hướng tới từng huy hiệu, tính từ dữ liệu thật */
export function badgeProgress(badge: Badge): BadgeProgress | null {
  const month = db.MOCK_TODAY.slice(0, 7);
  switch (badge.code) {
    case "FIRST_STEP":
      return { current: Math.min(1, db.transactions.length), target: 1 };
    case "FIRE_7":
      return { current: Math.min(7, db.streak.longestStreak), target: 7 };
    case "FIRE_30":
      return { current: Math.min(30, db.streak.longestStreak), target: 30 };
    case "FIRE_100":
      return { current: Math.min(100, db.streak.longestStreak), target: 100 };
    case "CHAT_10":
      return { current: Math.min(10, db.session.chatQuestions), target: 10 };
    case "PLANNER":
      return { current: Math.min(3, db.budgets.filter((b) => b.month === month).length), target: 3 };
    case "COLLECTOR":
      return { current: Math.min(100, db.transactions.length), target: 100 };
    case "AI_TEACHER":
      return { current: Math.min(20, db.session.corrections), target: 20 };
    default:
      // "Giữ đúng lời hứa" chỉ xét được khi hết tháng
      return null;
  }
}

/** Mở các huy hiệu vừa đạt điều kiện; mỗi huy hiệu mới được chúc mừng một lần */
export function evaluateBadges(): Badge[] {
  const unlocked: Badge[] = [];
  for (const badge of db.badges) {
    if (db.userBadges.some((ub) => ub.badgeId === badge.id)) continue;
    const p = badgeProgress(badge);
    if (!p || p.current < p.target) continue;
    db.userBadges.push({ userId: db.USER_ID, badgeId: badge.id, unlockedAt: new Date().toISOString() });
    unlocked.push(badge);
    celebrate({
      kind: "badge",
      title: `Mở khoá huy hiệu “${badge.name}”`,
      description: badge.condition,
      icon: badge.icon,
    });
  }
  return unlocked;
}

export { normalize } from "@/lib/text";
