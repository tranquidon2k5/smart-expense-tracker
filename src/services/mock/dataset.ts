/**
 * Bản demo chỉ có một "kho" dữ liệu trong bộ nhớ. Mỗi lần đăng nhập, kho được nạp lại cho
 * đúng tài khoản: Lan → dữ liệu mẫu; tài khoản khác → sổ trống (1 ví Tiền mặt).
 * Cùng cơ chế dùng cho "Xoá toàn bộ dữ liệu" trong Cài đặt.
 * Bản thật: mỗi truy vấn backend lọc theo user_id lấy từ JWT, không cần bước này.
 */
import type { User } from "@/types";
import * as db from "./db";
import { getStoredSession } from "./session-store";
import { findAccount } from "./accounts";

/** Ai đang sở hữu kho dữ liệu; `version` tăng mỗi lần nạp lại (cache phụ như hội thoại AI tự làm mới) */
export const dataset = { ownerId: db.USER_ID, version: 0 };

const mutable = {
  wallets: db.wallets,
  categories: db.categories,
  transactions: db.transactions,
  transfers: db.transfers,
  classificationRules: db.classificationRules,
  budgets: db.budgets,
  activityLogs: db.activityLogs,
  freezeDays: db.freezeDays,
  userMissions: db.userMissions,
  userBadges: db.userBadges,
  notifications: db.notifications,
};
type ArrayKey = keyof typeof mutable;

const seed = structuredClone({
  ...mutable,
  user: db.user,
  streak: db.streak,
  level: db.level,
  session: db.session,
  reminderSettings: db.reminderSettings,
});

function replaceArray<K extends ArrayKey>(key: K, items: (typeof mutable)[K]) {
  const target = mutable[key] as unknown[];
  target.splice(0, target.length, ...structuredClone(items as unknown[]));
}

function resetSession() {
  Object.assign(db.session, structuredClone(seed.session), {
    activeToday: false,
    chatQuestions: 0,
    corrections: 0,
    lastReminderDate: null,
    xpAwards: {},
    xpCounts: { date: db.MOCK_TODAY, add_transaction: 0, review: 0 },
  });
}

/** Xoá sạch dữ liệu tài chính và thành tích, giữ hồ sơ và cài đặt */
function emptyAll(userId: string) {
  replaceArray("wallets", [{ id: "w-cash", userId, name: "Tiền mặt", type: "cash", balance: 0 }]);
  setUserCategories([]);
  for (const key of ["transactions", "transfers", "classificationRules", "budgets", "activityLogs", "freezeDays", "userBadges", "notifications"] as const) {
    replaceArray(key, []);
  }
  replaceArray(
    "userMissions",
    seed.userMissions.map((m) => ({ ...m, userId, progress: 0, completedAt: null })),
  );
  Object.assign(db.streak, { userId, currentStreak: 0, longestStreak: 0, lastActiveDate: null, freezeCount: 0 });
  Object.assign(db.level, { userId, totalXp: 0, level: 1 });
  resetSession();
}

/**
 * Danh mục mặc định (userId = null) là dữ liệu chung do admin quản lý → giữ nguyên khi đổi tài khoản;
 * chỉ thay phần danh mục riêng của người dùng.
 */
function setUserCategories(own: typeof seed.categories) {
  const defaults = db.categories.filter((c) => c.userId === null);
  replaceArray("categories", [...structuredClone(defaults), ...own]);
}

/** Số giao dịch đang dùng một danh mục, tính trên mọi bộ dữ liệu (mẫu + đang nạp) */
export function categoryUsage(categoryId: string): number {
  const count = (list: readonly { categoryId: string }[]) => list.filter((t) => t.categoryId === categoryId).length;
  // Đang nạp sổ của Lan → đếm trên dữ liệu hiện tại (đã gồm thay đổi mới); tài khoản khác → cộng thêm sổ mẫu của Lan
  return dataset.ownerId === db.USER_ID ? count(db.transactions) : count(seed.transactions) + count(db.transactions);
}

function restoreSeed() {
  for (const key of Object.keys(mutable) as ArrayKey[]) if (key !== "categories") replaceArray(key, seed[key]);
  setUserCategories(seed.categories.filter((c) => c.userId !== null));
  Object.assign(db.streak, structuredClone(seed.streak));
  Object.assign(db.level, structuredClone(seed.level));
  Object.assign(db.session, structuredClone(seed.session));
}

/** Nạp kho dữ liệu cho tài khoản vừa đăng nhập */
export function loadDatasetFor(user: User): void {
  if (user.id === db.USER_ID) restoreSeed();
  else emptyAll(user.id);
  Object.assign(db.user, structuredClone(user));
  Object.assign(db.reminderSettings, structuredClone(seed.reminderSettings));
  dataset.ownerId = user.id;
  dataset.version += 1;
}

/** "Xoá toàn bộ dữ liệu" (PRD §8 Quyền riêng tư): giữ tài khoản, xoá mọi dữ liệu của người dùng */
export function clearCurrentDataset(): void {
  emptyAll(dataset.ownerId);
  dataset.version += 1;
}

// Tải lại trang khi đang đăng nhập tài khoản khác Lan → nạp ngay sổ của tài khoản đó
if (typeof window !== "undefined") {
  const s = getStoredSession();
  const account = s ? findAccount(s.userId) : undefined;
  if (account && account.user.id !== db.USER_ID) loadDatasetFor(account.user);
}
