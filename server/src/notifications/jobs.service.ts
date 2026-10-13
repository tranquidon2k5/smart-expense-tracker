import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Client } from "pg";
import { isoWeekKey, timeIn, todayIn, weekday } from "@shared/dates";
import { shiftMonth } from "@shared/stats";
import { ClockService } from "../common/clock.service";
import { AppConfig } from "../common/config";
import { dbDate, money } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { GamificationService, STREAK_ACTIONS } from "../gamification/gamification.service";
import { nextMonthStart } from "../transactions/transactions.service";
import { NotificationsService } from "./notifications.service";

/** Khoá advisory của Postgres: nhiều instance API cùng chạy thì chỉ một instance xử lý job */
const JOB_LOCK_KEY = 2026_1012;

export interface JobReport {
  users: number;
  reminders: number;
  settled: number;
  budgetGood: number;
  keepPromise: number;
  skipped?: "locked";
}

/**
 * Job định kỳ (mỗi 15 phút), xử lý theo múi giờ của từng người dùng:
 * - chốt các ngày đã qua (thẻ đóng băng / mất chuỗi), chuẩn bị nhiệm vụ ngày & tuần mới;
 * - tới giờ nhắc mà hôm nay chưa ghi → một nhắc nhở (tối đa một lần/ngày), email nếu bật;
 * - Chủ nhật tối, chi dưới 80% ngân sách → câu "Ngân sách tốt";
 * - sang tháng mới: xét huy hiệu "Giữ đúng lời hứa" cho tháng trước.
 * Mọi bước đều khoá theo ngày/tuần/tháng nên chạy lại nhiều lần vẫn ra cùng kết quả.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger("Jobs");

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly config: AppConfig,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron("0 */15 * * * *")
  async tick() {
    if (!this.config.get("JOBS_ENABLED")) return;
    try {
      const r = await this.runAll(this.clock.now());
      if (r.reminders || r.settled || r.budgetGood || r.keepPromise) this.logger.log(JSON.stringify(r));
    } catch (error) {
      this.logger.error(`Job lỗi: ${(error as Error).stack}`);
    }
  }

  async runAll(now: Date): Promise<JobReport> {
    const report: JobReport = { users: 0, reminders: 0, settled: 0, budgetGood: 0, keepPromise: 0 };
    // Khoá phiên phải giữ trên MỘT kết nối → dùng client riêng thay vì pool của Prisma
    const lock = new Client({ connectionString: this.config.get("DATABASE_URL") });
    await lock.connect();
    try {
      const { rows } = await lock.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [JOB_LOCK_KEY]);
      if (!rows[0]?.locked) return { ...report, skipped: "locked" };
      const users = await this.prisma.user.findMany({
        where: { role: "user", isLocked: false },
        select: { id: true, email: true, fullName: true, timezone: true, reminderEnabled: true, reminderTime: true, reminderEmail: true },
      });
      for (const user of users) {
        report.users += 1;
        await this.runForUser(user, now, report);
      }
      await lock.query("SELECT pg_advisory_unlock($1)", [JOB_LOCK_KEY]);
    } finally {
      await lock.end();
    }
    return report;
  }

  private async runForUser(
    user: { id: string; email: string; fullName: string; timezone: string; reminderEnabled: boolean; reminderTime: string; reminderEmail: boolean },
    now: Date,
    report: JobReport,
  ) {
    const today = todayIn(user.timezone, now);
    const time = timeIn(user.timezone, now);

    // 1. Chốt ngày hôm qua (và các ngày trước nếu job bị lỡ)
    const settled = await this.prisma.$transaction((db) => this.gamification.settle(db, user.id, today));
    if (settled.frozen.length || settled.lost) report.settled += 1;

    // 2. Nhiệm vụ ngày + tuần của kỳ hiện tại (thứ Hai sang tuần mới → kỳ tuần mới)
    const missions = await this.prisma.mission.findMany({ where: { isActive: true } });
    await this.prisma.userMission.createMany({
      data: missions.map((m) => ({ userId: user.id, missionId: m.id, periodKey: m.period === "daily" ? today : isoWeekKey(today) })),
      skipDuplicates: true,
    });

    // 3. Nhắc nhở giữ chuỗi
    if (user.reminderEnabled && time >= user.reminderTime) {
      const active = await this.prisma.activityLog.count({
        where: { userId: user.id, date: dbDate(today), actionType: { in: [...STREAK_ACTIONS] } },
      });
      if (!active && (await this.notifications.pushReminder(user, `reminder:${today}`))) report.reminders += 1;
    }

    // 4. Cuối tuần (Chủ nhật từ 20:00): chi dưới 80% tổng hạn mức → "Ngân sách tốt"
    if (weekday(today) === 0 && time >= "20:00" && (await this.budgetGood(user.id, today))) report.budgetGood += 1;

    // 5. Tháng mới: "Giữ đúng lời hứa" nếu cả tháng trước không danh mục nào vượt ngân sách
    if (await this.keepPromise(user.id, today)) report.keepPromise += 1;
  }

  private async monthUsage(userId: string, month: string) {
    const [budgets, spent] = await Promise.all([
      this.prisma.budget.findMany({ where: { userId, month } }),
      this.prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId, status: "confirmed", type: "expense", date: { gte: dbDate(`${month}-01`), lt: dbDate(nextMonthStart(month)) } },
        _sum: { amount: true },
      }),
    ]);
    return budgets.map((b) => ({
      limit: money(b.limitAmount),
      spent: money(spent.find((s) => s.categoryId === b.categoryId)?._sum.amount),
    }));
  }

  private async budgetGood(userId: string, today: string): Promise<boolean> {
    const rows = await this.monthUsage(userId, today.slice(0, 7));
    const limit = rows.reduce((s, r) => s + r.limit, 0);
    const spent = rows.reduce((s, r) => s + r.spent, 0);
    if (!limit || spent / limit >= 0.8) return false;
    const m = await this.prisma.motivationMessage.findFirst({ where: { context: "budget_good", isActive: true }, orderBy: { createdAt: "asc" } });
    const created = await this.prisma.notification.createMany({
      data: [
        {
          userId,
          type: "celebration",
          title: "Ngân sách tốt",
          content: m?.template ?? "Tuần này bạn chi đúng kế hoạch, giỏi lắm!",
          link: "/ngan-sach",
          dedupeKey: `budget_good:${isoWeekKey(today)}`,
          createdAt: this.clock.now(),
        },
      ],
      skipDuplicates: true,
    });
    return created.count > 0;
  }

  private async keepPromise(userId: string, today: string): Promise<boolean> {
    const badge = await this.prisma.badge.findUnique({ where: { code: "KEEP_PROMISE" } });
    if (!badge?.isActive) return false;
    if (await this.prisma.userBadge.findUnique({ where: { userId_badgeId: { userId, badgeId: badge.id } } })) return false;
    const prev = shiftMonth(today.slice(0, 7), -1);
    const rows = await this.monthUsage(userId, prev);
    if (!rows.length || rows.some((r) => r.spent > r.limit)) return false;
    await this.prisma.$transaction((db) => this.gamification.unlockBadge(db, userId, badge));
    return true;
  }
}
