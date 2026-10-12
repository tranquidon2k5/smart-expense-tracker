import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dashboardService from "./dashboard.service";
import * as importService from "./import.service";
import * as statsService from "./stats.service";
import * as db from "./mock/db";
import { CsvFormatError, guessMapping } from "./csv-import";

async function run<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

function sampleFile(name: string) {
  const buf = readFileSync(new URL(`../../public/mau/${name}`, import.meta.url));
  return { name, size: buf.byteLength, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Thống kê khớp trang Tổng quan", () => {
  it("tháng này: tổng thu/chi và cơ cấu danh mục giống hệt", async () => {
    const month = dashboardService.getCurrentMonth();
    const [summary, breakdown, stats] = await run(
      Promise.all([
        dashboardService.getDashboardSummary(),
        dashboardService.getCategoryBreakdown(),
        statsService.getStatistics({ from: month, to: month }),
      ]),
    );
    expect(stats.totals).toEqual(summary.current);
    expect(stats.breakdown.slices).toEqual(breakdown.slices);
  });

  it("6 tháng: xu hướng trùng với biểu đồ Tổng quan", async () => {
    const [trend, stats] = await run(
      Promise.all([dashboardService.getMonthlyTrend(6), statsService.getStatistics(statsService.defaultRange())]),
    );
    expect(stats.trend.filter((p) => p.income || p.expense)).toEqual(trend);
  });

  it("donut tối đa 5 lát, top 5 khoản chi giảm dần, so sánh hai tháng khớp tổng", async () => {
    const stats = await run(statsService.getStatistics({ from: "2026-05", to: "2026-10" }));
    expect(stats.breakdown.slices.length).toBeLessThanOrEqual(5);
    expect(stats.breakdown.slices.at(-1)!.name).toBe("Khác");
    const amounts = stats.topExpenses.map((t) => t.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    expect(amounts).toHaveLength(5);

    const cmp = await run(statsService.compareMonths("2026-09", "2026-10"));
    expect(cmp.rows.reduce((s, r) => s + r.amountA, 0)).toBe(cmp.totalsA.expense);
    expect(cmp.rows.reduce((s, r) => s + r.amountB, 0)).toBe(cmp.totalsB.expense);
    const { income, expense } = stats.trend.at(-1)!;
    expect(cmp.totalsB).toEqual({ income, expense });
  });

  it("khoảng đảo ngược hoặc vượt tháng hiện tại được chỉnh lại", async () => {
    const stats = await run(statsService.getStatistics({ from: "2026-12", to: "2026-08" }));
    expect(stats.range).toEqual({ from: "2026-08", to: "2026-10" });
  });
});

describe("Nhập sao kê CSV (Luồng 2)", () => {
  it("file mẫu Techcombank: loại trùng, phân loại, chia ghi thẳng / chờ duyệt", async () => {
    const parsed = await run(importService.readCsvFile(sampleFile("sao-ke-techcombank-10-2026.csv")));
    const { mapping, amountMode } = guessMapping(parsed);
    expect(mapping).toEqual({ date: 0, amount: 3, description: 2 });
    expect(amountMode).toBe("signed");

    const before = db.transactions.length;
    const pendingBefore = db.transactions.filter((t) => t.status === "pending").length;
    const result = await run(importService.importTransactions({ file: parsed, mapping, amountMode, walletId: "w-tcb" }));

    expect(result.errors).toEqual([]);
    expect(result.duplicates).toHaveLength(13);
    expect(result.duplicates.filter((d) => d.reason === "in_file").map((d) => d.matchLine)).toEqual([21]);
    expect(result.created).toHaveLength(8);
    expect(result.confirmedCount).toBe(4);
    expect(result.pendingCount).toBe(4);
    expect(db.transactions.length).toBe(before + 8);
    expect(db.transactions.filter((t) => t.status === "pending").length).toBe(pendingBefore + 4);

    const byDesc = Object.fromEntries(result.created.map((t) => [t.description, t]));
    // Luật người dùng PHUC LONG → Ăn uống; hoàn tiền là khoản thu dù có chữ SHOPEE
    expect(byDesc["PHUC LONG COFFEE NGUYEN TRAI"].categoryId).toBe("c-food");
    expect(byDesc["HOAN TIEN SHOPEE DON 2209931"]).toMatchObject({ type: "income", categoryId: "c-income-other", status: "confirmed" });
    expect(byDesc["WINMART+ 112 LE LOI"].status).toBe("pending");

    // Nhập lại cùng file: mọi dòng đều trùng
    const again = await run(importService.importTransactions({ file: parsed, mapping, amountMode, walletId: "w-tcb" }));
    expect(again.created).toHaveLength(0);
    expect(again.duplicates).toHaveLength(21);
  });

  it("file có lỗi: chỉ rõ số dòng, vẫn nhập các dòng hợp lệ", async () => {
    const parsed = await run(importService.readCsvFile(sampleFile("sao-ke-co-loi.csv")));
    expect(parsed.delimiter).toBe(";");
    const { mapping, amountMode } = guessMapping(parsed);
    const result = await run(importService.importTransactions({ file: parsed, mapping, amountMode, walletId: "w-cash" }));
    expect(result.errors.map((e) => [e.line, e.field])).toEqual([
      [4, "date"],
      [5, "amount"],
      [6, "amount"],
      [8, "date"],
    ]);
    expect(result.created).toHaveLength(5);
  });

  it("từ chối file không phải CSV", async () => {
    const xlsx = { name: "sao-ke.xlsx", size: 100, arrayBuffer: async () => new ArrayBuffer(100) };
    await expect(importService.readCsvFile(xlsx)).rejects.toThrow(CsvFormatError);
    await expect(importService.readCsvFile(xlsx)).rejects.toThrow(/XLSX/);
  });
});
