import { Injectable } from "@nestjs/common";
import { addDays, isoWeekKey, mondayOf } from "@shared/dates";
import {
  FREEZE_EVERY_DAYS,
  FREEZE_MAX,
  STREAK_MILESTONES,
  XP_RULES,
  firstNameOf,
  fillTemplate,
  levelFromXp,
  levelTitle,
  nextMilestone,
  type XpAction,
} from "@shared/gamification-rules";
import type {
  AchievementsOverview,
  ActivityDay,
  BadgeView,
  GamificationStatus,
  MissionPeriod,
  MissionProgress,
  MotivationContext,
} from "@shared/types";
import { ClockService } from "../common/clock.service";
import { badRequest } from "../common/errors";
import type { Db } from "../common/db";
import { dbDate, isoDate, toBadge, toMission, toStreak } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { pushCelebration, type Celebration } from "../common/request-context";

/** Hành động hợp lệ cho chuỗi ngày (PRD §6.2) — đăng nhập không tính */
export const STREAK_ACTIONS = ["add_transaction", "review_transaction", "no_spend_day"] as const;
type StreakAction = (typeof STREAK_ACTIONS)[number];

/** Số tuần hiển thị trên lịch nhiệt (≈ 6 tháng) */
export const HEATMAP_WEEKS = 26;

export interface XpAward {
  xp: number;
  /** true khi hành động này đã chạm giới hạn trong ngày → không cộng XP */
  limitReached: boolean;
}

export interface ActivityResult extends XpAward {
  streakIncreased: boolean;
  milestone: { days: number; xp: number } | null;
  currentStreak: number;
}

const CELEBRATION_LINK: Record<Celebration["kind"], string> = {
  streak: "/thanh-tich",
  badge: "/thanh-tich",
  level: "/thanh-tich",
  mission: "/",
};

/**
 * Chuỗi ngày, XP, nhiệm vụ, huy hiệu (F11–F14). Các hàm ghi nhận một `Db` để chạy chung
 * transaction với thao tác gốc (ghi giao dịch, duyệt…): giao dịch lưu thì XP cũng lưu, lỗi thì
 * cả hai cùng huỷ. `today` luôn là ngày theo múi giờ người dùng.
 */
