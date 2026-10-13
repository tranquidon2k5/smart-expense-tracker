/**
 * Giai đoạn 6: chuỗi ngày, XP, nhiệm vụ, huy hiệu, job định kỳ (PRD §11.3) — chuyển từ
 * src/services/{gamification,xp-limit,xp-revoke}.test.ts. Thời điểm luôn truyền vào/đặt giả,
 * không phụ thuộc đồng hồ máy.
 */
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dbDate } from "../src/common/mappers";
import { GamificationService } from "../src/gamification/gamification.service";
import { LAN_EMAIL, TODAY, celebrations, createTestApp, totalXp, type TestContext } from "./helpers";

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

const preview = (i: number | string, extra: Record<string, unknown> = {}) => ({
  rawText: `cà phê ${i}`,
  amount: 30_000,
  type: "expense",
  date: TODAY,
  description: `Cà phê ${i}`,
  categoryId: "c-food",
  confidence: 0.95,
  walletId: "w-cash",
  ...extra,
});
const streakOf = (userId = "u-lan") => t.prisma.userStreak.findUniqueOrThrow({ where: { userId } });
const at = (iso: string) => t.clock.set(new Date(iso));

/** Chỉ đo XP của từng hành động: hôm nay đã ghi chép (không còn thưởng chuỗi), nhiệm vụ đã xong */
async function isolate() {
  await t.prisma.activityLog.create({ data: { userId: "u-lan", date: dbDate(TODAY), actionType: "add_transaction" } });
  const missions = await t.prisma.mission.findMany();
  for (const m of missions) {
    const periodKey = m.period === "daily" ? TODAY : "2026-W42";
    await t.prisma.userMission.upsert({
      where: { userId_missionId_periodKey: { userId: "u-lan", missionId: m.id, periodKey } },
      create: { userId: "u-lan", missionId: m.id, periodKey, progress: m.target },
      update: { progress: m.target },
    });
  }
  // Huy hiệu sắp mở (CHAT_10 9/10…) không ảnh hưởng vì các test này không hỏi trợ lý
}

async function addPending(i: number) {
  return t.prisma.transaction.create({
    data: { id: `t-xp-pending-${i}`, userId: "u-lan", walletId: "w-tcb", categoryId: "c-food", amount: 20_000n, type: "expense", date: dbDate(TODAY), description: `POS ${i} TEST`, source: "csv", aiConfidence: 0.5, status: "pending" },
  });
}

