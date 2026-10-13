import { Injectable } from "@nestjs/common";
import { isMonth, shiftMonth } from "@shared/stats";
import type { Budget, BudgetOverview, BudgetRow } from "@shared/types";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { badRequest, notFound } from "../common/errors";
import { dbDate, money, toBudget, toCategory } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { GamificationService } from "../gamification/gamification.service";
import { TransactionsService, nextMonthStart } from "../transactions/transactions.service";

/** Hạn mức tối đa cho một danh mục (chặn gõ nhầm thêm số 0) */
export const BUDGET_MAX = 1_000_000_000;

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly gamification: GamificationService,
    private readonly transactions: TransactionsService,
  ) {}

  private month(user: AuthUser, month?: string): string {
    if (!month) return this.clock.today(user.timezone).slice(0, 7);
    if (!isMonth(month)) throw badRequest("Tháng cần dạng yyyy-MM, ví dụ 2026-10.", "month");
    return month;
  }

  /** Chi theo danh mục của các tháng [from, to] — một truy vấn GROUP BY */
  private async spentByMonth(userId: string, from: string, to: string) {
    const rows = await this.prisma.$queryRaw<{ month: string; category_id: string; total: bigint }[]>`
      SELECT to_char(date, 'YYYY-MM') AS month, category_id, SUM(amount)::bigint AS total
      FROM transactions
      WHERE user_id = ${userId} AND status = 'confirmed' AND type = 'expense'
        AND date >= ${dbDate(`${from}-01`)} AND date < ${dbDate(nextMonthStart(to))}
      GROUP BY 1, 2`;
    return (categoryId: string, month: string) => money(rows.find((r) => r.category_id === categoryId && r.month === month)?.total);
  }

  /** Ngân sách tháng: hạn mức đã đặt (mức dùng giảm dần) + danh mục chi chưa đặt, kèm chi TB 3 tháng trước */
  async overview(user: AuthUser, monthInput?: string): Promise<BudgetOverview> {
    const month = this.month(user, monthInput);
    const [budgets, categories, spent] = await Promise.all([
      this.prisma.budget.findMany({ where: { userId: user.id, month }, include: { category: true } }),
      this.prisma.category.findMany({
        where: { type: "expense", OR: [{ userId: null }, { userId: user.id }] },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      this.spentByMonth(user.id, shiftMonth(month, -3), month),
    ]);
    const avgLast3 = (categoryId: string) =>
      Math.round([1, 2, 3].reduce((s, i) => s + spent(categoryId, shiftMonth(month, -i)), 0) / 3 / 1000) * 1000;

    const rows: BudgetRow[] = budgets
      .map((b) => {
        const s = spent(b.categoryId, month);
        return {
          budget: toBudget(b),
          category: toCategory(b.category),
          spent: s,
          ratio: s / money(b.limitAmount),
          avgSpendLast3Months: avgLast3(b.categoryId),
        };
      })
      .sort((a, b) => b.ratio - a.ratio);

    const unbudgeted = categories
      .filter((c) => !budgets.some((b) => b.categoryId === c.id))
      .sort((a, b) => Number(a.userId !== null) - Number(b.userId !== null))
      .map((c) => ({ category: toCategory(c), spent: spent(c.id, month), avgSpendLast3Months: avgLast3(c.id) }));

    return {
      month,
      rows,
      unbudgeted,
      totalLimit: rows.reduce((s, r) => s + r.budget.limitAmount, 0),
      totalSpent: rows.reduce((s, r) => s + r.spent, 0),
    };
  }

  /** Đặt (tạo hoặc cập nhật) hạn mức tháng cho một danh mục chi */
  async set(user: AuthUser, categoryId: string, limitAmount: number, monthInput?: string): Promise<Budget> {
    const month = this.month(user, monthInput);
    if (!Number.isFinite(limitAmount) || limitAmount <= 0) throw badRequest("Hạn mức phải lớn hơn 0đ.", "limitAmount");
    if (limitAmount > BUDGET_MAX) throw badRequest("Hạn mức quá lớn, bạn kiểm tra lại số 0 nhé.", "limitAmount");
    return this.prisma.$transaction(async (db) => {
      const category = await this.transactions.categoryOrThrow(db, user.id, categoryId);
      if (category.type !== "expense") throw badRequest("Chỉ đặt ngân sách cho danh mục chi.", "categoryId");
      const limit = BigInt(Math.round(limitAmount));
      const budget = await db.budget.upsert({
        where: { userId_categoryId_month: { userId: user.id, categoryId, month } },
        create: { userId: user.id, categoryId, month, limitAmount: limit, createdAt: this.clock.now() },
        update: { limitAmount: limit },
      });
      // "Người lập kế hoạch": đủ 3 danh mục có ngân sách
      await this.gamification.evaluateBadges(db, user.id, this.clock.today(user.timezone));
      await this.transactions.checkBudgetAlert(db, user.id, categoryId, month);
      return toBudget(budget);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.prisma.budget.deleteMany({ where: { id, userId } });
    if (!deleted.count) throw notFound("Không tìm thấy ngân sách, có thể đã bị xoá.");
  }
}
