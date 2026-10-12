import type {
  BudgetProgress,
  CategoryBreakdown,
  CategorySlice,
  DashboardSummary,
  MonthlyTrendPoint,
  MonthTotals,
  Transaction,
} from "@/types";
import * as db from "./mock/db";
import { getScenario, simulateLatency } from "./mock/scenario";
import { scopedTransactions, scopedWallets } from "./mock/queries";

const CURRENT_MONTH = db.MOCK_TODAY.slice(0, 7);

/** Chỉ tính giao dịch đã xác nhận; giao dịch chờ duyệt chưa vào thống kê */
function confirmed(): Transaction[] {
  return scopedTransactions().filter((t) => t.status === "confirmed");
}

function totals(list: Transaction[]): MonthTotals {
  return list.reduce(
    (acc, t) => {
      acc[t.type] += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function getCurrentMonth(): string {
  return CURRENT_MONTH;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
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
  await simulateLatency();
  const expenses = confirmed().filter((t) => t.type === "expense" && t.date.startsWith(CURRENT_MONTH));
  const byCategory = new Map<string, number>();
  for (const t of expenses) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);

  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.length > maxSlices ? sorted.slice(0, maxSlices - 1) : sorted;
  const restAmount = sorted.slice(head.length).reduce((s, [, v]) => s + v, 0);

  const slices: CategorySlice[] = head.map(([id, amount]) => {
    const c = db.categories.find((x) => x.id === id)!;
    return { categoryId: id, name: c.name, color: c.color, amount, percent: (amount / total) * 100 };
  });
  if (restAmount > 0) {
    slices.push({ categoryId: null, name: "Khác", color: "#64748B", amount: restAmount, percent: (restAmount / total) * 100 });
  }
  return { month: CURRENT_MONTH, total, slices };
}

/** Ngân sách tháng này, sắp xếp theo mức dùng giảm dần */
export async function getBudgetWatchlist(limit = 4): Promise<BudgetProgress[]> {
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
  await simulateLatency(200);
  return scopedTransactions().filter((t) => t.status === "pending").length;
}
