/**
 * Giai đoạn 3: ví, danh mục, giao dịch, luật, ngân sách, thống kê, nhập sao kê — chuyển từ
 * src/services/{transaction.service,pages-logic,import-stats}.test.ts sang chạy với API thật.
 */
import type TestAgent from "supertest/lib/agent";
import { guessMapping } from "@shared/csv-import";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LAN_EMAIL, TODAY, createTestApp, sampleCsv, type TestContext } from "./helpers";

let t: TestContext;
let lan: TestAgent;
beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(async () => {
  await t.reset();
  lan = await t.as(LAN_EMAIL);
});
afterAll(() => t.close());

const txByDesc = (description: string) => t.prisma.transaction.findFirstOrThrow({ where: { userId: "u-lan", description } });
const balance = async (id: string) => Number((await t.prisma.wallet.findUniqueOrThrow({ where: { id } })).balance);
const totalBalance = async () => Number((await t.prisma.wallet.aggregate({ where: { userId: "u-lan" }, _sum: { balance: true } }))._sum.balance);

async function addPending(id: string, description: string, categoryId: string) {
  await t.prisma.transaction.create({
    data: { id, userId: "u-lan", walletId: "w-tcb", categoryId, amount: 50_000n, type: "expense", date: new Date(`${TODAY}T00:00:00Z`), description, source: "csv", aiConfidence: 0.5, status: "pending" },
  });
}

describe("Luật từ khoá cho hàng chờ duyệt (Luồng 2)", () => {
  it("gợi ý từ khoá GRAB*RIDE (không phải GRAB) và không đếm GRAB*FOOD là giao dịch khớp", async () => {
    const ride = await txByDesc("GRAB*RIDE 8812 HCM");
    const result = (await lan.post(`/api/transactions/${ride.id}/review`).send({ categoryId: "c-move" }).expect(200)).body;
    expect(result.ruleSuggestion?.keyword).toBe("GRAB*RIDE");

    const preview = (await lan.post("/api/rules/preview").send({ keyword: "GRAB*RIDE", categoryId: "c-move", excludeId: ride.id }).expect(200)).body;
    const descriptions = preview.items.map((i: { transaction: { description: string } }) => i.transaction.description);
    expect(descriptions).toContain("GRAB*RIDE 1203 HCM");
    expect(descriptions).not.toContain("GRAB*FOOD 3021 HCM");
    expect(result.ruleSuggestion.matchingPendingCount).toBe(preview.applicableCount);
  });

  it("previewRule với từ khoá chung GRAB cảnh báo GRAB*FOOD đang ở danh mục khác", async () => {
    const preview = (await lan.post("/api/rules/preview").send({ keyword: "GRAB", categoryId: "c-move" }).expect(200)).body;
    const food = preview.items.find((i: { transaction: { description: string } }) => i.transaction.description === "GRAB*FOOD 3021 HCM");
    expect(food.transaction.categoryId).toBe("c-food");
    expect(food.conflict).toBe(true);
    expect(preview.conflictCount).toBeGreaterThanOrEqual(1);
  });

  it("createRule mặc định KHÔNG đổi giao dịch chờ duyệt khác", async () => {
    const { appliedCount } = (await lan.post("/api/rules").send({ keyword: "GRAB", categoryId: "c-move" }).expect(201)).body;
    expect(appliedCount).toBe(0);
    const food = await txByDesc("GRAB*FOOD 3021 HCM");
    expect([food.categoryId, food.status]).toEqual(["c-food", "pending"]);
  });

  it("createRule GRAB*RIDE có áp dụng đổi đúng các giao dịch trong bản xem trước, không chạm GRAB*FOOD", async () => {
    await addPending("t-test-ride", "GRAB*RIDE 4410 HCM", "c-food");
    const preview = (await lan.post("/api/rules/preview").send({ keyword: "GRAB*RIDE", categoryId: "c-move" }).expect(200)).body;
    const ids: string[] = preview.items.filter((i: { typeMismatch: boolean }) => !i.typeMismatch).map((i: { transaction: { id: string } }) => i.transaction.id);
    expect(ids).toContain("t-test-ride");

    const { appliedCount } = (await lan.post("/api/rules").send({ keyword: "GRAB*RIDE", categoryId: "c-move", applyToPending: true }).expect(201)).body;
    expect(appliedCount).toBe(preview.applicableCount);
    for (const id of ids) {
      const x = await t.prisma.transaction.findUniqueOrThrow({ where: { id } });
      expect([x.categoryId, x.status]).toEqual(["c-move", "confirmed"]);
    }
    const food = await txByDesc("GRAB*FOOD 3021 HCM");
    expect([food.categoryId, food.status]).toEqual(["c-food", "pending"]);
  });

  it("luật vừa tạo được dùng cho Ghi nhanh (luật người dùng chạy trước)", async () => {
    await lan.post("/api/rules").send({ keyword: "GRAB*RIDE", categoryId: "c-move" }).expect(201);
    const preview = (await lan.post("/api/ai/quick-entry/parse").send({ text: "grab*ride 35k" }).expect(200)).body;
    expect(preview.categoryId).toBe("c-move");
    expect(preview.confidence).toBeGreaterThanOrEqual(0.95);
  });
});

