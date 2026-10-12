import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuickEntryPreview, Transaction } from "@/types";
import * as db from "./mock/db";
import { awardXp, XP_RULES } from "./mock/queries";
import * as transactionService from "./transaction.service";

/** Các service giả lập độ trễ mạng bằng setTimeout — chạy nhanh bằng fake timers */
async function run<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

const preview = (i: number): QuickEntryPreview => ({
  rawText: `cà phê ${i}`,
  amount: 30_000,
  type: "expense",
  date: db.MOCK_TODAY,
  description: `Cà phê ${i}`,
  categoryId: "c-food",
  confidence: 0.95,
  walletId: "w-cash",
});

function addPending(i: number): Transaction {
  const t: Transaction = {
    id: `t-xp-pending-${i}`,
    userId: db.USER_ID,
    walletId: "w-tcb",
    categoryId: "c-food",
    amount: 20_000,
    type: "expense",
    date: db.MOCK_TODAY,
    description: `POS ${i} TEST`,
    source: "csv",
    aiConfidence: 0.5,
    status: "pending",
  };
  db.transactions.push(t);
  return t;
}

function resetXpCounters() {
  db.session.xpCounts = { date: db.MOCK_TODAY, add_transaction: 0, review: 0 };
}

describe("Giới hạn XP theo ngày (PRD §6.4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetXpCounters();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ghi giao dịch: chỉ 10 lần đầu được +10 XP, lần thứ 11–12 không cộng", async () => {
    const before = db.level.totalXp;
    const results = [];
    for (let i = 1; i <= 12; i++) results.push(await run(transactionService.createFromQuickEntry(preview(i))));

    expect(results.slice(0, 10).every((r) => r.xpGained === 10 && !r.xpLimitReached)).toBe(true);
    expect(results.slice(10).every((r) => r.xpGained === 0 && r.xpLimitReached)).toBe(true);
    expect(db.level.totalXp - before).toBe(10 * XP_RULES.add_transaction.xp); // 100 XP
  });

  it("vẫn lưu giao dịch khi đã chạm giới hạn XP (chỉ không cộng XP)", async () => {
    for (let i = 1; i <= 10; i++) await run(transactionService.createFromQuickEntry(preview(i)));
    const countBefore = db.transactions.length;
    const r = await run(transactionService.createFromQuickEntry(preview(99)));
    expect(r.xpLimitReached).toBe(true);
    expect(db.transactions.length).toBe(countBefore + 1);
  });

  it("duyệt giao dịch: chỉ 10 lần đầu được +5 XP", async () => {
    const pending = Array.from({ length: 12 }, (_, i) => addPending(i + 1));
    const before = db.level.totalXp;
    const results = [];
    for (const t of pending) results.push(await run(transactionService.reviewTransaction(t.id)));

    expect(results.slice(0, 10).every((r) => r.xpGained === 5 && !r.xpLimitReached)).toBe(true);
    expect(results.slice(10).every((r) => r.xpGained === 0 && r.xpLimitReached)).toBe(true);
    expect(db.level.totalXp - before).toBe(10 * XP_RULES.review.xp); // 50 XP
    // Giao dịch vẫn được duyệt dù không còn XP
    expect(pending.every((t) => t.status === "confirmed")).toBe(true);
  });

  it("hai loại giới hạn tính riêng: hết lượt ghi giao dịch vẫn còn lượt duyệt", async () => {
    for (let i = 1; i <= 10; i++) await run(transactionService.createFromQuickEntry(preview(i)));
    const t = addPending(100);
    const r = await run(transactionService.reviewTransaction(t.id));
    expect(r.xpGained).toBe(5);
    expect(r.xpLimitReached).toBe(false);
  });

  it("bộ đếm reset khi sang ngày mới", () => {
    for (let i = 0; i < 10; i++) awardXp("add_transaction", "2026-10-12");
    expect(awardXp("add_transaction", "2026-10-12").limitReached).toBe(true);
    const nextDay = awardXp("add_transaction", "2026-10-13");
    expect(nextDay).toEqual({ xp: 10, limitReached: false, countToday: 1 });
  });
});
