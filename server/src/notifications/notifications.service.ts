import { Injectable } from "@nestjs/common";
import type { AppNotification, NotificationType } from "@shared/types";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import type { Db } from "../common/db";
import { badRequest } from "../common/errors";
import { MailService } from "../common/mail.service";
import { toNotification } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";

const TYPES: NotificationType[] = ["reminder", "celebration", "budget_alert"];

/**
 * Trung tâm thông báo trong app (PRD §6.3: kênh bắt buộc): nhắc nhở giữ chuỗi, chúc mừng,
 * cảnh báo ngân sách. Email là kênh phụ, chỉ gửi khi người dùng bật.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly mail: MailService,
  ) {}

  async list(userId: string, type?: string): Promise<AppNotification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId, ...(TYPES.includes(type as NotificationType) ? { type: type as NotificationType } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 200,
    });
    return rows.map(toNotification);
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  }

  async markAllRead(userId: string): Promise<number> {
    return (await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } })).count;
  }

  private async reminderContent(db: Db, userId: string): Promise<{ title: string; content: string }> {
    const streak = (await db.userStreak.findUnique({ where: { userId } }))?.currentStreak ?? 0;
    if (streak > 0) {
      const m = await db.motivationMessage.findFirst({ where: { context: "streak_at_risk", isActive: true }, orderBy: { createdAt: "asc" } });
      const template = m?.template ?? "Ghi 1 khoản chi để giữ chuỗi {streak} ngày nhé!";
      return { title: `Giữ chuỗi ${streak} ngày nhé`, content: template.replaceAll("{streak}", String(streak)) };
    }
    return { title: "Ghi chép hôm nay", content: "Ghi 1 khoản chi hôm nay để bắt đầu chuỗi mới nhé. Chỉ mất vài giây thôi!" };
  }

  /**
   * Tạo nhắc nhở. Có `dedupeKey` (job theo ngày) thì chạy lại không tạo thêm.
   * Trả về thông báo vừa tạo, hoặc null nếu đã có.
   */
  async pushReminder(
    user: { id: string; email: string; fullName: string; reminderEmail: boolean },
    dedupeKey?: string,
  ): Promise<AppNotification | null> {
    const { title, content } = await this.reminderContent(this.prisma, user.id);
    const data = { userId: user.id, type: "reminder" as const, title, content, link: "/", dedupeKey: dedupeKey ?? null, createdAt: this.clock.now() };
    let row;
    if (dedupeKey) {
      const created = await this.prisma.notification.createManyAndReturn({ data: [data], skipDuplicates: true });
      row = created[0];
      if (!row) return null;
    } else {
      row = await this.prisma.notification.create({ data });
    }
    if (user.reminderEmail) {
      await this.mail.send({
        to: user.email,
        subject: `Sổ Tiền: ${title}`,
        text: `Chào ${user.fullName},\n\n${content}\n\nMở Sổ Tiền để ghi nhanh một khoản nhé.\n(Tắt email nhắc nhở trong Cài đặt bất cứ lúc nào.)`,
      });
    }
    return toNotification(row);
  }

  /** Nút "Gửi thử nhắc nhở" trong Cài đặt */
  async sendTestReminder(authUser: AuthUser): Promise<AppNotification> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });
    if (!user.reminderEnabled) throw badRequest("Nhắc nhở đang tắt. Bật lại để gửi thử.");
    return (await this.pushReminder(user))!;
  }
}
