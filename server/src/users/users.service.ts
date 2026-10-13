import { Injectable } from "@nestjs/common";
import { transactionsToCsv } from "@shared/export";
import type { DataExport, ReminderSettings, User, UserSettings } from "@shared/types";
import {
  CURRENCIES,
  REMINDER_TIME_RE,
  TIMEZONES,
  cleanFullName,
  isDeleteConfirmation,
  validateEmail,
} from "@shared/validation";
import { ClockService } from "../common/clock.service";
import { AppError, badRequest } from "../common/errors";
import {
  isoDateTime,
  toBudget,
  toCategory,
  toNotification,
  toRule,
  toStreak,
  toTransaction,
  toUser,
  toWallet,
} from "../common/mappers";
import { PrismaService } from "../common/prisma.service";

/** Hồ sơ, tuỳ chọn, nhắc nhở, xuất/xoá dữ liệu (F01, PRD §8 Quyền riêng tư) */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async me(userId: string): Promise<User> {
    return toUser(await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  }

  async settings(userId: string): Promise<UserSettings> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      profile: { fullName: u.fullName, email: u.email, currency: "VND", timezone: u.timezone, createdAt: isoDateTime(u.createdAt) },
      reminder: { enabled: u.reminderEnabled, time: u.reminderTime, email: u.reminderEmail },
    };
  }

  async updateProfile(userId: string, input: { fullName: string; email: string }): Promise<User> {
    const fullName = cleanFullName(input.fullName ?? "");
    if (!fullName) throw badRequest("Nhập họ tên của bạn", "fullName");
    const emailError = validateEmail(input.email ?? "");
    if (emailError) throw badRequest(emailError, "email");
    const email = input.email.trim().toLowerCase();
    const owner = await this.prisma.user.findUnique({ where: { email } });
    if (owner && owner.id !== userId) throw new AppError(409, "Email này đã được tài khoản khác sử dụng", { field: "email" });
    return toUser(await this.prisma.user.update({ where: { id: userId }, data: { fullName, email } }));
  }

  async updatePreferences(userId: string, input: { currency: string; timezone: string }): Promise<void> {
    if (!CURRENCIES.some((c) => c.code === input.currency && c.available)) throw badRequest("Đơn vị tiền tệ này chưa được hỗ trợ.", "currency");
    if (!TIMEZONES.some((t) => t.id === input.timezone)) throw badRequest("Múi giờ không hợp lệ.", "timezone");
    await this.prisma.user.update({ where: { id: userId }, data: { currency: "VND", timezone: input.timezone } });
  }

  async updateReminder(userId: string, input: ReminderSettings): Promise<ReminderSettings> {
    if (!REMINDER_TIME_RE.test(input.time ?? "")) throw badRequest("Giờ nhắc cần dạng HH:mm, ví dụ 20:00.", "time");
    const u = await this.prisma.user.update({
      where: { id: userId },
      data: { reminderEnabled: !!input.enabled, reminderTime: input.time, reminderEmail: !!input.email },
    });
    return { enabled: u.reminderEnabled, time: u.reminderTime, email: u.reminderEmail };
  }

  async exportAll(userId: string): Promise<DataExport> {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        wallets: { orderBy: { createdAt: "asc" } },
        transactions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
        budgets: true,
        classificationRules: true,
        streak: true,
        level: true,
        userBadges: true,
        notifications: { orderBy: { createdAt: "desc" } },
      },
    });
    // Gồm cả danh mục mặc định để file xuất tự đọc được tên danh mục
    const categories = await this.prisma.category.findMany({ where: { OR: [{ userId: null }, { userId }] } });
    return {
      exportedAt: isoDateTime(this.clock.now()),
      user: toUser(u),
      wallets: u.wallets.map(toWallet),
      categories: categories.map(toCategory),
      transactions: u.transactions.map(toTransaction),
      budgets: u.budgets.map(toBudget),
      classificationRules: u.classificationRules.map(toRule),
      gamification: {
        streak: toStreak(u.streak, userId),
        level: { userId, totalXp: u.level?.totalXp ?? 0, level: u.level?.level ?? 1 },
        badges: u.userBadges.map((b) => ({ userId, badgeId: b.badgeId, unlockedAt: isoDateTime(b.unlockedAt) })),
      },
      notifications: u.notifications.map(toNotification),
    };
  }

  async exportCsv(userId: string): Promise<string> {
    return transactionsToCsv(await this.exportAll(userId));
  }

  /** Xoá toàn bộ dữ liệu, giữ tài khoản (sổ trống với một ví Tiền mặt). Không hoàn tác được. */
  async deleteAllData(userId: string, confirmation: string): Promise<void> {
    if (!isDeleteConfirmation(confirmation ?? "")) throw badRequest("Gõ đúng XOÁ DỮ LIỆU để xác nhận.", "confirmation");
    await this.prisma.$transaction(async (db) => {
      const where = { userId };
      await db.transaction.deleteMany({ where });
      await db.walletTransfer.deleteMany({ where });
      await db.budget.deleteMany({ where });
      await db.classificationRule.deleteMany({ where });
      await db.conversation.deleteMany({ where });
      await db.activityLog.deleteMany({ where });
      await db.freezeUsage.deleteMany({ where });
      await db.userMission.deleteMany({ where });
      await db.userBadge.deleteMany({ where });
      await db.notification.deleteMany({ where });
      await db.motivationHistory.deleteMany({ where });
      await db.wallet.deleteMany({ where });
      await db.category.deleteMany({ where });
      await db.userStreak.upsert({
        where,
        create: { userId },
        update: { currentStreak: 0, longestStreak: 0, lastActiveDate: null, freezeCount: 0, settledDate: null },
      });
      await db.userLevel.upsert({ where, create: { userId }, update: { totalXp: 0, level: 1, aiCorrections: 0 } });
      await db.wallet.create({ data: { userId, name: "Tiền mặt", type: "cash" } });
    });
  }
}
