import type { DataExport, ReminderSettings, User, UserSettings } from "@/types";
import * as db from "./mock/db";
import { findAccountByEmail } from "./mock/accounts";
import { clearCurrentDataset } from "./mock/dataset";
import { nowIso } from "./mock/queries";
import { failIfErrorScenario, simulateLatency } from "./mock/scenario";
import { AuthError, syncAccountProfile, validateEmail } from "./auth.service";
import { emitDataChanged } from "./events";
import { normalize } from "@/lib/text";

/** Cụm từ người dùng phải gõ để xác nhận xoá */
export const DELETE_PHRASE = "XOÁ DỮ LIỆU";

/** Đơn vị tiền tệ (F01). Bản demo mới hỗ trợ VND; các loại khác hiện "sắp có" thay vì giả vờ chạy. */
export const CURRENCIES = [
  { code: "VND", label: "Việt Nam đồng (đ)", available: true },
  { code: "USD", label: "Đô la Mỹ ($)", available: false },
  { code: "EUR", label: "Euro (€)", available: false },
] as const;

/** Múi giờ dùng để tính "một ngày" cho chuỗi ghi chép (PRD §6.2) */
export const TIMEZONES = [
  { id: "Asia/Ho_Chi_Minh", label: "Việt Nam (UTC+7)" },
  { id: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { id: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { id: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { id: "Asia/Seoul", label: "Seoul (UTC+9)" },
  { id: "Australia/Sydney", label: "Sydney (UTC+10/+11)" },
  { id: "Europe/London", label: "London (UTC+0/+1)" },
  { id: "Europe/Berlin", label: "Berlin (UTC+1/+2)" },
  { id: "America/New_York", label: "New York (UTC−5/−4)" },
  { id: "America/Los_Angeles", label: "Los Angeles (UTC−8/−7)" },
] as const;

export const DEFAULT_REMINDER_TIME = "20:00";

export async function getSettings(): Promise<UserSettings> {
  await simulateLatency(350);
  failIfErrorScenario();
  const { fullName, email, currency, timezone, createdAt } = db.user;
  return { profile: { fullName, email, currency, timezone, createdAt }, reminder: { ...db.reminderSettings } };
}

export async function updateProfile(input: { fullName: string; email: string }): Promise<User> {
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
  await simulateLatency(400);
  if (!CURRENCIES.some((c) => c.code === input.currency && c.available)) throw new Error("Đơn vị tiền tệ này chưa được hỗ trợ.");
  if (!TIMEZONES.some((t) => t.id === input.timezone)) throw new Error("Múi giờ không hợp lệ.");
  Object.assign(db.user, { currency: input.currency, timezone: input.timezone });
  syncAccountProfile({ currency: "VND", timezone: input.timezone });
  emitDataChanged();
}

export async function updateReminder(input: ReminderSettings): Promise<ReminderSettings> {
  await simulateLatency(300);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error("Giờ nhắc cần dạng HH:mm, ví dụ 20:00.");
  Object.assign(db.reminderSettings, input);
  emitDataChanged();
  return { ...db.reminderSettings };
}

/** Xuất toàn bộ dữ liệu của người dùng (PRD §8 Quyền riêng tư) */
export async function exportAllData(): Promise<DataExport> {
  await simulateLatency(600);
  failIfErrorScenario();
  return structuredClone({
    exportedAt: nowIso(),
    user: db.user,
    wallets: db.wallets,
    categories: db.categories.filter((c) => c.userId !== null),
    transactions: db.transactions,
    budgets: db.budgets,
    classificationRules: db.classificationRules,
    gamification: { streak: db.streak, level: db.level, badges: db.userBadges },
    notifications: db.notifications,
  });
}

/** CSV giao dịch (mở được bằng Excel: UTF-8 có BOM, dấu phẩy, ngày dd/MM/yyyy) */
export function transactionsToCsv(data: DataExport): string {
  const cat = new Map(db.categories.map((c) => [c.id, c.name]));
  const wallet = new Map(data.wallets.map((w) => [w.id, w.name]));
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [...data.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => {
      const [y, m, d] = t.date.split("-");
      return [
        `${d}/${m}/${y}`,
        q(t.description),
        q(cat.get(t.categoryId) ?? ""),
        q(wallet.get(t.walletId) ?? ""),
        t.type === "income" ? "Thu" : "Chi",
        String(t.type === "income" ? t.amount : -t.amount),
        t.status === "pending" ? "Chờ duyệt" : "Đã xác nhận",
      ].join(",");
    });
  return `﻿${["Ngày,Nội dung,Danh mục,Ví,Loại,Số tiền,Trạng thái", ...rows].join("\r\n")}`;
}

/** Xoá toàn bộ dữ liệu, giữ lại tài khoản để dùng tiếp. Không hoàn tác được. */
export async function deleteAllData(confirmation: string): Promise<void> {
  await simulateLatency(800);
  failIfErrorScenario();
  // Chấp nhận cả "XOÁ" lẫn "XÓA", có/không dấu
  if (normalize(confirmation).replace(/\s+/g, " ").trim() !== "xoa du lieu") throw new Error("Gõ đúng XOÁ DỮ LIỆU để xác nhận.");
  clearCurrentDataset();
  emitDataChanged();
}
