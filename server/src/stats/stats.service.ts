import { Injectable } from "@nestjs/common";
import { lastDayOfMonth } from "@shared/dates";
import { breakdownFromTotals, comparisonRows, isMonth, monthsBetween, shiftMonth } from "@shared/stats";
import type {
  BudgetProgress,
  CategoryBreakdown,
  DashboardSummary,
  MonthComparison,
  MonthTotals,
  MonthlyTrendPoint,
  StatsOverview,
  StatsRange,
} from "@shared/types";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { badRequest } from "../common/errors";
import { TX_INCLUDE, dbDate, isoDate, money, toBudget, toCategory, toTransactionView } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { nextMonthStart } from "../transactions/transactions.service";

/** Khoảng ngày [from, to) của một khoảng tháng */
const monthSpan = (from: string, to: string) => ({ gte: dbDate(`${from}-01`), lt: dbDate(nextMonthStart(to)) });

/**
 * Tổng quan (dashboard) và Thống kê (F06) tính trên cùng một tập: chỉ giao dịch đã xác nhận,
 * dùng chung hàm chia danh mục ở shared/stats → số liệu tháng này luôn khớp giữa hai trang.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  currentMonth(user: AuthUser): string {
    return this.clock.today(user.timezone).slice(0, 7);
  }

  private async totals(userId: string, date: { gte: Date; lt?: Date; lte?: Date }): Promise<MonthTotals> {
    const rows = await this.prisma.transaction.groupBy({
      by: ["type"],
      where: { userId, status: "confirmed", date },
      _sum: { amount: true },
    });
    const get = (type: "income" | "expense") => money(rows.find((r) => r.type === type)?._sum.amount);
    return { income: get("income"), expense: get("expense") };
  }

  /** Chi theo danh mục trong khoảng — thứ tự danh mục ổn định để chia "Khác" tất định */
  private async expenseByCategory(userId: string, date: { gte: Date; lt: Date }): Promise<[string, number][]> {
    const rows = await this.prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, status: "confirmed", type: "expense", date },
      _sum: { amount: true },
      orderBy: { categoryId: "asc" },
    });
    return rows.map((r) => [r.categoryId, money(r._sum.amount)]);
  }

  private async categories(userId: string) {
    const rows = await this.prisma.category.findMany({ where: { OR: [{ userId: null }, { userId }] } });
    return rows.map(toCategory);
  }

  // ───────────── Tổng quan ─────────────

  async summary(user: AuthUser): Promise<DashboardSummary> {
    const today = this.clock.today(user.timezone);
    const month = today.slice(0, 7);
    const prev = shiftMonth(month, -1);
    const day = Number(today.slice(8, 10));
    // Cùng kỳ tháng trước: ngày 1 → cùng ngày hôm nay (tháng ngắn hơn thì tới cuối tháng)
    const sameDay = `${prev}-${String(day).padStart(2, "0")}`;
    const prevEnd = sameDay < lastDayOfMonth(prev) ? sameDay : lastDayOfMonth(prev);
    const [wallets, current, previousSamePeriod, watch] = await Promise.all([
      this.prisma.wallet.aggregate({ where: { userId: user.id }, _sum: { balance: true } }),
      this.totals(user.id, monthSpan(month, month)),
      this.totals(user.id, { gte: dbDate(`${prev}-01`), lte: dbDate(prevEnd) }),
      this.budgetProgress(user.id, month),
    ]);
    return {
      month,
      balance: money(wallets._sum.balance),
      current,
      previousSamePeriod,
      budgetTotal: watch.reduce((s, r) => s + r.budget.limitAmount, 0),
      budgetSpent: watch.reduce((s, r) => s + r.spent, 0),
    };
  }

  private async monthlyRows(userId: string, from: string, to: string) {
    const span = monthSpan(from, to);
    const rows = await this.prisma.$queryRaw<{ month: string; type: "income" | "expense"; total: bigint }[]>`
      SELECT to_char(date, 'YYYY-MM') AS month, type::text AS type, SUM(amount)::bigint AS total
      FROM transactions
      WHERE user_id = ${userId} AND status = 'confirmed' AND date >= ${span.gte} AND date < ${span.lt}
      GROUP BY 1, 2`;
    return (month: string): MonthTotals => ({
      income: money(rows.find((r) => r.month === month && r.type === "income")?.total),
      expense: money(rows.find((r) => r.month === month && r.type === "expense")?.total),
    });
  }

  /** Thu/chi theo tháng, `months` tháng gần nhất (tính cả tháng hiện tại); bỏ tháng trống */
  async trend(user: AuthUser, months = 6): Promise<MonthlyTrendPoint[]> {
    const to = this.currentMonth(user);
    const from = shiftMonth(to, -(Math.min(Math.max(months, 1), 36) - 1));
    const at = await this.monthlyRows(user.id, from, to);
    return monthsBetween(from, to)
      .map((month) => ({ month, ...at(month) }))
      .filter((p) => p.income || p.expense);
  }

  async breakdown(user: AuthUser, maxSlices = 5): Promise<CategoryBreakdown> {
    const month = this.currentMonth(user);
    const [totals, categories] = await Promise.all([
      this.expenseByCategory(user.id, monthSpan(month, month)),
      this.categories(user.id),
    ]);
    return breakdownFromTotals(totals, categories, month, maxSlices);
  }

  async budgetProgress(userId: string, month: string): Promise<BudgetProgress[]> {
    const [budgets, spent] = await Promise.all([
      this.prisma.budget.findMany({ where: { userId, month }, include: { category: true } }),
      this.prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId, status: "confirmed", type: "expense", date: monthSpan(month, month) },
        _sum: { amount: true },
      }),
    ]);
    return budgets
      .map((b) => {
        const s = money(spent.find((x) => x.categoryId === b.categoryId)?._sum.amount);
        return { budget: toBudget(b), category: toCategory(b.category), spent: s, ratio: s / money(b.limitAmount) };
      })
      .sort((a, b) => b.ratio - a.ratio);
  }

  async watchlist(user: AuthUser, limit = 4): Promise<BudgetProgress[]> {
    return (await this.budgetProgress(user.id, this.currentMonth(user))).slice(0, limit);
  }

  // ───────────── Thống kê ─────────────

  /** Khoảng tháng chọn được: từ tháng có giao dịch đầu tiên tới tháng hiện tại */
  async availableMonths(user: AuthUser): Promise<string[]> {
    const current = this.currentMonth(user);
    const first = await this.prisma.transaction.findFirst({ where: { userId: user.id }, orderBy: { date: "asc" }, select: { date: true } });
    const from = first ? isoDate(first.date).slice(0, 7) : current;
    return monthsBetween(from < current ? from : current, current);
  }

  defaultRange(user: AuthUser): StatsRange {
    const to = this.currentMonth(user);
    return { from: shiftMonth(to, -5), to };
  }

  private normalizeRange(user: AuthUser, range: Partial<StatsRange>): StatsRange {
    const current = this.currentMonth(user);
    let { from, to } = range;
    if (!from || !to || !isMonth(from) || !isMonth(to)) return this.defaultRange(user);
    if (from > to) [from, to] = [to, from];
    if (to > current) to = current;
    if (from > to) from = to;
    return { from, to };
  }

  async statistics(user: AuthUser, input: Partial<StatsRange>): Promise<StatsOverview> {
    const range = this.normalizeRange(user, input);
    const months = monthsBetween(range.from, range.to);
    const span = monthSpan(range.from, range.to);
    const [at, totals, count, byCategory, categories, top] = await Promise.all([
      this.monthlyRows(user.id, range.from, range.to),
      this.totals(user.id, span),
      this.prisma.transaction.count({ where: { userId: user.id, status: "confirmed", date: span } }),
      this.expenseByCategory(user.id, span),
      this.categories(user.id),
      this.prisma.transaction.findMany({
        where: { userId: user.id, status: "confirmed", type: "expense", date: span },
        orderBy: [{ amount: "desc" }, { date: "desc" }, { id: "desc" }],
        take: 5,
        include: TX_INCLUDE,
      }),
    ]);
    return {
      range,
      totals,
      monthCount: months.length,
      transactionCount: count,
      trend: months.map((month) => ({ month, ...at(month) })),
      breakdown: breakdownFromTotals(byCategory, categories, range.to, 5),
      topExpenses: top.map(toTransactionView),
    };
  }

  /** So sánh chi theo danh mục giữa hai tháng: 5 danh mục lớn nhất (tính cả hai tháng) + "Khác" */
  async compare(user: AuthUser, monthA: string, monthB: string, maxRows = 5): Promise<MonthComparison> {
    if (!isMonth(monthA) || !isMonth(monthB)) throw badRequest("Tháng cần dạng yyyy-MM, ví dụ 2026-10.");
    const [a, b, totalsA, totalsB, categories] = await Promise.all([
      this.expenseByCategory(user.id, monthSpan(monthA, monthA)),
      this.expenseByCategory(user.id, monthSpan(monthB, monthB)),
      this.totals(user.id, monthSpan(monthA, monthA)),
      this.totals(user.id, monthSpan(monthB, monthB)),
      this.categories(user.id),
    ]);
    const merged = new Map<string, { a: number; b: number }>();
    for (const [id, v] of a) merged.set(id, { a: v, b: 0 });
    for (const [id, v] of b) merged.set(id, { a: merged.get(id)?.a ?? 0, b: v });
    return { monthA, monthB, totalsA, totalsB, rows: comparisonRows([...merged.entries()], categories, maxRows) };
  }
}
