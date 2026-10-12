import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "@/types";
import * as db from "./mock/db";
import * as transactionService from "./transaction.service";

/** Các service giả lập độ trễ mạng bằng setTimeout — chạy nhanh bằng fake timers */
async function run<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

const find = (description: string) => db.transactions.find((t) => t.description === description)!;

/** Thêm một giao dịch chờ duyệt dạng sao kê CSV vào mock db */
function addPending(id: string, description: string, categoryId: string): Transaction {
  const t: Transaction = {
    id,
    userId: db.USER_ID,
    walletId: "w-tcb",
    categoryId,
    amount: 50_000,
    type: "expense",
    date: "2026-10-12",
    description,
    source: "csv",
    aiConfidence: 0.5,
    status: "pending",
  };
  db.transactions.push(t);
  return t;
}

describe("transactionService — luật từ khoá cho hàng chờ duyệt (Luồng 2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gợi ý từ khoá GRAB*RIDE (không phải GRAB) và không đếm GRAB*FOOD là giao dịch khớp", async () => {
    const ride = find("GRAB*RIDE 8812 HCM");
    const result = await run(transactionService.reviewTransaction(ride.id, "c-move"));
    expect(result.ruleSuggestion?.keyword).toBe("GRAB*RIDE");

    const preview = await run(transactionService.previewRule("GRAB*RIDE", "c-move", ride.id));
    const descriptions = preview.items.map((i) => i.transaction.description);
    expect(descriptions).toContain("GRAB*RIDE 1203 HCM");
    expect(descriptions).not.toContain("GRAB*FOOD 3021 HCM");
    expect(result.ruleSuggestion?.matchingPendingCount).toBe(preview.applicableCount);
  });

  it("previewRule với từ khoá chung GRAB cảnh báo GRAB*FOOD đang ở danh mục khác", async () => {
    const preview = await run(transactionService.previewRule("GRAB", "c-move"));
    const food = preview.items.find((i) => i.transaction.description === "GRAB*FOOD 3021 HCM");
    expect(food).toBeDefined();
    expect(food!.transaction.categoryId).toBe("c-food");
    expect(food!.conflict).toBe(true); // Ăn uống → Di chuyển: phải cảnh báo
    expect(preview.conflictCount).toBeGreaterThanOrEqual(1);
  });

  it("createRule mặc định KHÔNG đổi giao dịch chờ duyệt khác", async () => {
    const food = find("GRAB*FOOD 3021 HCM");
    const other = find("GRAB*RIDE 1203 HCM");
    const { appliedCount } = await run(transactionService.createRule("GRAB", "c-move"));
    expect(appliedCount).toBe(0);
    expect([food.categoryId, food.status]).toEqual(["c-food", "pending"]);
    expect([other.categoryId, other.status]).toEqual(["c-food", "pending"]);
  });

  it("createRule GRAB*RIDE có áp dụng đổi đúng các giao dịch trong bản xem trước, không chạm GRAB*FOOD", async () => {
    const extra = addPending("t-test-ride", "GRAB*RIDE 4410 HCM", "c-food");
    const food = find("GRAB*FOOD 3021 HCM");

    const preview = await run(transactionService.previewRule("GRAB*RIDE", "c-move"));
    const previewIds = preview.items.filter((i) => !i.typeMismatch).map((i) => i.transaction.id);
    expect(previewIds).toContain(extra.id);
    expect(previewIds).not.toContain(food.id);
    expect(preview.items.every((i) => i.conflict)).toBe(true); // đều đang là Ăn uống

    const { appliedCount } = await run(transactionService.createRule("GRAB*RIDE", "c-move", true));
    expect(appliedCount).toBe(preview.applicableCount);

    for (const id of previewIds) {
      const t = db.transactions.find((x) => x.id === id)!;
      expect([t.categoryId, t.status]).toEqual(["c-move", "confirmed"]);
    }
    expect([food.categoryId, food.status]).toEqual(["c-food", "pending"]);
  });

  it("luật vừa tạo được dùng cho Ghi nhanh (luật người dùng chạy trước)", async () => {
    const preview = await run(transactionService.parseQuickEntry("grab*ride 35k"));
    expect(preview.categoryId).toBe("c-move");
    expect(preview.confidence).toBeGreaterThanOrEqual(0.95);
  });
});
