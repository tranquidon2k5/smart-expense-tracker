import type { DataExport, ReminderSettings, User, UserSettings } from "@/types";
import * as db from "./mock/db";
import { findAccountByEmail } from "./mock/accounts";
import { clearCurrentDataset } from "./mock/dataset";
import { nowIso } from "./mock/queries";
import { failIfErrorScenario, simulateLatency } from "./mock/scenario";
import { AuthError, syncAccountProfile, validateEmail } from "./auth.service";
import { emitDataChanged } from "./events";
import { transactionsToCsv } from "@shared/export";
import { CURRENCIES, DELETE_PHRASE, REMINDER_TIME_RE, TIMEZONES, isDeleteConfirmation } from "@shared/validation";
import { USE_API } from "./data-source";
import * as api from "./api/endpoints";

export { CURRENCIES, DELETE_PHRASE, TIMEZONES };

export const DEFAULT_REMINDER_TIME = "20:00";

export async function getSettings(): Promise<UserSettings> {
  if (USE_API) return api.settings.getSettings();
  await simulateLatency(350);
  failIfErrorScenario();
  const { fullName, email, currency, timezone, createdAt } = db.user;
  return { profile: { fullName, email, currency, timezone, createdAt }, reminder: { ...db.reminderSettings } };
}

export async function updateProfile(input: { fullName: string; email: string }): Promise<User> {
  if (USE_API) return api.settings.updateProfile(input);
  await simulateLatency(500);
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2) throw new AuthError("Nhập họ tên của bạn", "fullName");
  const emailError = validateEmail(input.email);
  if (emailError) throw new AuthError(emailError, "email");
  const email = input.email.trim().toLowerCase();
  const owner = findAccountByEmail(email);
  if (owner && owner.user.id !== db.user.id) throw new AuthError("Email này đã được tài khoản khác sử dụng", "email");
  Object.assign(db.user, { fullName, email });
  syncAccountProfile({ fullName, email });
  emitDataChanged();
  return { ...db.user };
}

export async function updatePreferences(input: { currency: string; timezone: string }): Promise<void> {
  if (USE_API) return api.settings.updatePreferences(input);
  await simulateLatency(400);
  if (!CURRENCIES.some((c) => c.code === input.currency && c.available)) throw new Error("Đơn vị tiền tệ này chưa được hỗ trợ.");
  if (!TIMEZONES.some((t) => t.id === input.timezone)) throw new Error("Múi giờ không hợp lệ.");
  Object.assign(db.user, { currency: input.currency, timezone: input.timezone });
  syncAccountProfile({ currency: "VND", timezone: input.timezone });
  emitDataChanged();
}

export async function updateReminder(input: ReminderSettings): Promise<ReminderSettings> {
  if (USE_API) return api.settings.updateReminder(input);
  await simulateLatency(300);
  if (!REMINDER_TIME_RE.test(input.time)) throw new Error("Giờ nhắc cần dạng HH:mm, ví dụ 20:00.");
  Object.assign(db.reminderSettings, input);
  emitDataChanged();
  return { ...db.reminderSettings };
}

/** Xuất toàn bộ dữ liệu của người dùng (PRD §8 Quyền riêng tư) */
export async function exportAllData(): Promise<DataExport> {
  if (USE_API) return api.settings.exportAllData();
  await simulateLatency(600);
  failIfErrorScenario();
  return structuredClone({
    exportedAt: nowIso(),
    user: db.user,
    wallets: db.wallets,
    // Gồm cả danh mục mặc định để file xuất tự đọc được tên danh mục
    categories: db.categories,
    transactions: db.transactions,
    budgets: db.budgets,
    classificationRules: db.classificationRules,
    gamification: { streak: db.streak, level: db.level, badges: db.userBadges },
    notifications: db.notifications,
  });
}

export { transactionsToCsv };

/** Xoá toàn bộ dữ liệu, giữ lại tài khoản để dùng tiếp. Không hoàn tác được. */
export async function deleteAllData(confirmation: string): Promise<void> {
  if (USE_API) return api.settings.deleteAllData(confirmation);
  await simulateLatency(800);
  failIfErrorScenario();
  // Chấp nhận cả "XOÁ" lẫn "XÓA", có/không dấu
  if (!isDeleteConfirmation(confirmation)) throw new Error("Gõ đúng XOÁ DỮ LIỆU để xác nhận.");
  clearCurrentDataset();
  emitDataChanged();
}
