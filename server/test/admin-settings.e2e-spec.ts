/** Trang quản trị (F15) và Cài đặt tài khoản (F01, PRD §8) — chuyển từ src/services/account-admin.test.ts */
import type TestAgent from "supertest/lib/agent";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_EMAIL, LAN_EMAIL, createTestApp, type TestContext } from "./helpers";

let t: TestContext;
let admin: TestAgent;
let lan: TestAgent;
beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(async () => {
  await t.reset();
  admin = await t.as(ADMIN_EMAIL);
  lan = await t.as(LAN_EMAIL);
});
afterAll(() => t.close());

describe("Thống kê hệ thống tính thật từ dữ liệu", () => {
  it("đủ người dùng mẫu, tài khoản khoá, lượt gọi AI, 30 ngày", async () => {
    await t.reset({ minimal: false });
    admin = await t.as(ADMIN_EMAIL);
    const s = (await admin.get("/api/admin/stats").expect(200)).body;
    expect(s.totalUsers).toBe(39);
    expect(s.lockedUsers).toBe(2);
    expect(s.aiCalls30d).toBeGreaterThan(0);
    expect(s.aiSuccessRate).toBeGreaterThan(0.9);
    expect(s.aiByFeature.map((f: { feature: string }) => f.feature)).toEqual(["extract", "classify", "chat", "motivation"]);
    expect(s.daily).toHaveLength(30);
    expect(s.daily.at(-1).date).toBe("2026-10-12");
    expect(s.totalTransactions).toBe(await t.prisma.transaction.count());

    const users = (await admin.get("/api/admin/users").expect(200)).body;
    expect(users).toHaveLength(40);
    expect(users.find((u: { email: string }) => u.email === LAN_EMAIL)).toMatchObject({ currentStreak: 13, aiCalls: 412 });
  });
});

describe("Danh mục mặc định, câu khích lệ, nhiệm vụ, huy hiệu", () => {
  it("không xoá danh mục đang dùng; đổi tên được; thêm mới trùng tên bị chặn", async () => {
    expect((await admin.delete("/api/admin/categories/c-food").expect(400)).body.message).toMatch(/đang được dùng/);
    await admin.patch("/api/admin/categories/c-food").send({ name: "Ăn & uống", type: "expense", icon: "Utensils", color: "#2563EB" }).expect(200);
    expect((await lan.get("/api/categories?type=expense").expect(200)).body[0].name).toBe("Ăn & uống");
    expect((await admin.patch("/api/admin/categories/c-food").send({ name: "Ăn & uống", type: "income", icon: "Utensils", color: "#2563EB" }).expect(400)).body.message).toMatch(/không đổi được loại/);
    await admin.post("/api/admin/categories").send({ name: "di chuyen", type: "expense", icon: "Bike", color: "#7C3AED" }).expect(409);
    const created = (await admin.post("/api/admin/categories").send({ name: "Từ thiện", type: "expense", icon: "Gift", color: "#DB2777" }).expect(201)).body;
    await admin.delete(`/api/admin/categories/${created.id}`).expect(204);
  });

  it("mỗi ngữ cảnh phải còn ít nhất một câu đang bật; biến lạ bị từ chối", async () => {
    expect((await admin.patch("/api/admin/motivation/mm-1/active").send({ isActive: false }).expect(400)).body.message).toMatch(/ít nhất 1 câu/);
    expect((await admin.post("/api/admin/motivation").send({ context: "morning", template: "Chào {ten} nhé bạn ơi", isActive: true }).expect(400)).body.message).toMatch(/Biến không hỗ trợ/);
    await admin.post("/api/admin/motivation").send({ context: "morning", template: "Ngày mới vui vẻ {name}!", isActive: true }).expect(201);
    await admin.patch("/api/admin/motivation/mm-1/active").send({ isActive: false }).expect(204);
  });

  it("nhiệm vụ: giới hạn XP theo chu kỳ, không đổi chu kỳ, mã tự sinh không trùng", async () => {
    expect((await admin.post("/api/admin/missions").send({ title: "Ghi đủ 5 khoản", period: "daily", target: 5, xp: 60 }).expect(400)).body.message).toMatch(/5–50/);
    const m = (await admin.post("/api/admin/missions").send({ title: "Ghi đủ 5 khoản", period: "daily", target: 5, xp: 30 }).expect(201)).body;
    expect(m.code).toBe("GHI_DU_5_KHOAN");
    await admin.post("/api/admin/missions").send({ title: "Ghi đủ 5 khoản", period: "daily", target: 5, xp: 30 }).expect(409);
    await admin.patch(`/api/admin/missions/${m.id}`).send({ title: "Ghi đủ 5 khoản", period: "weekly", target: 5, xp: 30 }).expect(400);
    // Nhiệm vụ tắt thì không giao cho người dùng nữa
    await admin.patch(`/api/admin/missions/${m.id}`).send({ title: "Ghi đủ 5 khoản", period: "daily", target: 5, xp: 30, isActive: false }).expect(200);
    const daily = (await lan.get("/api/gamification/missions?period=daily").expect(200)).body;
    expect(daily.some((x: { mission: { id: string } }) => x.mission.id === m.id)).toBe(false);
  });

  it("huy hiệu: chỉ sửa tên/mô tả/icon; đếm người đã mở khoá thật", async () => {
    const list = (await admin.get("/api/admin/badges").expect(200)).body;
    expect(list.find((b: { code: string }) => b.code === "FIRST_STEP").unlockedUsers).toBe(1);
    const b = (await admin.patch("/api/admin/badges/bd-first").send({ name: "Khởi đầu", condition: "Ghi giao dịch đầu tiên", icon: "Footprints" }).expect(200)).body;
    expect(b).toMatchObject({ code: "FIRST_STEP", name: "Khởi đầu" });
  });
});