describe("Chuỗi ngày & thành tích (F11–F14)", () => {
  it("ghi chép hôm nay → chuỗi 14, chạm mốc: +150 XP, thêm thẻ đóng băng, chúc mừng qua header + thông báo", async () => {
    const xp0 = await totalXp(t.prisma, "u-lan");
    expect(await streakOf()).toMatchObject({ currentStreak: 13, longestStreak: 15, freezeCount: 1 });
    const res = await lan.post("/api/ai/quick-entry").send(preview(1)).expect(201);
    expect(res.body.streak).toMatchObject({ currentStreak: 14, freezeCount: 2 });
    expect(res.body.message).toMatch(/^Chuỗi 14 ngày rồi!/);
    const streakEvent = celebrations(res).find((c) => c.kind === "streak");
    expect(streakEvent).toMatchObject({ title: "Chuỗi 14 ngày!", xp: 150 });
    expect(streakEvent!.description).toMatch(/Tuyệt vời/);
    // 10 XP ghi giao dịch + 150 XP mốc chuỗi (nhiệm vụ "Ghi 3 giao dịch" chưa xong)
    expect(await totalXp(t.prisma, "u-lan")).toBe(xp0 + res.body.xpGained + 150);
    expect(await t.prisma.notification.count({ where: { userId: "u-lan", title: "Chuỗi 14 ngày! +150 XP" } })).toBe(1);
  });

  it("hành động thứ hai trong ngày không cộng chuỗi lần nữa", async () => {
    await lan.post("/api/ai/quick-entry").send(preview(1)).expect(201);
    const r = (await lan.post("/api/ai/quick-entry").send(preview(2)).expect(201)).body;
    expect(r.streak.currentStreak).toBe(14);
    expect(r.message).not.toMatch(/^Chuỗi/);
  });

  it("trang Thành tích: lịch nhiệt 26 tuần có ngày đóng băng, nhiệm vụ, huy hiệu kèm điều kiện", async () => {
    const a = (await lan.get("/api/gamification/achievements").expect(200)).body;
    expect(a.days.at(-1).date).toBe(TODAY);
    expect(a.days.length).toBeGreaterThan(26 * 7 - 7);
    expect(a.days.find((d: { date: string }) => d.date === "2026-10-04")).toMatchObject({ frozen: true, count: 0 });
    expect(a.dailyMissions.length).toBeGreaterThan(0);
    expect(a.weeklyMissions.length).toBeGreaterThan(0);
    expect(a.badges).toHaveLength(9);
    const fire30 = a.badges.find((b: { badge: { code: string } }) => b.badge.code === "FIRE_30");
    expect(fire30).toMatchObject({ unlockedAt: null, progress: { current: 15, target: 30 } });
    // Chuỗi 13 ngày → mốc kế tiếp 14 ngày
    expect(a.nextMilestone).toEqual({ days: 14, xp: 150, remaining: 1 });
    expect(a.status).toMatchObject({ level: 5, levelTitle: "Thủ quỹ chăm chỉ", activeToday: false });
  });

  it("câu khích lệ theo ngữ cảnh, chèn tên và chuỗi; cùng ngày ra cùng câu", async () => {
    const a = (await lan.get("/api/gamification/motivation").expect(200)).body.message;
    expect(a).toBe("Chào Lan! Chuỗi của bạn đang là 13 ngày, giữ lửa thêm hôm nay nhé.");
    expect((await lan.get("/api/gamification/motivation").expect(200)).body.message).toBe(a);
    expect(await t.prisma.motivationHistory.count({ where: { userId: "u-lan" } })).toBe(1);
  });

  it("“Hôm nay không chi tiêu” giữ chuỗi; mỗi ngày một lần; đã có khoản chi thì không dùng được", async () => {
    const s = (await lan.post("/api/gamification/no-spend-day").expect(201)).body;
    expect(s.streak.currentStreak).toBe(14);
    expect(s.activeToday).toBe(true);
    await lan.post("/api/gamification/no-spend-day").expect(400);
    await lan.post("/api/ai/quick-entry").send(preview(1)).expect(201);
    at("2026-10-13T09:00:00+07:00");
    await lan.post("/api/ai/quick-entry").send(preview(2, { date: "2026-10-13" })).expect(201);
    expect((await lan.post("/api/gamification/no-spend-day").expect(400)).body.message).toMatch(/đã có khoản chi/);
  });
});

describe("Đổi ngày, múi giờ, thẻ đóng băng, mất chuỗi (PRD §11.3)", () => {
  it("23:59 và 00:01 giờ Việt Nam là hai ngày khác nhau", async () => {
    at("2026-10-12T23:59:00+07:00");
    await lan.post("/api/ai/quick-entry").send(preview(1)).expect(201);
    await lan.post("/api/ai/quick-entry").send(preview(2)).expect(201);
    expect((await streakOf()).currentStreak).toBe(14);
    at("2026-10-13T00:01:00+07:00");
    await lan.post("/api/ai/quick-entry").send(preview(3, { date: "2026-10-13" })).expect(201);
    expect((await streakOf()).currentStreak).toBe(15);
  });

  it("cùng một thời điểm UTC, người ở UTC+7 và UTC−5 ghi vào hai ngày khác nhau", async () => {
    const make = async (email: string, timezone: string) => {
      const agent = request.agent(t.app.getHttpServer());
      await agent.post("/api/auth/register").send({ fullName: "Người thử", email, password: "abc12345" }).expect(201);
      await t.prisma.user.update({ where: { email }, data: { timezone } });
      return agent;
    };
    const vn = await make("vn@example.com", "Asia/Ho_Chi_Minh");
    const co = await make("co@example.com", "America/Bogota");
    at("2026-10-13T03:00:00Z"); // 10:00 13/10 ở Việt Nam, 22:00 12/10 ở Bogotá
    for (const [agent, expected] of [
      [vn, "2026-10-13"],
      [co, "2026-10-12"],
    ] as const) {
      const wallet = (await agent.get("/api/wallets").expect(200)).body[0];
      const p = (await agent.post("/api/ai/quick-entry/parse").send({ text: "ăn phở 40k" }).expect(200)).body;
      expect(p.date).toBe(expected);
      await agent.post("/api/ai/quick-entry").send({ ...p, walletId: wallet.id }).expect(201);
      const s = (await agent.get("/api/gamification/status").expect(200)).body;
      expect(s.streak).toMatchObject({ currentStreak: 1, lastActiveDate: expected });
    }
  });

  it("bỏ lỡ một ngày → tự dùng thẻ đóng băng, chuỗi giữ nguyên; bỏ lỡ tiếp khi hết thẻ → chuỗi về 0, kỷ lục giữ", async () => {
    at("2026-10-13T10:00:00+07:00"); // không ghi ngày 12/10
    const s1 = (await lan.get("/api/gamification/status").expect(200)).body;
    expect(s1.streak).toMatchObject({ currentStreak: 13, freezeCount: 0 });
    expect(await t.prisma.freezeUsage.count({ where: { userId: "u-lan", date: dbDate("2026-10-12") } })).toBe(1);
    // Gọi lại nhiều lần không dùng thêm thẻ
    await lan.get("/api/gamification/status").expect(200);
    expect(await t.prisma.freezeUsage.count({ where: { userId: "u-lan" } })).toBe(2);

    at("2026-10-15T10:00:00+07:00"); // tiếp tục bỏ 13/10 và 14/10
    const s2 = (await lan.get("/api/gamification/status").expect(200)).body;
    expect(s2.streak).toMatchObject({ currentStreak: 0, longestStreak: 15 });
    expect((await lan.get("/api/gamification/motivation").expect(200)).body.message).toMatch(/Kỷ lục 15 ngày/);
    const r = (await lan.post("/api/ai/quick-entry").send(preview(1, { date: "2026-10-15" })).expect(201)).body;
    expect(r.streak.currentStreak).toBe(1);
  });

  it("chuỗi tới mốc 14 ngày qua nhiều ngày liên tiếp (job chốt ngày chạy xen giữa)", async () => {
    const svc = t.app.get(GamificationService);
    await t.prisma.userStreak.update({ where: { userId: "u-lan" }, data: { currentStreak: 12, freezeCount: 0 } });
    at("2026-10-12T21:00:00+07:00");
    await lan.post("/api/ai/quick-entry").send(preview(1)).expect(201);
    expect((await streakOf()).currentStreak).toBe(13);
    await t.jobs.runAll(new Date("2026-10-13T00:05:00+07:00"));
    at("2026-10-13T08:00:00+07:00");
    const res = await lan.post("/api/ai/quick-entry").send(preview(2, { date: "2026-10-13" })).expect(201);
    expect(res.body.streak.currentStreak).toBe(14);
    expect(celebrations(res).find((c) => c.kind === "streak")?.xp).toBe(150);
    expect(svc).toBeDefined();
  });
});

