import type { Budget, BudgetOverview, BudgetRow, Transaction } from "@/types";
import * as db from "./mock/db";
import { scopedTransactions } from "./mock/queries";
import { failIfErrorScenario, getScenario, simulateLatency } from "./mock/scenario";
import { emitDataChanged } from "./events";

/** Hạn mức tối đa cho một danh mục (chặn gõ nhầm thêm số 0) */
export const BUDGET_MAX = 1_000_000_000;

const CURRENT_MONTH = db.MOCK_TODAY.slice(0, 7);

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function spentIn(list: Transaction[], categoryId: string, month: string): number {
  return list
    .filter((t) => t.status === "confirmed" && t.type === "expense" && t.categoryId === categoryId && t.date.startsWith(month))
    .reduce((s, t) => s + t.amount, 0);
}

function avgLast3(list: Transaction[], categoryId: string, month: string): number {
  const total = [1, 2, 3].reduce((s, i) => s + spentIn(list, categoryId, shiftMonth(month, -i)), 0);
  return Math.round(total / 3 / 1000) * 1000;
}

function scopedBudgets(): Budget[] {
  return getScenario() === "empty" ? [] : db.budgets;
}

export function getBudgetMonth(): string {
  return CURRENT_MONTH;
}

/** Ngân sách tháng: các hạn mức đã đặt (mức dùng giảm dần) + danh mục chi chưa đặt */
export async function getBudgetOverview(month = CURRENT_MONTH): Promise<BudgetOverview> {
  await simulateLatency(450);
  failIfErrorScenario();
  const txs = scopedTransactions();
  const budgets = scopedBudgets().filter((b) => b.month === month);
  const expenseCategories = db.categories.filter(
    (c) => c.type === "expense" && (c.userId === null || getScenario() !== "empty"),
  );

  const rows: BudgetRow[] = budgets
    .map((budget) => {
      const category = db.categories.find((c) => c.id === budget.categoryId)!;
      const spent = spentIn(txs, budget.categoryId, month);
      return {
        budget,
        category,
        spent,
        ratio: spent / budget.limitAmount,
        avgSpendLast3Months: avgLast3(txs, budget.categoryId, month),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);

  const unbudgeted = expenseCategories
    .filter((c) => !budgets.some((b) => b.categoryId === c.id))
    .map((category) => ({
      category,
      spent: spentIn(txs, category.id, month),
      avgSpendLast3Months: avgLast3(txs, category.id, month),
    }));

  return {
    month,
    rows,
    unbudgeted,
    totalLimit: rows.reduce((s, r) => s + r.budget.limitAmount, 0),
    totalSpent: rows.reduce((s, r) => s + r.spent, 0),
  };
}

function validateLimit(limitAmount: number) {
  if (!Number.isFinite(limitAmount) || limitAmount <= 0) throw new Error("Hạn mức phải lớn hơn 0đ.");
  if (limitAmount > BUDGET_MAX) throw new Error("Hạn mức quá lớn, bạn kiểm tra lại số 0 nhé.");
}

/** Đặt (tạo hoặc cập nhật) hạn mức tháng cho một danh mục chi */
export async function setBudget(categoryId: string, limitAmount: number, month = CURRENT_MONTH): Promise<Budget> {
  await simulateLatency(350);
  validateLimit(limitAmount);
  const category = db.categories.find((c) => c.id === categoryId);
  if (!category) throw new Error("Danh mục không tồn tại.");
  if (category.type !== "expense") throw new Error("Chỉ đặt ngân sách cho danh mục chi.");

  const existing = db.budgets.find((b) => b.categoryId === categoryId && b.month === month);
  if (existing) {
    existing.limitAmount = Math.round(limitAmount);
    emitDataChanged();
    return existing;
  }
  const budget: Budget = {
    id: `b-${Date.now()}`,
    userId: db.USER_ID,
    categoryId,
    month,
    limitAmount: Math.round(limitAmount),
  };
  db.budgets.push(budget);
  emitDataChanged();
  return budget;
}

export async function deleteBudget(budgetId: string): Promise<void> {
  await simulateLatency(300);
  const i = db.budgets.findIndex((b) => b.id === budgetId);
  if (i === -1) throw new Error("Không tìm thấy ngân sách, có thể đã bị xoá.");
  db.budgets.splice(i, 1);
  emitDataChanged();
}