describe("Cài đặt tài khoản", () => {
  it("hồ sơ: email trùng tài khoản khác bị chặn; múi giờ/tiền tệ chỉ nhận giá trị hỗ trợ", async () => {
    expect((await lan.patch("/api/me/profile").send({ fullName: "Lan", email: ADMIN_EMAIL }).expect(409)).body.field).toBe("email");
    const u = (await lan.patch("/api/me/profile").send({ fullName: "Nguyễn Thị Lan", email: "LAN.MOI@example.com" }).expect(200)).body;
    expect(u.email).toBe("lan.moi@example.com");
    await lan.patch("/api/me/preferences").send({ currency: "USD", timezone: "Asia/Ho_Chi_Minh" }).expect(400);
    await lan.patch("/api/me/preferences").send({ currency: "VND", timezone: "Mars/Olympus" }).expect(400);
    await lan.patch("/api/me/preferences").send({ currency: "VND", timezone: "Asia/Tokyo" }).expect(204);
    expect((await lan.get("/api/me/settings").expect(200)).body.profile.timezone).toBe("Asia/Tokyo");
  });

  it("gửi thử nhắc nhở → +1 chưa đọc; đọc tất cả → 0; tắt nhắc nhở thì không gửi thử được", async () => {
    const before = (await lan.get("/api/notifications/unread-count")).body.count;
    await lan.post("/api/notifications/test-reminder").expect(201);
    expect((await lan.get("/api/notifications/unread-count")).body.count).toBe(before + 1);
    expect((await lan.post("/api/notifications/read-all").expect(200)).body.count).toBe(before + 1);
    expect((await lan.get("/api/notifications/unread-count")).body.count).toBe(0);
    await lan.patch("/api/me/reminder").send({ enabled: false, time: "20:00", email: false }).expect(200);
    expect((await lan.post("/api/notifications/test-reminder").expect(400)).body.message).toMatch(/đang tắt/);
    await lan.patch("/api/me/reminder").send({ enabled: true, time: "25:00", email: false }).expect(400);
  });

  it("xuất dữ liệu JSON và CSV đúng số dòng; xoá toàn bộ cần gõ đúng cụm xác nhận, giữ tài khoản", async () => {
    const data = (await lan.get("/api/me/export").expect(200)).body;
    expect(data.user.email).toBe(LAN_EMAIL);
    const csv = (await lan.get("/api/me/export?format=csv").expect(200)).text;
    expect(csv.split("\r\n")).toHaveLength(data.transactions.length + 1);
    expect(csv).toMatch(/Ăn uống/);

    await lan.delete("/api/me/data").send({ confirmation: "xoa" }).expect(400);
    await lan.delete("/api/me/data").send({ confirmation: "xóa dữ liệu" }).expect(204);
    expect(await t.prisma.transaction.count({ where: { userId: "u-lan" } })).toBe(0);
    expect((await lan.get("/api/wallets").expect(200)).body.map((w: { name: string }) => w.name)).toEqual(["Tiền mặt"]);
    expect((await lan.get("/api/auth/me").expect(200)).body.email).toBe(LAN_EMAIL);
    expect((await lan.get("/api/gamification/status").expect(200)).body.streak.currentStreak).toBe(0);
  });
});