describe("Giới hạn XP theo ngày (PRD §6.4)", () => {
  beforeEach(() => isolate());

  it("ghi giao dịch: chỉ 10 lần đầu được +10 XP, lần 11–12 không cộng nhưng vẫn lưu", async () => {
    const xp0 = await totalXp(t.prisma, "u-lan");
    const results = [];
    for (let i = 1; i <= 12; i++) results.push((await lan.post("/api/ai/quick-entry").send(preview(i)).expect(201)).body);
    expect(results.slice(0, 10).every((r) => r.xpGained === 10 && !r.xpLimitReached)).toBe(true);
    expect(results.slice(10).every((r) => r.xpGained === 0 && r.xpLimitReached)).toBe(true);
    expect(await totalXp(t.prisma, "u-lan")).toBe(xp0 + 100);
    // Seed không có giao dịch nào ngày 12/10 → đếm đúng 12 giao dịch vừa ghi
    expect(await t.prisma.transaction.count({ where: { userId: "u-lan", date: dbDate(TODAY) } })).toBe(12);
  });

  it("duyệt giao dịch: chỉ 10 lần đầu được +5 XP; vẫn duyệt được khi hết XP", async () => {
    const pending = [];
    for (let i = 1; i <= 12; i++) pending.push(await addPending(i));
    const xp0 = await totalXp(t.prisma, "u-lan");
    const results = [];
    for (const p of pending) results.push((await lan.post(`/api/transactions/${p.id}/review`).send({}).expect(200)).body);
    expect(results.slice(0, 10).every((r) => r.xpGained === 5 && !r.xpLimitReached)).toBe(true);
    expect(results.slice(10).every((r) => r.xpGained === 0 && r.xpLimitReached)).toBe(true);
    expect(await totalXp(t.prisma, "u-lan")).toBe(xp0 + 50);
    expect(await t.prisma.transaction.count({ where: { id: { in: pending.map((p) => p.id) }, status: "confirmed" } })).toBe(12);
  });

  it("hai loại giới hạn tính riêng: hết lượt ghi vẫn còn lượt duyệt", async () => {
    for (let i = 1; i <= 10; i++) await lan.post("/api/ai/quick-entry").send(preview(i)).expect(201);
    const p = await addPending(100);
    const r = (await lan.post(`/api/transactions/${p.id}/review`).send({}).expect(200)).body;
    expect(r).toMatchObject({ xpGained: 5, xpLimitReached: false });
  });

  it("bộ đếm reset khi sang ngày mới theo múi giờ người dùng", async () => {
    for (let i = 1; i <= 10; i++) await lan.post("/api/ai/quick-entry").send(preview(i)).expect(201);
    expect((await lan.post("/api/ai/quick-entry").send(preview(11)).expect(201)).body.xpLimitReached).toBe(true);
    at("2026-10-13T07:00:00+07:00");
    const next = (await lan.post("/api/ai/quick-entry").send(preview(12, { date: "2026-10-13" })).expect(201)).body;
    expect(next.xpGained).toBe(10);
  });
});

