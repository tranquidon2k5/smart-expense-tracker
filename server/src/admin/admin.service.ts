import { Injectable } from "@nestjs/common";
import { AI_FEATURE_LABEL, MOTIVATION_CONTEXTS, missionCode, missionError, motivationError } from "@shared/admin-rules";
import { addDays } from "@shared/dates";
import type {
  AdminBadgeRow,
  AdminCategoryRow,
  AdminUserRow,
  AiFeature,
  Badge,
  Category,
  Mission,
  MissionPeriod,
  MotivationContext,
  MotivationMessage,
  SystemStats,
  TransactionType,
} from "@shared/types";
import { normalize } from "@shared/text";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { badRequest, conflict, notFound } from "../common/errors";
import { dbDate, isoDate, isoDateTime, toBadge, toCategory, toMission, toMotivation } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";

/** Múi giờ tính "ngày" cho số liệu hệ thống */
const SYSTEM_TZ = "Asia/Ho_Chi_Minh";
const FEATURES: AiFeature[] = ["extract", "classify", "chat", "motivation"];
const CONTEXTS = MOTIVATION_CONTEXTS.map((c) => c.value);

/** Trang quản trị (F15) — mọi route đã qua RolesGuard('admin') */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  // ───────────── Thống kê hệ thống (tính thật từ users, transactions, ai_logs, activity_logs) ─────────────

  async systemStats(): Promise<SystemStats> {
    const now = this.clock.now();
    const today = this.clock.today(SYSTEM_TZ);
    const since = (days: number) => addDays(today, -days);
    const from30 = since(29);

    const [totalUsers, newUsers30d, lockedUsers, totalTransactions, active7, active30, streaks, aiRows, txDaily, aiDaily, activeDaily] =
      await Promise.all([
        this.prisma.user.count({ where: { role: "user" } }),
        this.prisma.user.count({ where: { role: "user", createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } } }),
        this.prisma.user.count({ where: { role: "user", isLocked: true } }),
        this.prisma.transaction.count(),
        this.prisma.activityLog.findMany({
          where: { date: { gte: dbDate(since(7)) }, user: { role: "user" } },
          distinct: ["userId"],
          select: { userId: true },
        }),
        this.prisma.activityLog.findMany({
          where: { date: { gte: dbDate(since(30)) }, user: { role: "user" } },
          distinct: ["userId"],
          select: { userId: true },
        }),
        this.prisma.userStreak.findMany({ where: { currentStreak: { gte: 1 } }, select: { userId: true } }),
        this.prisma.aiLog.groupBy({
          by: ["feature", "success"],
          where: { createdAt: { gte: dbDate(from30) } },
          _count: { _all: true },
          _avg: { latencyMs: true },
        }),
        this.prisma.$queryRaw<{ day: Date; n: bigint }[]>`
          SELECT date AS day, COUNT(*)::bigint AS n FROM transactions WHERE date >= ${dbDate(from30)} GROUP BY date`,
        this.prisma.$queryRaw<{ day: Date; calls: bigint; failures: bigint }[]>`
          SELECT (created_at AT TIME ZONE ${SYSTEM_TZ})::date AS day, COUNT(*)::bigint AS calls,
                 COUNT(*) FILTER (WHERE NOT success)::bigint AS failures
          FROM ai_logs WHERE created_at >= ${dbDate(from30)} GROUP BY 1`,
        this.prisma.$queryRaw<{ day: Date; n: bigint }[]>`
          SELECT a.date AS day, COUNT(DISTINCT a.user_id)::bigint AS n FROM activity_logs a
          JOIN users u ON u.id = a.user_id AND u.role = 'user'
          WHERE a.date >= ${dbDate(from30)} GROUP BY a.date`,
      ]);

    const calls = aiRows.reduce((s, r) => s + r._count._all, 0);
    const failures = aiRows.filter((r) => !r.success).reduce((s, r) => s + r._count._all, 0);
    const latencySum = aiRows.reduce((s, r) => s + (r._avg.latencyMs ?? 0) * r._count._all, 0);
    const streakSet = new Set(streaks.map((s) => s.userId));
    const at = <T extends { day: Date }>(rows: T[], d: string) => rows.find((r) => isoDate(r.day) === d);

    return {
      totalUsers,
      newUsers30d,
      activeUsers7d: active7.length,
      lockedUsers,
      totalTransactions,
      transactions30d: txDaily.reduce((s, r) => s + Number(r.n), 0),
      aiCalls30d: calls,
      aiSuccessRate: calls ? 1 - failures / calls : 1,
      aiAvgLatencyMs: calls ? Math.round(latencySum / calls) : 0,
      aiByFeature: FEATURES.map((feature) => ({
        feature,
        label: AI_FEATURE_LABEL[feature],
        calls: aiRows.filter((r) => r.feature === feature).reduce((s, r) => s + r._count._all, 0),
        failures: aiRows.filter((r) => r.feature === feature && !r.success).reduce((s, r) => s + r._count._all, 0),
      })),
      streakRetention: active30.length ? active30.filter((a) => streakSet.has(a.userId)).length / active30.length : 0,
      streakRetentionBase: active30.length,
      daily: Array.from({ length: 30 }, (_, i) => {
        const date = addDays(from30, i);
        const ai = at(aiDaily, date);
        return {
          date,
          transactions: Number(at(txDaily, date)?.n ?? 0),
          aiCalls: Number(ai?.calls ?? 0),
          aiFailures: Number(ai?.failures ?? 0),
          activeUsers: Number(at(activeDaily, date)?.n ?? 0),
        };
      }),
    };
  }

  // ───────────── Người dùng ─────────────

  async listUsers(): Promise<AdminUserRow[]> {
    const [users, lastActive, txCounts, aiCounts] = await Promise.all([
      this.prisma.user.findMany({ include: { streak: true }, orderBy: { createdAt: "desc" } }),
      this.prisma.activityLog.groupBy({ by: ["userId"], _max: { date: true } }),
      this.prisma.transaction.groupBy({ by: ["userId"], _count: { _all: true } }),
      this.prisma.aiLog.groupBy({ by: ["userId"], _count: { _all: true } }),
    ]);
    return users.map((u) => {
      const last = lastActive.find((x) => x.userId === u.id)?._max.date;
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        isLocked: u.isLocked,
        createdAt: isoDateTime(u.createdAt),
        lastActiveDate: last ? isoDate(last) : null,
        transactionCount: txCounts.find((x) => x.userId === u.id)?._count._all ?? 0,
        currentStreak: u.streak?.currentStreak ?? 0,
        aiCalls: aiCounts.find((x) => x.userId === u.id)?._count._all ?? 0,
      };
    });
  }

  /** Khoá: thu hồi mọi refresh token → người đó bị đăng xuất ở lần gọi API kế tiếp */
  async setUserLocked(me: AuthUser, userId: string, locked: boolean): Promise<AdminUserRow> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound("Không tìm thấy người dùng.");
    if (user.id === me.id) throw badRequest("Bạn không thể tự khoá tài khoản của mình.");
    if (user.role === "admin") throw badRequest("Không khoá được tài khoản quản trị viên khác từ đây.");
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isLocked: locked } }),
      ...(locked
        ? [this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: this.clock.now() } })]
        : []),
    ]);
    return (await this.listUsers()).find((u) => u.id === userId)!;
  }

  // ───────────── Danh mục mặc định ─────────────

  private usage(categoryId: string) {
    return this.prisma.transaction.count({ where: { categoryId } });
  }

  async listDefaultCategories(): Promise<AdminCategoryRow[]> {
    const [rows, counts] = await Promise.all([
      this.prisma.category.findMany({ where: { userId: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      this.prisma.transaction.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    ]);
    return rows.map((c) => ({ ...toCategory(c), usage: counts.find((x) => x.categoryId === c.id)?._count._all ?? 0 }));
  }

  async saveDefaultCategory(input: { id?: string; name: string; type: TransactionType; icon: string; color: string }): Promise<Category> {
    const name = (input.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2) throw badRequest("Tên danh mục cần ít nhất 2 ký tự.", "name");
    if (name.length > 30) throw badRequest("Tên tối đa 30 ký tự.", "name");
    if (input.type !== "income" && input.type !== "expense") throw badRequest("Chọn loại thu hoặc chi.", "type");
    if (!/^[A-Z][A-Za-z0-9]{1,39}$/.test(input.icon ?? "")) throw badRequest("Biểu tượng chưa hợp lệ.", "icon");
    if (!/^#[0-9A-Fa-f]{6}$/.test(input.color ?? "")) throw badRequest("Màu cần dạng #RRGGBB.", "color");
    const all = await this.prisma.category.findMany({ where: { userId: null, type: input.type, ...(input.id ? { id: { not: input.id } } : {}) } });
    const same = all.find((c) => normalize(c.name) === normalize(name));
    if (same) throw conflict(`Đã có danh mục mặc định “${same.name}”.`, "name");
    if (input.id) {
      const c = await this.prisma.category.findFirst({ where: { id: input.id, userId: null } });
      if (!c) throw notFound("Danh mục không tồn tại.");
      // Đổi loại thu/chi khi đã có giao dịch sẽ làm sai số liệu của người dùng
      if (c.type !== input.type && (await this.usage(c.id)) > 0) {
        throw badRequest("Danh mục đang có giao dịch nên không đổi được loại thu/chi.", "type");
      }
      return toCategory(await this.prisma.category.update({ where: { id: c.id }, data: { name, type: input.type, icon: input.icon, color: input.color } }));
    }
    return toCategory(
      await this.prisma.category.create({ data: { userId: null, name, type: input.type, icon: input.icon, color: input.color, createdAt: this.clock.now() } }),
    );
  }

  /** Không xoá danh mục đang dùng (gợi ý đổi tên thay vì xoá) */
  async deleteDefaultCategory(id: string): Promise<void> {
    const c = await this.prisma.category.findFirst({ where: { id, userId: null } });
    if (!c) throw notFound("Danh mục không tồn tại.");
    const usage = await this.usage(id);
    if (usage) throw badRequest(`Danh mục đang được dùng cho ${usage} giao dịch nên không xoá được. Bạn có thể đổi tên thay vì xoá.`);
    const refs = (await this.prisma.budget.count({ where: { categoryId: id } })) + (await this.prisma.classificationRule.count({ where: { categoryId: id } }));
    if (refs) throw badRequest("Danh mục đang được dùng trong ngân sách hoặc luật phân loại nên không xoá được.");
    await this.prisma.category.delete({ where: { id } });
  }

  // ───────────── Câu khích lệ ─────────────

  async listMotivation(): Promise<MotivationMessage[]> {
    const rows = await this.prisma.motivationMessage.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map(toMotivation);
  }

  /** Mỗi ngữ cảnh phải còn ít nhất 1 câu đang bật, nếu không người dùng sẽ không nhận được câu nào */
  private async ensureContextKeepsActive(m: { id: string; context: MotivationContext; isActive: boolean }, staysActiveHere: boolean) {
    if (!m.isActive || staysActiveHere) return;
    const others = await this.prisma.motivationMessage.count({ where: { id: { not: m.id }, context: m.context, isActive: true } });
    if (!others) {
      const label = MOTIVATION_CONTEXTS.find((c) => c.value === m.context)?.label ?? m.context;
      throw badRequest(`“${label}” cần còn ít nhất 1 câu đang bật. Thêm câu khác trước khi tắt câu này.`);
    }
  }

  async saveMotivation(input: { id?: string; context: MotivationContext; template: string; isActive: boolean }): Promise<MotivationMessage> {
    if (!CONTEXTS.includes(input.context)) throw badRequest("Ngữ cảnh không hợp lệ.", "context");
    const template = (input.template ?? "").trim();
    const invalid = motivationError(template);
    if (invalid) throw badRequest(invalid, "template");
    if (input.id) {
      const m = await this.prisma.motivationMessage.findUnique({ where: { id: input.id } });
      if (!m) throw notFound("Không tìm thấy câu.");
      await this.ensureContextKeepsActive(m, input.isActive && input.context === m.context);
      return toMotivation(
        await this.prisma.motivationMessage.update({ where: { id: m.id }, data: { context: input.context, template, isActive: input.isActive } }),
      );
    }
    return toMotivation(
      await this.prisma.motivationMessage.create({ data: { context: input.context, template, isActive: input.isActive, createdAt: this.clock.now() } }),
    );
  }

  async setMotivationActive(id: string, isActive: boolean): Promise<void> {
    const m = await this.prisma.motivationMessage.findUnique({ where: { id } });
    if (!m) throw notFound("Không tìm thấy câu.");
    await this.ensureContextKeepsActive(m, isActive);
    await this.prisma.motivationMessage.update({ where: { id }, data: { isActive } });
  }

  async deleteMotivation(id: string): Promise<void> {
    const m = await this.prisma.motivationMessage.findUnique({ where: { id } });
    if (!m) return;
    await this.ensureContextKeepsActive(m, false);
    await this.prisma.motivationMessage.delete({ where: { id } });
  }

  // ───────────── Nhiệm vụ ─────────────

  async listMissions(): Promise<Mission[]> {
    const rows = await this.prisma.mission.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map(toMission);
  }

  async saveMission(input: { id?: string; code?: string; title: string; period: MissionPeriod; target: number; xp: number; isActive?: boolean }): Promise<Mission> {
    if (input.period !== "daily" && input.period !== "weekly") throw badRequest("Chu kỳ không hợp lệ.", "period");
    const invalid = missionError(input);
    if (invalid) throw badRequest(invalid);
    const title = input.title.trim();
    if (input.id) {
      const m = await this.prisma.mission.findUnique({ where: { id: input.id } });
      if (!m) throw notFound("Không tìm thấy nhiệm vụ.");
      if (m.period !== input.period) throw badRequest("Không đổi được chu kỳ của nhiệm vụ đang chạy. Tạo nhiệm vụ mới thay thế.", "period");
      return toMission(
        await this.prisma.mission.update({ where: { id: m.id }, data: { title, target: input.target, xp: input.xp, isActive: input.isActive ?? true } }),
      );
    }
    const code = missionCode(input.code?.trim() || title);
    if (!code) throw badRequest("Mã nhiệm vụ chưa hợp lệ.", "code");
    if (await this.prisma.mission.findUnique({ where: { code } })) throw conflict(`Mã ${code} đã tồn tại.`, "code");
    return toMission(
      await this.prisma.mission.create({
        data: { code, title, period: input.period, target: input.target, xp: input.xp, isActive: input.isActive ?? true, createdAt: this.clock.now() },
      }),
    );
  }

  // ───────────── Huy hiệu ─────────────

  async listBadges(): Promise<AdminBadgeRow[]> {
    const [badges, counts] = await Promise.all([
      this.prisma.badge.findMany({ orderBy: { id: "asc" } }),
      this.prisma.userBadge.groupBy({ by: ["badgeId"], _count: { _all: true } }),
    ]);
    return badges.map((b) => ({ ...toBadge(b), unlockedUsers: counts.find((c) => c.badgeId === b.id)?._count._all ?? 0 }));
  }

  /** Điều kiện mở khoá gắn với mã huy hiệu trong code → admin chỉ sửa tên, mô tả, icon */
  async saveBadge(input: { id: string; name: string; condition: string; icon: string }): Promise<Badge> {
    const b = await this.prisma.badge.findUnique({ where: { id: input.id } });
    if (!b) throw notFound("Không tìm thấy huy hiệu.");
    const name = (input.name ?? "").trim();
    if (name.length < 2) throw badRequest("Tên huy hiệu cần ít nhất 2 ký tự.", "name");
    const condition = (input.condition ?? "").trim();
    if (condition.length < 5) throw badRequest("Mô tả điều kiện cần ít nhất 5 ký tự.", "condition");
    if (!/^[A-Z][A-Za-z0-9]{1,39}$/.test(input.icon ?? "")) throw badRequest("Biểu tượng chưa hợp lệ.", "icon");
    return toBadge(await this.prisma.badge.update({ where: { id: b.id }, data: { name, condition, icon: input.icon } }));
  }
}
