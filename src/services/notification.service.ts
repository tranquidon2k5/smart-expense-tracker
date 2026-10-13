import type { AppNotification, NotificationType } from "@/types";
import * as db from "./mock/db";
import { nowIso } from "./mock/queries";
import { failIfErrorScenario, getScenario, simulateLatency } from "./mock/scenario";
import { emitDataChanged } from "./events";
import { USE_API } from "./data-source";
import * as api from "./api/endpoints";

/**
 * Trung tâm thông báo trong app (PRD §6.3: kênh bắt buộc). Gồm nhắc nhở giữ chuỗi,
 * chúc mừng thành tích và cảnh báo ngân sách. Mới nhất trước.
 */

function scoped(): AppNotification[] {
  return getScenario() === "empty" ? [] : db.notifications;
}

export async function listNotifications(type?: NotificationType): Promise<AppNotification[]> {
  if (USE_API) return api.notifications.listNotifications(type);
  await simulateLatency(300);
  failIfErrorScenario();
  return scoped()
    .filter((n) => !type || n.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getUnreadCount(): Promise<number> {
  if (USE_API) return api.notifications.getUnreadCount();
  await simulateLatency(150);
  return scoped().filter((n) => !n.isRead).length;
}

export async function markRead(id: string): Promise<void> {
  if (USE_API) return api.notifications.markRead(id);
  await simulateLatency(120);
  const n = db.notifications.find((x) => x.id === id);
  if (n && !n.isRead) {
    n.isRead = true;
    emitDataChanged();
  }
}

export async function markAllRead(): Promise<number> {
  if (USE_API) return api.notifications.markAllRead();
  await simulateLatency(200);
  const unread = db.notifications.filter((n) => !n.isRead);
  unread.forEach((n) => (n.isRead = true));
  if (unread.length) emitDataChanged();
  return unread.length;
}

function reminderContent(): { title: string; content: string } {
  const streak = db.streak.currentStreak;
  if (streak > 0) {
    const template =
      db.motivationMessages.find((m) => m.context === "streak_at_risk" && m.isActive)?.template ??
      "Ghi 1 khoản chi để giữ chuỗi {streak} ngày nhé!";
    return { title: `Giữ chuỗi ${streak} ngày nhé`, content: template.replace("{streak}", String(streak)) };
  }
  return { title: "Ghi chép hôm nay", content: "Ghi 1 khoản chi hôm nay để bắt đầu chuỗi mới nhé. Chỉ mất vài giây thôi!" };
}

function pushReminder(): AppNotification {
  const n: AppNotification = {
    id: `nt-r-${Date.now().toString(36)}`,
    userId: db.user.id,
    type: "reminder",
    ...reminderContent(),
    link: "/",
    isRead: false,
    createdAt: nowIso(),
  };
  db.notifications.unshift(n);
  emitDataChanged();
  return n;
}

/**
 * Bộ hẹn giờ nhắc nhở (bản thật: job định kỳ ở backend, PRD §9). Tạo đúng 1 nhắc nhở mỗi ngày
 * khi đã qua giờ nhắc mà hôm nay chưa ghi chép. Tắt nhắc nhở → không bao giờ tạo.
 */
export function runReminderSchedule(now: Date = new Date()): AppNotification | null {
  // Bản api: job định kỳ ở backend tạo nhắc nhở (xem server/src/notifications/jobs.service.ts)
  if (USE_API) return null;
  const s = db.reminderSettings;
  if (!s.enabled || getScenario() === "empty") return null;
  if (db.session.activeToday || db.session.lastReminderDate === db.MOCK_TODAY) return null;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (hhmm < s.time) return null;
  db.session.lastReminderDate = db.MOCK_TODAY;
  return pushReminder();
}

/** Nút "Gửi thử nhắc nhở" trong Cài đặt — để xem nhắc nhở trông thế nào mà không phải chờ tới giờ */
export async function sendTestReminder(): Promise<AppNotification> {
  if (USE_API) return api.notifications.sendTestReminder();
  await simulateLatency(300);
  if (!db.reminderSettings.enabled) throw new Error("Nhắc nhở đang tắt. Bật lại để gửi thử.");
  return pushReminder();
}