describe("Xoá giao dịch trong ngày trừ lại XP (PRD §13.1)", () => {
  beforeEach(() => isolate());

  it("ghi rồi xoá trong ngày → XP trở về như trước, báo đúng số XP đã trừ", async () => {
    const xp0 = await totalXp(t.prisma, "u-lan");
    const { transaction, xpGained } = (await lan.post("/api/ai/quick-entry").send(preview("Trà sữa")).expect(201)).body;
    expect(xpGained).toBe(10);
    const r = (await lan.post("/api/transactions/bulk-delete").send({ ids: [transaction.id] }).expect(200)).body;
    expect(r).toEqual({ removed: 1, xpRemoved: 10 });
    expect(await totalXp(t.prisma, "u-lan")).toBe(xp0);
  });

  it("giao dịch không được cộng XP (đã chạm giới hạn) thì xoá không trừ", async () => {
    for (let i = 1; i <= 10; i++) await lan.post("/api/ai/quick-entry").send(preview(i)).expect(201);
    const xp0 = await totalXp(t.prisma, "u-lan");
    const { transaction, xpGained } = (await lan.post("/api/ai/quick-entry").send(preview("Bánh mì")).expect(201)).body;
    expect(xpGained).toBe(0);
    expect((await lan.post("/api/transactions/bulk-delete").send({ ids: [transaction.id] }).expect(200)).body.xpRemoved).toBe(0);
    expect(await totalXp(t.prisma, "u-lan")).toBe(xp0);
  });

  it("xoá giao dịch có sẵn từ trước, hoặc ghi hôm qua xoá hôm nay → không trừ", async () => {
    const xp0 = await totalXp(t.prisma, "u-lan");
    const old = await t.prisma.transaction.findFirstOrThrow({ where: { userId: "u-lan", date: dbDate("2026-10-05") } });
    expect((await lan.post("/api/transactions/bulk-delete").send({ ids: [old.id] }).expect(200)).body).toEqual({ removed: 1, xpRemoved: 0 });
    const { transaction } = (await lan.post("/api/ai/quick-entry").send(preview("Hôm qua")).expect(201)).body;
    at("2026-10-13T09:00:00+07:00");
    expect((await lan.post("/api/transactions/bulk-delete").send({ ids: [transaction.id] }).expect(200)).body.xpRemoved).toBe(0);
    expect(await totalXp(t.prisma, "u-lan")).toBe(xp0 + 10);
  });

  it("không để tổng XP âm; xoá xong được trả lại một lượt trong giới hạn 10 lần/ngày", async () => {
    for (let i = 1; i <= 9; i++) await lan.post("/api/ai/quick-entry").send(preview(i)).expect(201);
    const tenth = (await lan.post("/api/ai/quick-entry").send(preview(10)).expect(201)).body;
    expect(tenth.xpGained).toBe(10);
    await t.prisma.userLevel.update({ where: { userId: "u-lan" }, data: { totalXp: 3 } });
    expect((await lan.post("/api/transactions/bulk-delete").send({ ids: [tenth.transaction.id] }).expect(200)).body.xpRemoved).toBe(3);
    expect(await totalXp(t.prisma, "u-lan")).toBe(0);
    const again = (await lan.post("/api/ai/quick-entry").send(preview("Ghi lại")).expect(201)).body;
    expect(again.xpGained).toBe(10);
  });
});

