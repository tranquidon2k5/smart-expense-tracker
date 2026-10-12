import type { CategoryComparisonRow, MonthComparison, StatsOverview, StatsRange } from "@/types";
import * as db from "./mock/db";
import { failIfErrorScenario, simulateLatency } from "./mock/scenario";
import {
  OTHER_COLOR,
  buildBreakdown,
  confirmedTransactions,
  monthsBetween,
  scopedTransactions,
  shiftMonth,
  sumTotals,
  toView,
} from "./mock/queries";

/**
 * Thống kê (F06) tính trên đúng tập dữ liệu của trang Tổng quan: chỉ giao dịch đã xác nhận,
 * dùng chung hàm cộng tổng và chia danh mục → số liệu tháng này luôn khớp Tổng quan.
 */

const CURRENT_MONTH = db.MOCK_TODAY.slice(0, 7);

export function getCurrentMonth(): string {
  return CURRENT_MONTH;
}

/** Khoảng tháng có thể chọn: từ tháng có giao dịch đầu tiên tới tháng hiện tại */
export async function getAvailableMonths(): Promise<string[]> {
  await simulateLatency(150);
  failIfErrorScenario();
  const first = scopedTransactions().reduce((min, t) => (t.date < min ? t.date : min), db.MOCK_TODAY).slice(0, 7);
  return monthsBetween(first, CURRENT_MONTH);
}

/** Khoảng mặc định: 6 tháng gần nhất (giống biểu đồ xu hướng ở Tổng quan) */
export function defaultRange(): StatsRange {
  return { from: shiftMonth(CURRENT_MONTH, -5), to: CURRENT_MONTH };
}

function normalizeRange(range: StatsRange): StatsRange {
  const valid = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  let { from, to } = range;
  if (!valid(from) || !valid(to)) return defaultRange();
  if (from > to) [from, to] = [to, from];
  if (to > CURRENT_MONTH) to = CURRENT_MONTH;
  if (from > to) from = to;
  return { from, to };
}

export async function getStatistics(input: StatsRange): Promise<StatsOverview> {
  await simulateLatency(550);
  failIfErrorScenario();
  const range = normalizeRange(input);
  const months = monthsBetween(range.from, range.to);
  const inRange = confirmedTransactions().filter((t) => {
    const m = t.date.slice(0, 7);
    return m >= range.from && m <= range.to;
  });
  const expenses = inRange.filter((t) => t.type === "expense");

  return {
    range,
    totals: sumTotals(inRange),
    monthCount: months.length,
    transactionCount: inRange.length,
    trend: months.map((month) => ({ month, ...sumTotals(inRange.filter((t) => t.date.startsWith(month))) })),
    breakdown: buildBreakdown(expenses, range.to, 5),
    topExpenses: [...expenses]
      .sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(toView),
  };
}

/** So sánh chi theo danh mục giữa hai tháng: 5 danh mục lớn nhất (tính cả hai tháng) + "Khác" */
export async function compareMonths(monthA: string, monthB: string, maxRows = 5): Promise<MonthComparison> {
  await simulateLatency(450);
  failIfErrorScenario();
  const all = confirmedTransactions();
  const a = all.filter((t) => t.date.startsWith(monthA));
  const b = all.filter((t) => t.date.startsWith(monthB));

  const byCategory = new Map<string, { a: number; b: number }>();
  for (const [list, key] of [
    [a, "a"],
    [b, "b"],
  ] as const) {
    for (const t of list) {
      if (t.type !== "expense") continue;
      const row = byCategory.get(t.categoryId) ?? { a: 0, b: 0 };
      row[key] += t.amount;
      byCategory.set(t.categoryId, row);
    }
  }
  const sorted = [...byCategory.entries()].sort((x, y) => y[1].a + y[1].b - (x[1].a + x[1].b));
  const head = sorted.length > maxRows + 1 ? sorted.slice(0, maxRows) : sorted;
  const rest = sorted.slice(head.length);

  const rows: CategoryComparisonRow[] = head.map(([id, v]) => {
    const c = db.categories.find((x) => x.id === id)!;
    return { categoryId: id, name: c.name, color: c.color, amountA: v.a, amountB: v.b };
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
  return { monthA, monthB, totalsA: sumTotals(a), totalsB: sumTotals(b), rows };
}
