import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { budgetStatus } from "@/lib/budget-status";
import * as db from "./mock/db";
import * as categoryService from "./category.service";
import * as walletService from "./wallet.service";

/** Gắn handler trước khi chạy đồng hồ giả, tránh cảnh báo "unhandled rejection" */
async function expectRejects(promise: Promise<unknown>, message: RegExp) {
  const assertion = expect(promise).rejects.toThrow(message);
  await vi.runAllTimersAsync();
  await assertion;
}

async function run<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

describe("budgetStatus — ngưỡng cảnh báo F05", () => {
  it.each([
    [0, "ok"],
    [0.79, "ok"],
    [0.8, "warning"],
    [0.99, "warning"],
    [1, "warning"], // dùng hết nhưng chưa vượt
    [1.01, "over"],
  ])("tỉ lệ %s → %s", (ratio, level) => {
    expect(budgetStatus(ratio).level).toBe(level);
  });

  it("mỗi mức đều có nhãn chữ (không chỉ dựa vào màu)", () => {
    for (const r of [0.5, 0.9, 1.2]) expect(budgetStatus(r).label.length).toBeGreaterThan(0);
  });
});

describe("walletService.transfer — F02", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("chuyển tiền trừ ví nguồn, cộng ví nhận, tổng số dư không đổi", async () => {
    const total = () => db.wallets.reduce((s, w) => s + w.balance, 0);
    const before = total();
    const vcb = db.wallets.find((w) => w.id === "w-vcb")!.balance;
    const momo = db.wallets.find((w) => w.id === "w-momo")!.balance;
    await run(walletService.transfer({ fromWalletId: "w-vcb", toWalletId: "w-momo", amount: 300_000, date: db.MOCK_TODAY, note: "" }));
    expect(db.wallets.find((w) => w.id === "w-vcb")!.balance).toBe(vcb - 300_000);
    expect(db.wallets.find((w) => w.id === "w-momo")!.balance).toBe(momo + 300_000);
    expect(total()).toBe(before);
  });

  it("từ chối khi số dư không đủ, cùng một ví, hoặc ngày trong tương lai", () => {
    const cash = db.wallets.find((w) => w.id === "w-cash")!;
    const base = { fromWalletId: "w-cash", toWalletId: "w-momo", amount: 1, date: db.MOCK_TODAY, note: "" };
    expect(walletService.validateTransfer({ ...base, amount: cash.balance + 1 })).toMatch(/không đủ/);
    expect(walletService.validateTransfer({ ...base, toWalletId: "w-cash" })).toMatch(/khác nhau/);
    expect(walletService.validateTransfer({ ...base, date: "2026-10-13" })).toMatch(/sau hôm nay/);
    expect(walletService.validateTransfer(base)).toBeNull();
  });
});

describe("categoryService — F03", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("không cho trùng tên trong cùng loại (không phân biệt dấu/hoa thường)", () => {
    expect(categoryService.validateCategory({ name: "an uong", type: "expense", icon: "Utensils", color: "#2563EB" })).toMatch(/Đã có/);
    // Cùng tên nhưng khác loại thì được
    expect(categoryService.validateCategory({ name: "Ăn uống", type: "income", icon: "Utensils", color: "#2563EB" })).toBeNull();
  });

  it("chỉ nhận màu trong 8 màu danh mục của MASTER.md", () => {
    expect(categoryService.validateCategory({ name: "Mới", type: "expense", icon: "Gift", color: "#FF0000" })).toMatch(/màu/);
  });

  it("không xoá được danh mục mặc định", async () => {
    await expectRejects(categoryService.deleteCategory("c-food"), /mặc định/);
  });

  it("xoá danh mục đang dùng: bắt chọn danh mục nhận, rồi chuyển hết giao dịch sang", async () => {
    const pet = await run(categoryService.createCategory({ name: "Mèo", type: "expense", icon: "PawPrint", color: "#A16207" }));
    db.transactions.push({ ...db.transactions[0], id: "t-cat-test", categoryId: pet.id, type: "expense" });
    await expectRejects(categoryService.deleteCategory(pet.id), /Chọn danh mục/);
    await expectRejects(categoryService.deleteCategory(pet.id, "c-salary"), /cùng loại/);
    const { moved } = await run(categoryService.deleteCategory(pet.id, "c-other"));
    expect(moved).toBe(1);
    expect(db.transactions.find((t) => t.id === "t-cat-test")!.categoryId).toBe("c-other");
    expect(db.categories.some((c) => c.id === pet.id)).toBe(false);
  });
});