describe("Job định kỳ (nhắc nhở, chốt ngày, ngân sách tốt, giữ lời hứa)", () => {
  it("20:00 giờ địa phương, hôm nay chưa ghi → đúng một nhắc nhở; chạy lại không tạo thêm", async () => {
    const reminders = () => t.prisma.notification.findMany({ where: { userId: "u-lan", type: "reminder", dedupeKey: { not: null } } });
    await t.jobs.runAll(new Date("2026-10-12T19:59:00+07:00"));
    expect(await reminders()).toHaveLength(0);
    const r1 = await t.jobs.runAll(new Date("2026-10-12T20:00:00+07:00"));
    expect(r1.reminders).toBe(1);
    await t.jobs.runAll(new Date("2026-10-12T20:15:00+07:00"));
    const list = await reminders();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ title: "Giữ chuỗi 13 ngày nhé", link: "/" });
    expect(list[0].content).toMatch(/giữ chuỗi 13 ngày/);
    // Thông báo hiện ở chuông
    const unread = (await lan.get("/api/notifications/unread-count").expect(200)).body.count;
    expect(unread).toBeGreaterThanOrEqual(3);
  });

  it("bật email → gửi thêm email; tắt nhắc nhở hoặc đã ghi chép hôm nay → không nhắc", async () => {
    await lan.patch("/api/me/reminder").send({ enabled: true, time: "20:00", email: true }).expect(200);
    const sent = t.mail.outbox.length;
    await t.jobs.runAll(new Date("2026-10-12T20:30:00+07:00"));
    expect(t.mail.outbox.length).toBe(sent + 1);
    expect(t.mail.outbox.at(-1)).toMatchObject({ to: LAN_EMAIL, subject: "Sổ Tiền: Giữ chuỗi 13 ngày nhé" });

    await t.reset();
    lan = await t.as(LAN_EMAIL);
    await lan.patch("/api/me/reminder").send({ enabled: false, time: "20:00", email: false }).expect(200);
    expect((await t.jobs.runAll(new Date("2026-10-12T21:00:00+07:00"))).reminders).toBe(0);
    await lan.patch("/api/me/reminder").send({ enabled: true, time: "20:00", email: false }).expect(200);
    await lan.post("/api/ai/quick-entry").send(preview(1)).expect(201);
    expect((await t.jobs.runAll(new Date("2026-10-12T21:00:00+07:00"))).reminders).toBe(0);
  });

  it("chốt ngày chạy lại nhiều lần vẫn ra cùng kết quả", async () => {
    const now = new Date("2026-10-14T00:10:00+07:00"); // bỏ lỡ 12/10 và 13/10, còn 1 thẻ
    await t.jobs.runAll(now);
    const a = await streakOf();
    await t.jobs.runAll(now);
    await t.jobs.runAll(new Date("2026-10-14T06:00:00+07:00"));
    const b = await streakOf();
    expect(b).toEqual(a);
    expect(a).toMatchObject({ currentStreak: 0, freezeCount: 0, longestStreak: 15 });
    expect(await t.prisma.freezeUsage.count({ where: { userId: "u-lan", date: dbDate("2026-10-12") } })).toBe(1);
  });

  it("job tạo sẵn nhiệm vụ ngày và tuần mới (thứ Hai sang tuần mới)", async () => {
    await t.jobs.runAll(new Date("2026-10-19T00:05:00+07:00"));
    const keys = (await t.prisma.userMission.findMany({ where: { userId: "u-lan" } })).map((m) => m.periodKey);
    expect(keys).toContain("2026-10-19");
    expect(keys).toContain("2026-W43");
  });

  it("Chủ nhật tối chi dưới 80% ngân sách → “Ngân sách tốt”; sang tháng mới không vượt hạn mức → “Giữ đúng lời hứa”", async () => {
    const agent = request.agent(t.app.getHttpServer());
    await agent.post("/api/auth/register").send({ fullName: "Người tiết kiệm", email: "tk@example.com", password: "abc12345" }).expect(201);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: "tk@example.com" } });
    const wallet = (await agent.get("/api/wallets").expect(200)).body[0];
    await agent.put("/api/budgets/c-food?month=2026-10").send({ limitAmount: 1_000_000 }).expect(200);
    await agent.post("/api/transactions").send({ walletId: wallet.id, categoryId: "c-food", amount: 100_000, date: TODAY, description: "Đi chợ" }).expect(201);

    await t.jobs.runAll(new Date("2026-10-18T20:30:00+07:00"));
    await t.jobs.runAll(new Date("2026-10-18T20:45:00+07:00"));
    expect(await t.prisma.notification.count({ where: { userId: user.id, title: "Ngân sách tốt" } })).toBe(1);

    await t.jobs.runAll(new Date("2026-11-01T00:15:00+07:00"));
    expect(await t.prisma.userBadge.count({ where: { userId: user.id, badgeId: "bd-promise" } })).toBe(1);
  });

  it("nhiều instance chạy cùng lúc: advisory lock để chỉ một instance xử lý", async () => {
    const [a, b] = await Promise.all([
      t.jobs.runAll(new Date("2026-10-12T20:00:00+07:00")),
      t.jobs.runAll(new Date("2026-10-12T20:00:00+07:00")),
    ]);
    expect(a.reminders + b.reminders).toBe(1);
  });
});
