/** Phép tính thống kê thuần (F06) — đặc tả chung cho mock và backend */
import type { CategoryBreakdown, CategorySlice, MonthTotals, TransactionType } from "./types";

export const OTHER_COLOR = "#64748B";

export function sumTotals(list: readonly { type: TransactionType; amount: number }[]): MonthTotals {
  return list.reduce(
    (acc, t) => {
      acc[t.type] += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );
}

/** "2026-10", -1 → "2026-09" */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Danh sách tháng từ `from` tới `to` (tính cả hai đầu) */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 120; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

interface CategoryLike {
  id: string;
  name: string;
  color: string;
}

/** Cộng chi theo danh mục, giữ thứ tự xuất hiện đầu tiên */
export function totalsByCategory(expenses: readonly { categoryId: string; amount: number }[]): [string, number][] {
  const byCategory = new Map<string, number>();
  for (const t of expenses) byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
  return [...byCategory.entries()];
}

/**
 * Cơ cấu chi theo danh mục từ tổng tiền của từng danh mục: tối đa `maxSlices` lát,
 * quá thì gộp phần đuôi vào "Khác" (MASTER.md › Charts).
 */
export function breakdownFromTotals(
  totals: readonly (readonly [string, number])[],
  categories: readonly CategoryLike[],
  month: string,
  maxSlices = 5,
): CategoryBreakdown {
  const total = totals.reduce((s, [, v]) => s + v, 0);
  const sorted = [...totals].sort((a, b) => b[1] - a[1]);
  const head = sorted.length > maxSlices ? sorted.slice(0, maxSlices - 1) : sorted;
  const restAmount = sorted.slice(head.length).reduce((s, [, v]) => s + v, 0);

  const slices: CategorySlice[] = head.map(([id, amount]) => {
    const c = categories.find((x) => x.id === id);
    return { categoryId: id, name: c?.name ?? "Khác", color: c?.color ?? OTHER_COLOR, amount, percent: (amount / total) * 100 };
  });
  if (restAmount > 0) {
    slices.push({ categoryId: null, name: "Khác", color: OTHER_COLOR, amount: restAmount, percent: (restAmount / total) * 100 });
  }
  return { month, total, slices };
}

/** Bảng so sánh chi theo danh mục giữa hai tháng: `maxRows` dòng lớn nhất + "Khác" */
export function comparisonRows(
  byCategory: readonly (readonly [string, { a: number; b: number }])[],
  categories: readonly CategoryLike[],
  maxRows = 5,
) {
  const sorted = [...byCategory].sort((x, y) => y[1].a + y[1].b - (x[1].a + x[1].b));
  const head = sorted.length > maxRows + 1 ? sorted.slice(0, maxRows) : sorted;
  const rest = sorted.slice(head.length);
  const rows = head.map(([id, v]) => {
    const c = categories.find((x) => x.id === id);
    return { categoryId: id as string | null, name: c?.name ?? "Khác", color: c?.color ?? OTHER_COLOR, amountA: v.a, amountB: v.b };
  });
  if (rest.length) {
    rows.push({
      categoryId: null,
      name: "Khác",
      color: OTHER_COLOR,
      amountA: rest.reduce((s, [, v]) => s + v.a, 0),
      amountB: rest.reduce((s, [, v]) => s + v.b, 0),
    });
  }
  return rows;
}
