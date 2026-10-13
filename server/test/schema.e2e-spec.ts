/** Giai đoạn 1: database 17 bảng PRD + bảng hỗ trợ, ràng buộc, seed, health */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestContext } from "./helpers";

let t: TestContext;
beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
});
afterAll(() => t.close());

const PRD_TABLES = [
  "users", "wallets", "categories", "transactions", "budgets", "classification_rules", "chat_messages", "ai_logs",
  "activity_logs", "user_streaks", "user_levels", "missions", "user_missions", "badges", "user_badges",
  "motivation_messages", "notifications",
];
const SUPPORT_TABLES = ["wallet_transfers", "conversations", "password_reset_tokens", "refresh_tokens", "freeze_usages", "motivation_history"];

describe("Schema PostgreSQL (PRD §10)", () => {
  it("có đủ 17 bảng chính và 6 bảng hỗ trợ", async () => {
    const rows = await t.prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const names = rows.map((r) => r.table_name);
    expect(PRD_TABLES.filter((n) => names.includes(n))).toHaveLength(17);
    for (const n of SUPPORT_TABLES) expect(names).toContain(n);
  });

  it("khoá ngoại: không tạo được giao dịch với ví không tồn tại", async () => {
    await expect(
      t.prisma.transaction.create({
        data: { userId: "u-lan", walletId: "khong-co", categoryId: "c-food", amount: 1000n, type: "expense", date: new Date("2026-10-12"), description: "x" },
      }),
    ).rejects.toThrow();
  });

  it("unique (user_id, category_id, month) cho budgets", async () => {
    await expect(
      t.prisma.budget.create({ data: { userId: "u-lan", categoryId: "c-food", month: "2026-10", limitAmount: 1n } }),
    ).rejects.toThrow();
  });

  it("tiền lưu BIGINT, ngày giao dịch là DATE", async () => {
    const cols = await t.prisma.$queryRaw<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'`;
    const type = (c: string) => cols.find((x) => x.column_name === c)?.data_type;
    expect(type("amount")).toBe("bigint");
    expect(type("date")).toBe("date");
    expect(type("created_at")).toBe("timestamp with time zone");
  });

  it("seed hai lần ra cùng dữ liệu (trừ chuỗi băm mật khẩu có salt ngẫu nhiên)", async () => {
    const snapshot = () =>
      t.prisma.$queryRaw<{ h: string }[]>`
        SELECT md5(string_agg(x::text, ',' ORDER BY x.id)) AS h FROM (
          SELECT id, amount, date, description, status FROM transactions
          UNION ALL SELECT id, NULL, date, action_type::text, NULL FROM activity_logs
          UNION ALL SELECT id, NULL, NULL, content, NULL FROM notifications
          UNION ALL SELECT id, NULL, NULL, content, NULL FROM chat_messages
        ) x`;
    const a = await snapshot();
    await t.reset();
    expect(await snapshot()).toEqual(a);
    expect(await t.prisma.transaction.count({ where: { userId: "u-lan" } })).toBeGreaterThan(400);
  });

  it("GET /api/health trả 200", async () => {
    const res = await t.http().get("/api/health").expect(200);
    expect(res.body).toEqual({ status: "ok", db: "ok" });
  });
});
