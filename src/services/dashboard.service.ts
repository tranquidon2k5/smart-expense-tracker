import type { BudgetProgress, CategoryBreakdown, DashboardSummary, MonthlyTrendPoint } from "@/types";
import * as db from "./mock/db";
import { getScenario, simulateLatency } from "./mock/scenario";
import { buildBreakdown, confirmedTransactions, scopedTransactions, scopedWallets, shiftMonth, sumTotals } from "./mock/queries";
import { USE_API } from "./data-source";
import { getToday } from "./transaction.service";
import * as api from "./api/endpoints";

const CURRENT_MONTH = db.MOCK_TODAY.slice(0, 7);
const confirmed = confirmedTransactions;
const totals = sumTotals;

export function getCurrentMonth(): string {
  return USE_API ? getToday().slice(0, 7) : CURRENT_MONTH;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  if (USE_API) return api.dashboard.getDashboardSummary();
  await simulateLatency();
  const all = confirmed();
  const day = db.MOCK_TODAY.slice(8, 10);
  const prevMonth = shiftMonth(CURRENT_MONTH, -1);

  const current = totals(all.filter((t) => t.date.startsWith(CURRENT_MONTH)));
  const previousSamePeriod = totals(
    all.filter((t) => t.date.startsWith(prevMonth) && t.date.slice(8, 10) <= day),
  );

  const budgets = getScenario() === "empty" ? [] : db.budgets.filter((b) => b.month === CURRENT_MONTH);
  const budgetTotal = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const budgetSpent = budgets.reduce(
    (s, b) =>
      s +
      all
        .filter((t) => t.categoryId === b.categoryId && t.date.startsWith(CURRENT_MONTH))
        .reduce((x, t) => x + t.amount, 0),
    0,
  );

  return {
    month: CURRENT_MONTH,
    balance: scopedWallets().reduce((s, w) => s + w.balance, 0),
    current,
    previousSamePeriod,
    budgetTotal,
    budgetSpent,
  };
}

/** Thu/chi theo tháng, `months` tháng gần nhất (tính cả tháng hiện tại) */
export async function getMonthlyTrend(months = 6): Promise<MonthlyTrendPoint[]> {
  if (USE_API) return api.dashboard.getMonthlyTrend(months);
  await simulateLatency();
  const all = confirmed();
  const points: MonthlyTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = shiftMonth(CURRENT_MONTH, -i);
    const t = totals(all.filter((x) => x.date.startsWith(month)));
    if (t.income === 0 && t.expense === 0) continue;
    points.push({ month, ...t });
  }
  return points;
}

/** Cơ cấu chi theo danh mục: tối đa 4 lát + "Khác" (MASTER.md › Charts) */
export async function getCategoryBreakdown(maxSlices = 5): Promise<CategoryBreakdown> {
  if (USE_API) return api.dashboard.getCategoryBreakdown(maxSlices);
  await simulateLatency();
  const expenses = confirmed().filter((t) => t.type === "expense" && t.date.startsWith(CURRENT_MONTH));
  return buildBreakdown(expenses, CURRENT_MONTH, maxSlices);
}

/** Ngân sách tháng này, sắp xếp theo mức dùng giảm dần */
export async function getBudgetWatchlist(limit = 4): Promise<BudgetProgress[]> {
  if (USE_API) return api.dashboard.getBudgetWatchlist(limit);
  await simulateLatency();
  if (getScenario() === "empty") return [];
  const all = confirmed();
  return db.budgets
    .filter((b) => b.month === CURRENT_MONTH)
    .map((budget) => {
      const spent = all
        .filter((t) => t.categoryId === budget.categoryId && t.date.startsWith(CURRENT_MONTH))
        .reduce((s, t) => s + t.amount, 0);
      return {
        budget,
        category: db.categories.find((c) => c.id === budget.categoryId)!,
        spent,
        ratio: spent / budget.limitAmount,
      };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit);
}

export async function getPendingCount(): Promise<number> {
  if (USE_API) return api.dashboard.getPendingCount();
  await simulateLatency(200);
  return scopedTransactions().filter((t) => t.status === "pending").length;
}
