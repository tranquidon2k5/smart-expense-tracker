import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuickEntryPreview } from "@/types";
import * as db from "./mock/db";
import { rememberTransactionXp, revokeTransactionXp } from "./mock/queries";
import * as transactionService from "./transaction.service";

async function run<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

const preview = (description: string): QuickEntryPreview => ({
  rawText: description,
  amount: 40_000,
  type: "expense",
  date: db.MOCK_TODAY,
  description,
  categoryId: "c-food",
  confidence: 0.95,
  walletId: "w-cash",
});

/** Bỏ các khoản thưởng ngoài lề (mốc chuỗi, nhiệm vụ) để chỉ đo XP của từng giao dịch */
function isolate() {
  db.session.xpCounts = { date: db.MOCK_TODAY, add_transaction: 0, review: 0 };
  db.session.activeToday = true;
  for (const um of db.userMissions) um.progress = db.missions.find((m) => m.id === um.missionId)!.target;
}

describe("Xoá giao dịch trong ngày trừ lại XP (PRD §13.1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    isolate();
  });
  afterEach(() => vi.useRealTimers());

  it("ghi rồi xoá trong ngày → XP trở về như trước, báo đúng số XP đã trừ", async () => {
    const before = db.level.totalXp;
    const { transaction, xpGained } = await run(transactionService.createFromQuickEntry(preview("Trà sữa")));
    expect(xpGained).toBe(10);
    expect(db.level.totalXp).toBe(before + 10);

    const result = await run(transactionService.deleteTransactions([transaction.id]));
    expect(result).toEqual({ removed: 1, xpRemoved: 10 });
    expect(db.level.totalXp).toBe(before);
  });

  it("chỉ trừ đúng XP đã cộng cho giao dịch đó: giao dịch không được cộng XP (đã chạm giới hạn) thì không trừ", async () => {
    db.session.xpCounts.add_transaction = 10; // đã nhận đủ 10 lần hôm nay
    const before = db.level.totalXp;
    const { transaction, xpGained } = await run(transactionService.createFromQuickEntry(preview("Bánh mì")));
    expect(xpGained).toBe(0);
    const { xpRemoved } = await run(transactionService.deleteTransactions([transaction.id]));
    expect(xpRemoved).toBe(0);
    expect(db.level.totalXp).toBe(before);
  });

  it("xoá giao dịch có sẵn từ trước (không ghi hôm nay) thì không trừ XP", async () => {
    const before = db.level.totalXp;
    const old = db.transactions.find((t) => t.date === "2026-10-05")!;
    const { removed, xpRemoved } = await run(transactionService.deleteTransactions([old.id]));
    expect(removed).toBe(1);
    expect(xpRemoved).toBe(0);
    expect(db.level.totalXp).toBe(before);
  });

  it("XP cộng hôm trước, xoá hôm nay → không trừ", () => {
    rememberTransactionXp("t-yesterday", 10, "2026-10-11");
    const before = db.level.totalXp;
    expect(revokeTransactionXp("t-yesterday", "2026-10-12")).toBe(0);
    expect(db.level.totalXp).toBe(before);
  });

  it("không để tổng XP âm", () => {
    rememberTransactionXp("t-low", 10);
    db.level.totalXp = 3;
    expect(revokeTransactionXp("t-low")).toBe(3);
    expect(db.level.totalXp).toBe(0);
  });

  it("xoá xong được trả lại một lượt trong giới hạn 10 lần/ngày", async () => {
    db.session.xpCounts.add_transaction = 9;
    const { transaction } = await run(transactionService.createFromQuickEntry(preview("Lượt thứ 10")));
    expect(db.session.xpCounts.add_transaction).toBe(10);
    await run(transactionService.deleteTransactions([transaction.id]));
    expect(db.session.xpCounts.add_transaction).toBe(9);
    const again = await run(transactionService.createFromQuickEntry(preview("Ghi lại")));
    expect(again.xpGained).toBe(10);
  });

  it("chỉ trừ một lần dù xoá lặp lại cùng id", () => {
    rememberTransactionXp("t-twice", 10);
    db.level.totalXp = 500;
    expect(revokeTransactionXp("t-twice")).toBe(10);
    expect(revokeTransactionXp("t-twice")).toBe(0);
    expect(db.level.totalXp).toBe(490);
  });
});