@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  todayOf(timezone: string): string {
    return this.clock.today(timezone);
  }

  // ───────────── Chúc mừng ─────────────

  /** Lưu vào trung tâm thông báo và trả kèm response để giao diện hiện hiệu ứng */
  async celebrate(db: Db, userId: string, c: Celebration): Promise<void> {
    await db.notification.create({
      data: {
        userId,
        type: "celebration",
        title: (c.xp ? `${c.title} +${c.xp} XP` : c.title).slice(0, 120),
        content: c.description,
        link: CELEBRATION_LINK[c.kind],
        createdAt: this.clock.now(),
      },
    });
    pushCelebration(c);
  }

  // ───────────── XP & cấp độ ─────────────

  /** Cộng XP thô (thưởng mốc chuỗi, nhiệm vụ…) và chúc mừng nếu lên cấp */
  async addBonusXp(db: Db, userId: string, amount: number): Promise<void> {
    if (amount <= 0) return;
    const before = await db.userLevel.upsert({ where: { userId }, create: { userId }, update: {} });
    const totalXp = before.totalXp + amount;
    const after = levelFromXp(totalXp).level;
    await db.userLevel.update({ where: { userId }, data: { totalXp, level: after } });
    if (after > levelFromXp(before.totalXp).level) {
      await this.celebrate(db, userId, {
        kind: "level",
        title: `Lên cấp ${after}!`,
        description: `Danh hiệu mới: ${levelTitle(after)}. Bạn đang làm rất tốt.`,
        icon: "Star",
      });
    }
  }

  /**
   * Xoá giao dịch trong cùng ngày đã ghi → trừ lại đúng XP đã cộng cho nó (PRD §13.1),
   * không để tổng XP âm, và trả lại một lượt trong giới hạn 10 lần/ngày.
   */
  async revokeTransactionXp(db: Db, userId: string, transactionId: string, today: string): Promise<number> {
    const log = await db.activityLog.findFirst({
      where: { userId, refId: transactionId, actionType: "add_transaction", xp: { gt: 0 } },
    });
    if (!log) return 0;
    if (isoDate(log.date) !== today) return 0;
    await db.activityLog.update({ where: { id: log.id }, data: { xp: 0 } });
    const level = await db.userLevel.findUnique({ where: { userId } });
    const removed = Math.min(log.xp, level?.totalXp ?? 0);
    if (removed > 0) {
      const totalXp = level!.totalXp - removed;
      await db.userLevel.update({ where: { userId }, data: { totalXp, level: levelFromXp(totalXp).level } });
    }
    return removed;
  }

  // ───────────── Chuỗi ngày ─────────────

  /**
   * Chốt các ngày đã qua (từ sau ngày hoạt động cuối tới hôm qua): ngày trống dùng thẻ đóng băng
   * nếu còn, hết thẻ thì chuỗi về 0 (kỷ lục giữ nguyên). Đánh dấu `settled_date` nên gọi lại bao
   * nhiêu lần cũng ra cùng kết quả — dùng cho cả job 00:00 lẫn lúc người dùng ghi chép.
   */
  async settle(db: Db, userId: string, today: string): Promise<{ frozen: string[]; lost: boolean }> {
    const streak = await db.userStreak.upsert({ where: { userId }, create: { userId }, update: {} });
    const yesterday = addDays(today, -1);
    const frozen: string[] = [];
    let lost = false;
    if (!streak.lastActiveDate) {
      await db.userStreak.update({ where: { userId }, data: { settledDate: dbDate(yesterday) } });
      return { frozen, lost };
    }
    const lastActive = isoDate(streak.lastActiveDate);
    const settled = streak.settledDate ? isoDate(streak.settledDate) : lastActive;
    let start = addDays(settled > lastActive ? settled : lastActive, 1);
    let { currentStreak, freezeCount } = streak;
    for (let d = start; d <= yesterday && currentStreak > 0; d = addDays(d, 1)) {
      if (freezeCount > 0) {
        freezeCount -= 1;
        frozen.push(d);
      } else {
        currentStreak = 0;
        lost = true;
      }
    }
    if (frozen.length) {
      await db.freezeUsage.createMany({ data: frozen.map((d) => ({ userId, date: dbDate(d) })), skipDuplicates: true });
    }
    if (start <= yesterday || !streak.settledDate || isoDate(streak.settledDate) < yesterday) {
      await db.userStreak.update({
        where: { userId },
        data: { currentStreak, freezeCount, settledDate: dbDate(yesterday) },
      });
    }
    return { frozen, lost };
  }

  /**
   * Ghi nhận một hành động: nhật ký hoạt động, XP (giới hạn theo ngày), chuỗi ngày.
   * Lần đầu trong ngày: chuỗi +1, mỗi 7 ngày nhận 1 thẻ đóng băng (tối đa 2), chạm mốc thì
   * cộng XP thưởng và chúc mừng.
   */
  async recordActivity(
    db: Db,
    userId: string,
    today: string,
    actionType: StreakAction | "login",
    options: { xpAction?: XpAction; refId?: string } = {},
  ): Promise<ActivityResult> {
    const date = dbDate(today);
    let xp = 0;
    let limitReached = false;
    if (options.xpAction) {
      const rule = XP_RULES[options.xpAction];
      const used = await db.activityLog.count({ where: { userId, date, actionType, xp: { gt: 0 } } });
      if (used >= rule.dailyLimit) limitReached = true;
      else xp = rule.xp;
    }

    const isStreakAction = actionType !== "login";
    const activeBefore =
      isStreakAction &&
      (await db.activityLog.count({ where: { userId, date, actionType: { in: [...STREAK_ACTIONS] } } })) > 0;

    await db.activityLog.create({
      data: { userId, date, actionType, xp, refId: options.refId ?? null, createdAt: this.clock.now() },
    });
    if (xp > 0) await this.addBonusXp(db, userId, xp);

    const result: ActivityResult = { xp, limitReached, streakIncreased: false, milestone: null, currentStreak: 0 };
    if (!isStreakAction || activeBefore) {
      result.currentStreak = (await db.userStreak.findUnique({ where: { userId } }))?.currentStreak ?? 0;
      return result;
    }

    await this.settle(db, userId, today);
    const streak = (await db.userStreak.findUnique({ where: { userId } }))!;
    const current = streak.currentStreak + 1;
    const earnsFreeze = current % FREEZE_EVERY_DAYS === 0 && streak.freezeCount < FREEZE_MAX;
    await db.userStreak.update({
      where: { userId },
      data: {
        currentStreak: current,
        longestStreak: Math.max(streak.longestStreak, current),
        lastActiveDate: date,
        settledDate: dbDate(addDays(today, -1)),
        freezeCount: streak.freezeCount + (earnsFreeze ? 1 : 0),
      },
    });
    result.streakIncreased = true;
    result.currentStreak = current;
    await this.bumpMission(db, userId, "WEEKLY_5_DAYS", today);

    const bonus = STREAK_MILESTONES[current];
    if (bonus) {
      await this.addBonusXp(db, userId, bonus);
      await this.celebrate(db, userId, {
        kind: "streak",
        title: `Chuỗi ${current} ngày!`,
        description: `Tuyệt vời! ${current} ngày liên tiếp, bạn đã có thói quen thật sự rồi.`,
        icon: "Flame",
        xp: bonus,
      });
      result.milestone = { days: current, xp: bonus };
    }
    return result;
  }

  // ───────────── Nhiệm vụ ─────────────

  periodKey(period: MissionPeriod, today: string): string {
    return period === "daily" ? today : isoWeekKey(today);
  }

  /** Tăng tiến độ nhiệm vụ; hoàn thành thì cộng XP nhiệm vụ và chúc mừng */
  async bumpMission(db: Db, userId: string, code: string, today: string, by = 1): Promise<void> {
    const mission = await db.mission.findUnique({ where: { code } });
    if (!mission || !mission.isActive || by <= 0) return;
    const periodKey = this.periodKey(mission.period, today);
    const key = { userId_missionId_periodKey: { userId, missionId: mission.id, periodKey } };
    const um = await db.userMission.upsert({
      where: key,
      create: { userId, missionId: mission.id, periodKey },
      update: {},
    });
    if (um.progress >= mission.target) return;
    const progress = Math.min(mission.target, um.progress + by);
    const done = progress >= mission.target;
    await db.userMission.update({ where: key, data: { progress, completedAt: done ? this.clock.now() : null } });
    if (!done) return;
    await this.addBonusXp(db, userId, mission.xp);
    await this.celebrate(db, userId, {
      kind: "mission",
      title: "Hoàn thành nhiệm vụ",
      description: mission.title,
      icon: "ListChecks",
      xp: mission.xp,
    });
  }

  async missions(db: Db, userId: string, period: MissionPeriod, today: string): Promise<MissionProgress[]> {
    const periodKey = this.periodKey(period, today);
    const list = await db.mission.findMany({
      where: { period, isActive: true },
      orderBy: { createdAt: "asc" },
      include: { userMissions: { where: { userId, periodKey } } },
    });
    return list.map((m) => {
      const progress = m.userMissions[0]?.progress ?? 0;
      return { mission: toMission(m), progress, completed: progress >= m.target };
    });
  }

  missionsFor(userId: string, timezone: string, period: MissionPeriod): Promise<MissionProgress[]> {
    return this.missions(this.prisma, userId, period, this.todayOf(timezone));
  }

  /**
   * "Hôm nay không chi tiêu" (PRD §6.2): giữ chuỗi mà không cần ghi giao dịch.
   * Chỉ dùng được khi hôm nay chưa có khoản chi nào, mỗi ngày một lần.
   */
  async markNoSpendDay(userId: string, timezone: string): Promise<GamificationStatus> {
    const today = this.todayOf(timezone);
    await this.prisma.$transaction(async (db) => {
      const date = dbDate(today);
      if (await db.transaction.count({ where: { userId, date, type: "expense" } })) {
        throw badRequest("Hôm nay bạn đã có khoản chi nên không đánh dấu “không chi tiêu” được.");
      }
      if (await db.activityLog.count({ where: { userId, date, actionType: "no_spend_day" } })) {
        throw badRequest("Hôm nay bạn đã đánh dấu không chi tiêu rồi.");
      }
      await this.recordActivity(db, userId, today, "no_spend_day");
      await this.evaluateBadges(db, userId, today);
    });
    return this.status(userId, timezone);
  }

  // ───────────── Huy hiệu ─────────────

  /** Tiến độ hướng tới từng huy hiệu, tính từ dữ liệu thật; null = chỉ xét được cuối tháng */
  async badgeProgress(db: Db, userId: string, today: string): Promise<Map<string, { current: number; target: number } | null>> {
    const [txCount, streak, chatCount, budgetCount, level] = await Promise.all([
      db.transaction.count({ where: { userId } }),
      db.userStreak.findUnique({ where: { userId } }),
      db.chatMessage.count({ where: { userId, role: "user", refused: false } }),
      db.budget.count({ where: { userId, month: today.slice(0, 7) } }),
      db.userLevel.findUnique({ where: { userId } }),
    ]);
    const longest = streak?.longestStreak ?? 0;
    const p = (current: number, target: number) => ({ current: Math.min(target, current), target });
    return new Map([
      ["FIRST_STEP", p(txCount, 1)],
      ["FIRE_7", p(longest, 7)],
      ["FIRE_30", p(longest, 30)],
      ["FIRE_100", p(longest, 100)],
      ["CHAT_10", p(chatCount, 10)],
      ["PLANNER", p(budgetCount, 3)],
      ["COLLECTOR", p(txCount, 100)],
      ["AI_TEACHER", p(level?.aiCorrections ?? 0, 20)],
      ["KEEP_PROMISE", null],
    ]);
  }

  /** Mở các huy hiệu vừa đạt điều kiện; mỗi huy hiệu mới được chúc mừng một lần */
  async evaluateBadges(db: Db, userId: string, today: string): Promise<string[]> {
    const [badges, owned, progress] = await Promise.all([
      db.badge.findMany({ where: { isActive: true } }),
      db.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
      this.badgeProgress(db, userId, today),
    ]);
    const have = new Set(owned.map((b) => b.badgeId));
    const unlocked: string[] = [];
    for (const badge of badges) {
      if (have.has(badge.id)) continue;
      const p = progress.get(badge.code);
      if (!p || p.current < p.target) continue;
      await this.unlockBadge(db, userId, badge);
      unlocked.push(badge.code);
    }
    return unlocked;
  }

  async unlockBadge(db: Db, userId: string, badge: { id: string; name: string; condition: string; icon: string }) {
    const created = await db.userBadge.createMany({
      data: [{ userId, badgeId: badge.id, unlockedAt: this.clock.now() }],
      skipDuplicates: true,
    });
    if (!created.count) return;
    await this.celebrate(db, userId, {
      kind: "badge",
      title: `Mở khoá huy hiệu “${badge.name}”`,
      description: badge.condition,
      icon: badge.icon,
    });
  }

  /** Sửa danh mục AI đoán = dạy AI (huy hiệu "Thầy giáo của AI") */
  async recordCorrection(db: Db, userId: string): Promise<void> {
    await db.userLevel.upsert({
      where: { userId },
      create: { userId, aiCorrections: 1 },
      update: { aiCorrections: { increment: 1 } },
    });
  }

  // ───────────── Đọc ─────────────

  private async isActiveToday(db: Db, userId: string, today: string): Promise<boolean> {
    const n = await db.activityLog.count({
      where: { userId, date: dbDate(today), actionType: { in: [...STREAK_ACTIONS] } },
    });
    return n > 0;
  }

  async status(userId: string, timezone: string): Promise<GamificationStatus> {
    const today = this.todayOf(timezone);
    await this.settle(this.prisma, userId, today);
    const [streak, level, activeToday] = await Promise.all([
      this.prisma.userStreak.findUnique({ where: { userId } }),
      this.prisma.userLevel.findUnique({ where: { userId } }),
      this.isActiveToday(this.prisma, userId, today),
    ]);
    const { level: lv, xpInLevel, xpForNextLevel } = levelFromXp(level?.totalXp ?? 0);
    return { streak: toStreak(streak, userId), activeToday, level: lv, levelTitle: levelTitle(lv), xpInLevel, xpForNextLevel };
  }

  async achievements(userId: string, timezone: string): Promise<AchievementsOverview> {
    const today = this.todayOf(timezone);
    const status = await this.status(userId, timezone);
    const start = addDays(mondayOf(today), -(HEATMAP_WEEKS - 1) * 7);
    const [logs, freezes, level, daily, weekly, badges, owned, progress] = await Promise.all([
      this.prisma.activityLog.groupBy({
        by: ["date"],
        where: { userId, date: { gte: dbDate(start), lte: dbDate(today) }, actionType: { in: [...STREAK_ACTIONS] } },
        _count: { _all: true },
      }),
      this.prisma.freezeUsage.findMany({ where: { userId, date: { gte: dbDate(start) } } }),
      this.prisma.userLevel.findUnique({ where: { userId } }),
      this.missions(this.prisma, userId, "daily", today),
      this.missions(this.prisma, userId, "weekly", today),
      this.prisma.badge.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
      this.prisma.userBadge.findMany({ where: { userId } }),
      this.badgeProgress(this.prisma, userId, today),
    ]);
    const counts = new Map(logs.map((l) => [isoDate(l.date), l._count._all]));
    const frozen = new Set(freezes.map((f) => isoDate(f.date)));
    const days: ActivityDay[] = [];
    for (let d = start; d <= today; d = addDays(d, 1)) days.push({ date: d, count: counts.get(d) ?? 0, frozen: frozen.has(d) });

    const badgeViews: BadgeView[] = badges.map((b) => ({
      badge: toBadge(b),
      unlockedAt: owned.find((o) => o.badgeId === b.id)?.unlockedAt.toISOString() ?? null,
      progress: progress.get(b.code) ?? null,
    }));
    return {
      status,
      nextMilestone: nextMilestone(status.streak.currentStreak),
      nextLevelTitle: levelTitle(status.level + 1),
      totalXp: level?.totalXp ?? 0,
      days,
      dailyMissions: daily,
      weeklyMissions: weekly,
      badges: badgeViews,
    };
  }

  // ───────────── Câu khích lệ (PRD §6.3) ─────────────

  async motivationContext(userId: string, today: string): Promise<MotivationContext> {
    const [txCount, activeToday, streak, lastLogin] = await Promise.all([
      this.prisma.transaction.count({ where: { userId } }),
      this.isActiveToday(this.prisma, userId, today),
      this.prisma.userStreak.findUnique({ where: { userId } }),
      this.prisma.activityLog.findFirst({
        where: { userId, date: { lt: dbDate(today) } },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
    ]);
    if (txCount === 0) return "first_day";
    if (activeToday) return "after_transaction";
    if (lastLogin && addDays(isoDate(lastLogin.date), 7) <= today) return "welcome_back";
    if (streak && streak.currentStreak === 0 && streak.longestStreak > 0) return "streak_lost";
    return "morning";
  }

  /**
   * Chọn câu đang bật theo ngữ cảnh, ưu tiên câu chưa hiện trong 7 ngày (lưu lịch sử đã hiện).
   * Cùng ngày cùng ngữ cảnh luôn ra cùng câu.
   */
  async motivation(userId: string, timezone: string, fullName: string, contextOverride?: MotivationContext): Promise<string> {
    const today = this.todayOf(timezone);
    await this.settle(this.prisma, userId, today);
    const context = contextOverride ?? (await this.motivationContext(userId, today));
    const pool = await this.prisma.motivationMessage.findMany({ where: { context, isActive: true }, orderBy: { createdAt: "asc" } });
    const streak = await this.prisma.userStreak.findUnique({ where: { userId } });
    const vars = { name: firstNameOf(fullName), streak: streak?.currentStreak ?? 0, longest: streak?.longestStreak ?? 0 };
    if (!pool.length) return "Mỗi khoản bạn ghi là một bước hiểu túi tiền của mình hơn.";

    const recent = await this.prisma.motivationHistory.findMany({
      where: { userId, messageId: { in: pool.map((m) => m.id) }, shownOn: { gte: dbDate(addDays(today, -6)) } },
    });
    const shownToday = recent.find((h) => isoDate(h.shownOn) === today);
    let chosen = shownToday ? pool.find((m) => m.id === shownToday.messageId) : undefined;
    if (!chosen) {
      const fresh = pool.filter((m) => !recent.some((h) => h.messageId === m.id));
      const candidates = fresh.length ? fresh : pool;
      const dayIndex = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
      chosen = candidates[dayIndex % candidates.length];
      await this.prisma.motivationHistory.createMany({
        data: [{ userId, messageId: chosen.id, shownOn: dbDate(today) }],
        skipDuplicates: true,
      });
    }
    return fillTemplate(chosen.template, vars);
  }

  /** Câu dùng ngay sau khi ghi giao dịch (không lưu lịch sử để không chiếm lượt câu buổi sáng) */
  async afterTransactionMessage(db: Db): Promise<string> {
    const m = await db.motivationMessage.findFirst({ where: { context: "after_transaction", isActive: true }, orderBy: { createdAt: "asc" } });
    return m?.template ?? "Ghi xong rồi! Bạn đang hiểu túi tiền của mình hơn mỗi ngày.";
  }
}