describe("Số dư ví đi cùng giao dịch (cùng transaction DB)", () => {
  it("thêm, sửa số tiền, đổi ví, đổi loại, xoá giao dịch đều cập nhật đúng số dư", async () => {
    const cash0 = await balance("w-cash");
    const momo0 = await balance("w-momo");
    const created = (await lan.post("/api/transactions").send({ walletId: "w-cash", categoryId: "c-food", amount: 50_000, date: TODAY, description: "Bún riêu" }).expect(201)).body;
    const id = created.transaction.id;
    expect(await balance("w-cash")).toBe(cash0 - 50_000);

    await lan.patch(`/api/transactions/${id}`).send({ amount: 80_000 }).expect(200);
    expect(await balance("w-cash")).toBe(cash0 - 80_000);

    await lan.patch(`/api/transactions/${id}`).send({ walletId: "w-momo" }).expect(200);
    expect(await balance("w-cash")).toBe(cash0);
    expect(await balance("w-momo")).toBe(momo0 - 80_000);

    // Chuyển sang danh mục thu → khoản thu cộng vào ví
    await lan.patch(`/api/transactions/${id}`).send({ categoryId: "c-income-other" }).expect(200);
    expect(await balance("w-momo")).toBe(momo0 + 80_000);

    await lan.post("/api/transactions/bulk-delete").send({ ids: [id] }).expect(200);
    expect(await balance("w-momo")).toBe(momo0);
  });

  it("sửa hàng loạt: đổi ví chuyển số dư; đổi danh mục khác loại thì bỏ qua", async () => {
    const tx = await t.prisma.transaction.findMany({ where: { userId: "u-lan", walletId: "w-cash", type: "expense" }, take: 3 });
    const moved = tx.reduce((s, x) => s + Number(x.amount), 0);
    const cash0 = await balance("w-cash");
    const tcb0 = await balance("w-tcb");
    const r = (await lan.post("/api/transactions/bulk-update").send({ ids: tx.map((x) => x.id), patch: { walletId: "w-tcb" } }).expect(200)).body;
    expect(r).toEqual({ updated: 3, skipped: 0 });
    expect(await balance("w-cash")).toBe(cash0 + moved);
    expect(await balance("w-tcb")).toBe(tcb0 - moved);
    const skip = (await lan.post("/api/transactions/bulk-update").send({ ids: tx.map((x) => x.id), patch: { categoryId: "c-salary" } }).expect(200)).body;
    expect(skip).toEqual({ updated: 0, skipped: 3 });
  });

  it("số tiền ≤ 0 bị từ chối, báo đúng ô", async () => {
    const res = await lan.post("/api/transactions").send({ walletId: "w-cash", categoryId: "c-food", amount: 0, date: TODAY, description: "x" }).expect(400);
    expect(res.body).toMatchObject({ field: "amount", message: "Số tiền phải lớn hơn 0đ." });
  });
});

describe("Chuyển tiền giữa ví (F02)", () => {
  it("trừ ví nguồn, cộng ví nhận, tổng số dư không đổi, có trong lịch sử", async () => {
    const before = await totalBalance();
    const vcb = await balance("w-vcb");
    const momo = await balance("w-momo");
    await lan.post("/api/transfers").send({ fromWalletId: "w-vcb", toWalletId: "w-momo", amount: 300_000, date: TODAY, note: "" }).expect(201);
    expect(await balance("w-vcb")).toBe(vcb - 300_000);
    expect(await balance("w-momo")).toBe(momo + 300_000);
    expect(await totalBalance()).toBe(before);
    const history = (await lan.get("/api/transfers?walletId=w-momo").expect(200)).body;
    expect(history[0]).toMatchObject({ amount: 300_000, fromWallet: { name: "Vietcombank" }, toWallet: { name: "MoMo" } });
  });

  it("từ chối khi số dư không đủ, cùng một ví, hoặc ngày trong tương lai", async () => {
    const cash = await balance("w-cash");
    const base = { fromWalletId: "w-cash", toWalletId: "w-momo", amount: 1, date: TODAY, note: "" };
    expect((await lan.post("/api/transfers").send({ ...base, amount: cash + 1 }).expect(400)).body.message).toMatch(/không đủ/);
    expect((await lan.post("/api/transfers").send({ ...base, toWalletId: "w-cash" }).expect(400)).body.message).toMatch(/khác nhau/);
    expect((await lan.post("/api/transfers").send({ ...base, date: "2026-10-13" }).expect(400)).body.message).toMatch(/sau hôm nay/);
  });

  it("ví kèm thu/chi tháng này", async () => {
    const list = (await lan.get("/api/wallets/summary").expect(200)).body;
    const vcb = list.find((w: { id: string }) => w.id === "w-vcb");
    expect(vcb.monthIncome).toBe(15_000_000);
    expect(vcb.transactionCount).toBeGreaterThan(0);
  });
});

describe("Danh mục (F03)", () => {
  const input = { name: "Mèo", type: "expense", icon: "PawPrint", color: "#A16207" };

  it("không trùng tên trong cùng loại (không phân biệt dấu/hoa thường); khác loại thì được", async () => {
    expect((await lan.post("/api/categories").send({ ...input, name: "an uong", icon: "Utensils", color: "#2563EB" }).expect(400)).body.message).toMatch(/Đã có/);
    await lan.post("/api/categories").send({ name: "Ăn uống", type: "income", icon: "Utensils", color: "#2563EB" }).expect(201);
  });

  it("chỉ nhận màu trong 8 màu danh mục", async () => {
    expect((await lan.post("/api/categories").send({ ...input, color: "#FF0000" }).expect(400)).body.message).toMatch(/màu/);
  });

  it("không xoá được danh mục mặc định", async () => {
    expect((await lan.delete("/api/categories/c-food").expect(400)).body.message).toMatch(/mặc định/);
  });

  it("xoá danh mục đang dùng: bắt chọn danh mục nhận, rồi chuyển hết giao dịch sang", async () => {
    const pet = (await lan.post("/api/categories").send(input).expect(201)).body;
    const tx = (await lan.post("/api/transactions").send({ walletId: "w-cash", categoryId: pet.id, amount: 90_000, date: TODAY, description: "Hạt cho mèo" }).expect(201)).body.transaction;
    expect((await lan.delete(`/api/categories/${pet.id}`).expect(400)).body.message).toMatch(/Chọn danh mục/);
    expect((await lan.delete(`/api/categories/${pet.id}?moveTo=c-salary`).expect(400)).body.message).toMatch(/cùng loại/);
    expect((await lan.delete(`/api/categories/${pet.id}?moveTo=c-other`).expect(200)).body).toEqual({ moved: 1 });
    expect((await t.prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })).categoryId).toBe("c-other");
  });

  it("danh sách kèm số giao dịch, số tiền tháng, có ngân sách", async () => {
    const usage = (await lan.get("/api/categories/usage").expect(200)).body;
    const food = usage.find((u: { category: { id: string } }) => u.category.id === "c-food");
    expect(food).toMatchObject({ isDefault: true, hasBudget: true });
    expect(food.transactionCount).toBeGreaterThan(100);
  });
});

describe("Ngân sách (F05)", () => {
  it("tổng quan tháng: hạn mức theo mức dùng giảm dần + danh mục chưa đặt kèm chi TB 3 tháng", async () => {
    const o = (await lan.get("/api/budgets?month=2026-10").expect(200)).body;
    expect(o.rows).toHaveLength(5);
    const ratios = o.rows.map((r: { ratio: number }) => r.ratio);
    expect(ratios).toEqual([...ratios].sort((a: number, b: number) => b - a));
    expect(o.unbudgeted.map((u: { category: { id: string } }) => u.category.id)).toContain("c-health");
    expect(o.rows[0].avgSpendLast3Months % 1000).toBe(0);
  });

  it("đặt hạn mức chỉ cho danh mục chi, chặn số quá lớn; ghi chi vượt 80% → cảnh báo một lần", async () => {
    expect((await lan.put("/api/budgets/c-salary").send({ limitAmount: 1_000_000 }).expect(400)).body.message).toMatch(/danh mục chi/);
    expect((await lan.put("/api/budgets/c-food").send({ limitAmount: 2_000_000_000 }).expect(400)).body.message).toMatch(/quá lớn/);
    // Đã chi 500.000đ cho Sức khoẻ tháng này → hạn mức 2 triệu mới dùng 25%
    await lan.put("/api/budgets/c-health").send({ limitAmount: 2_000_000 }).expect(200);
    const alerts = () => t.prisma.notification.count({ where: { userId: "u-lan", type: "budget_alert", title: { contains: "Sức khoẻ" } } });
    expect(await alerts()).toBe(0);
    await lan.post("/api/transactions").send({ walletId: "w-vcb", categoryId: "c-health", amount: 1_200_000, date: TODAY, description: "Khám răng" }).expect(201);
    expect(await alerts()).toBe(1); // 85%
    await lan.post("/api/transactions").send({ walletId: "w-cash", categoryId: "c-health", amount: 10_000, date: TODAY, description: "Thuốc" }).expect(201);
    expect(await alerts()).toBe(1); // vẫn trong mốc 80%, không nhắc lại
    await lan.post("/api/transactions").send({ walletId: "w-vcb", categoryId: "c-health", amount: 400_000, date: TODAY, description: "Thuốc bổ" }).expect(201);
    expect(await alerts()).toBe(2); // vượt 100%
  });
});

describe("Thống kê khớp trang Tổng quan", () => {
  it("tháng này: tổng thu/chi và cơ cấu danh mục giống hệt", async () => {
    const [summary, breakdown, stats] = await Promise.all([
      lan.get("/api/dashboard/summary"),
      lan.get("/api/dashboard/breakdown"),
      lan.get("/api/stats?from=2026-10&to=2026-10"),
    ]);
    expect(stats.body.totals).toEqual(summary.body.current);
    expect(stats.body.breakdown.slices).toEqual(breakdown.body.slices);
    expect(summary.body.balance).toBe(25_935_000);
  });

  it("6 tháng: xu hướng trùng với biểu đồ Tổng quan", async () => {
    const [trend, stats] = await Promise.all([lan.get("/api/dashboard/trend?months=6"), lan.get("/api/stats?from=2026-05&to=2026-10")]);
    expect(stats.body.trend.filter((p: { income: number; expense: number }) => p.income || p.expense)).toEqual(trend.body);
  });

  it("donut tối đa 5 lát, top 5 khoản chi giảm dần, so sánh hai tháng khớp tổng", async () => {
    const stats = (await lan.get("/api/stats?from=2026-05&to=2026-10")).body;
    expect(stats.breakdown.slices.length).toBeLessThanOrEqual(5);
    expect(stats.breakdown.slices.at(-1).name).toBe("Khác");
    const amounts = stats.topExpenses.map((x: { amount: number }) => x.amount);
    expect(amounts).toEqual([...amounts].sort((a: number, b: number) => b - a));
    expect(amounts).toHaveLength(5);
    const cmp = (await lan.get("/api/stats/compare?a=2026-09&b=2026-10")).body;
    expect(cmp.rows.reduce((s: number, r: { amountA: number }) => s + r.amountA, 0)).toBe(cmp.totalsA.expense);
    expect(cmp.rows.reduce((s: number, r: { amountB: number }) => s + r.amountB, 0)).toBe(cmp.totalsB.expense);
  });

  it("khoảng tháng sai/ngược được chuẩn hoá; tháng chọn được bắt đầu từ giao dịch đầu tiên", async () => {
    expect((await lan.get("/api/stats?from=2026-10&to=2026-08")).body.range).toEqual({ from: "2026-08", to: "2026-10" });
    expect((await lan.get("/api/stats?from=abc&to=2026-10")).body.range).toEqual({ from: "2026-05", to: "2026-10" });
    expect((await lan.get("/api/stats/months")).body).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  });

  it("giao dịch chờ duyệt không được tính vào thống kê", async () => {
    const before = (await lan.get("/api/dashboard/summary")).body.current.expense;
    await addPending("t-pending-x", "POS 9999", "c-food");
    expect((await lan.get("/api/dashboard/summary")).body.current.expense).toBe(before);
    expect((await lan.get("/api/transactions/pending/count")).body.count).toBe(9);
  });
});

describe("Nhập sao kê CSV (Luồng 2)", () => {
  it("file mẫu Techcombank: 8 giao dịch mới, 13 trùng; chia ghi thẳng / chờ duyệt", async () => {
    const parsed = sampleCsv("sao-ke-techcombank-10-2026.csv");
    const { mapping, amountMode } = guessMapping(parsed);
    expect(mapping).toEqual({ date: 0, amount: 3, description: 2 });
    const tcb0 = await balance("w-tcb");

    const result = (await lan.post("/api/import/csv").send({ file: parsed, mapping, amountMode, walletId: "w-tcb" }).expect(201)).body;
    expect(result.errors).toEqual([]);
    expect(result.duplicates).toHaveLength(13);
    expect(result.duplicates.filter((d: { reason: string }) => d.reason === "in_file").map((d: { matchLine: number }) => d.matchLine)).toEqual([21]);
    expect(result.created).toHaveLength(8);
    expect(result.confirmedCount).toBe(4);
    expect(result.pendingCount).toBe(4);

    const byDesc = Object.fromEntries(result.created.map((x: { description: string }) => [x.description, x]));
    expect(byDesc["PHUC LONG COFFEE NGUYEN TRAI"].categoryId).toBe("c-food");
    expect(byDesc["HOAN TIEN SHOPEE DON 2209931"]).toMatchObject({ type: "income", categoryId: "c-income-other", status: "confirmed" });
    expect(byDesc["WINMART+ 112 LE LOI"].status).toBe("pending");
    const delta = result.created.reduce((s: number, x: { type: string; amount: number }) => s + (x.type === "income" ? x.amount : -x.amount), 0);
    expect(await balance("w-tcb")).toBe(tcb0 + delta);

    const again = (await lan.post("/api/import/csv").send({ file: parsed, mapping, amountMode, walletId: "w-tcb" }).expect(201)).body;
    expect(again.created).toHaveLength(0);
    expect(again.duplicates).toHaveLength(21);
  });

  it("file có lỗi: chỉ rõ số dòng, vẫn nhập các dòng hợp lệ", async () => {
    const parsed = sampleCsv("sao-ke-co-loi.csv");
    const { mapping, amountMode } = guessMapping(parsed);
    const result = (await lan.post("/api/import/csv").send({ file: parsed, mapping, amountMode, walletId: "w-cash" }).expect(201)).body;
    expect(result.errors.map((e: { line: number; field: string }) => [e.line, e.field])).toEqual([
      [4, "date"],
      [5, "amount"],
      [6, "amount"],
      [8, "date"],
    ]);
    expect(result.created).toHaveLength(5);
  });

  it("ví không thuộc người dùng → 404; thiếu ánh xạ cột → 400", async () => {
    const parsed = sampleCsv("sao-ke-co-loi.csv");
    const { mapping, amountMode } = guessMapping(parsed);
    await lan.post("/api/import/csv").send({ file: parsed, mapping, amountMode, walletId: "w-khac" }).expect(404);
    await lan.post("/api/import/csv").send({ file: parsed, mapping: { ...mapping, amount: null }, amountMode, walletId: "w-cash" }).expect(400);
  });
});

describe("Đọc giao dịch", () => {
  it("lọc theo khoảng ngày, loại, ví, tìm không dấu; mới nhất trước; phân trang bằng cursor", async () => {
    const list = (await lan.get("/api/transactions?from=2026-10-01&to=2026-10-12&type=expense&walletIds=w-momo").expect(200)).body;
    expect(list.every((x: { date: string; type: string; walletId: string }) => x.date >= "2026-10-01" && x.type === "expense" && x.walletId === "w-momo")).toBe(true);
    const dates = list.map((x: { date: string }) => x.date);
    expect(dates).toEqual([...dates].sort().reverse());

    const found = (await lan.get(`/api/transactions/search?q=${encodeURIComponent("pho bo")}`).expect(200)).body;
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].description).toMatch(/Phở bò/);

    const page1 = await lan.get("/api/transactions?limit=10").expect(200);
    expect(page1.body).toHaveLength(10);
    const next = page1.headers["x-next-cursor"];
    const page2 = (await lan.get(`/api/transactions?limit=10&cursor=${next}`).expect(200)).body;
    expect(page2[0].id).not.toBe(page1.body[9].id);
  });

  it("giao dịch không tồn tại → 404 tiếng Việt", async () => {
    const res = await lan.get("/api/transactions/khong-co").expect(404);
    expect(res.body.message).toMatch(/Không tìm thấy giao dịch/);
  });
});
