/** Giai đoạn 2: JWT + refresh token xoay vòng, bcrypt, phân quyền ở server */
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_EMAIL, DEMO_PASSWORD, LAN_EMAIL, createTestApp, type TestContext } from "./helpers";

let t: TestContext;
beforeAll(async () => {
  t = await createTestApp();
});
beforeEach(() => t.reset());
afterAll(() => t.close());

const cookieOf = (res: request.Response, name: string) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${name}=`));

describe("Đăng ký / đăng nhập (F01)", () => {
  it("đăng ký → đăng nhập → /auth/me; sổ mới trống với một ví Tiền mặt", async () => {
    const agent = request.agent(t.app.getHttpServer());
    const reg = await agent.post("/api/auth/register").send({ fullName: "  Trần   Minh ", email: "Minh@Example.com", password: "abc12345" }).expect(201);
    expect(reg.body).toMatchObject({ fullName: "Trần Minh", email: "minh@example.com", role: "user" });
    expect(cookieOf(reg, "st_access")).toMatch(/HttpOnly/);
    expect(cookieOf(reg, "st_refresh")).toMatch(/HttpOnly/);

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.email).toBe("minh@example.com");
    expect((await agent.get("/api/transactions").expect(200)).body).toEqual([]);
    expect((await agent.get("/api/wallets").expect(200)).body.map((w: { name: string }) => w.name)).toEqual(["Tiền mặt"]);

    // Đăng xuất rồi đăng nhập lại bằng mật khẩu (đã băm bcrypt)
    await agent.post("/api/auth/logout").expect(204);
    await agent.get("/api/auth/me").expect(401);
    await agent.post("/api/auth/login").send({ email: "minh@example.com", password: "abc12345" }).expect(200);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: "minh@example.com" } });
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("email đã có, mật khẩu yếu → lỗi gắn đúng ô", async () => {
    const dup = await t.http().post("/api/auth/register").send({ fullName: "Lan", email: LAN_EMAIL, password: "abc12345" }).expect(409);
    expect(dup.body).toMatchObject({ field: "email", message: expect.stringMatching(/đã có tài khoản/) });
    const weak = await t.http().post("/api/auth/register").send({ fullName: "Lan", email: "moi@example.com", password: "abcdefgh" }).expect(400);
    expect(weak.body).toMatchObject({ field: "password", message: "Mật khẩu cần: có chữ số" });
  });

  it("sai mật khẩu và email không tồn tại cho cùng thông báo", async () => {
    const a = await t.http().post("/api/auth/login").send({ email: LAN_EMAIL, password: "sai-mat-khau1" }).expect(401);
    const b = await t.http().post("/api/auth/login").send({ email: "khongco@example.com", password: DEMO_PASSWORD }).expect(401);
    expect(a.body.message).toBe(b.body.message);
    expect(a.body.message).toMatch(/Email hoặc mật khẩu chưa đúng/);
  });

  it("tài khoản bị khoá → 403 với thông báo hiện có", async () => {
    await t.prisma.user.update({ where: { email: LAN_EMAIL }, data: { isLocked: true } });
    const res = await t.http().post("/api/auth/login").send({ email: LAN_EMAIL, password: DEMO_PASSWORD }).expect(403);
    expect(res.body.message).toMatch(/đang bị khoá/);
  });

  it("đăng nhập sai quá 5 lần trong 15 phút theo IP + email → 429", async () => {
    const attempt = () => t.http().post("/api/auth/login").send({ email: "thu.sai@example.com", password: "sai12345" });
    for (let i = 0; i < 5; i++) await attempt().expect(401);
    const blocked = await attempt().expect(429);
    expect(blocked.body.message).toMatch(/quá nhiều lần/);
    // Email khác cùng IP không bị chặn
    await t.http().post("/api/auth/login").send({ email: "nguoi.khac@example.com", password: "sai12345" }).expect(401);
  });
});

describe("Refresh token xoay vòng", () => {
  it("refresh cấp token mới; dùng lại token cũ bị từ chối và thu hồi cả họ token", async () => {
    const login = await t.http().post("/api/auth/login").send({ email: LAN_EMAIL, password: DEMO_PASSWORD }).expect(200);
    const oldRefresh = cookieOf(login, "st_refresh")!.split(";")[0];

    const first = await t.http().post("/api/auth/refresh").set("Cookie", oldRefresh).expect(200);
    const newRefresh = cookieOf(first, "st_refresh")!.split(";")[0];
    expect(newRefresh).not.toBe(oldRefresh);

    // Token cũ dùng lại → 401, và token mới cũng bị thu hồi theo
    await t.http().post("/api/auth/refresh").set("Cookie", oldRefresh).expect(401);
    await t.http().post("/api/auth/refresh").set("Cookie", newRefresh).expect(401);
  });

  it("access token hết hạn / sai chữ ký → 401", async () => {
    await t.http().get("/api/auth/me").set("Cookie", "st_access=abc.def.ghi").expect(401);
  });
});

describe("Quên mật khẩu", () => {
  it("luôn trả thành công kể cả email không tồn tại; mã gửi qua email, đặt lại được", async () => {
    await t.http().post("/api/auth/forgot-password").send({ email: "khongco@example.com" }).expect(204);
    await t.http().post("/api/auth/forgot-password").send({ email: LAN_EMAIL }).expect(204);
    const mail = t.mail.outbox.at(-1)!;
    expect(mail.to).toBe(LAN_EMAIL);
    const code = mail.subject.match(/(\d{6})/)![1];

    await t.http().post("/api/auth/reset-password").send({ email: LAN_EMAIL, code: code === "000000" ? "111111" : "000000", password: "moi12345" }).expect(400);
    await t.http().post("/api/auth/reset-password").send({ email: LAN_EMAIL, code, password: "moi12345" }).expect(204);
    await t.http().post("/api/auth/login").send({ email: LAN_EMAIL, password: "moi12345" }).expect(200);
    // Mã đã dùng không dùng lại được
    await t.http().post("/api/auth/reset-password").send({ email: LAN_EMAIL, code, password: "khac12345" }).expect(400);
  });

  it("mã hết hạn (sau 15 phút) bị từ chối", async () => {
    await t.http().post("/api/auth/forgot-password").send({ email: LAN_EMAIL }).expect(204);
    const code = t.mail.outbox.at(-1)!.subject.match(/(\d{6})/)![1];
    t.clock.set(new Date(t.clock.now().getTime() + 16 * 60_000));
    const res = await t.http().post("/api/auth/reset-password").send({ email: LAN_EMAIL, code, password: "moi12345" }).expect(400);
    expect(res.body).toMatchObject({ field: "code", message: expect.stringMatching(/hết hạn/) });
  });

  it("đổi mật khẩu cần đúng mật khẩu hiện tại", async () => {
    const lan = await t.as(LAN_EMAIL);
    const wrong = await lan.patch("/api/auth/password").send({ currentPassword: "sai", newPassword: "moi12345" }).expect(400);
    expect(wrong.body.field).toBe("currentPassword");
    await lan.patch("/api/auth/password").send({ currentPassword: DEMO_PASSWORD, newPassword: "moi12345" }).expect(200);
    await lan.get("/api/auth/me").expect(200);
  });
});

describe("Phân quyền ở server", () => {
  it("user A không đọc/sửa được dữ liệu của user B → 404 (không lộ id có tồn tại)", async () => {
    const other = request.agent(t.app.getHttpServer());
    await other.post("/api/auth/register").send({ fullName: "Người khác", email: "b@example.com", password: "abc12345" }).expect(201);
    const lanTx = await t.prisma.transaction.findFirstOrThrow({ where: { userId: "u-lan" } });

    await other.get(`/api/transactions/${lanTx.id}`).expect(404);
    await other.patch(`/api/transactions/${lanTx.id}`).send({ amount: 1 }).expect(404);
    await other.post(`/api/transactions/${lanTx.id}/review`).send({}).expect(404);
    const del = await other.post("/api/transactions/bulk-delete").send({ ids: [lanTx.id] }).expect(200);
    expect(del.body.removed).toBe(0);
    await other.delete("/api/budgets/b-food").expect(404);
    await other.patch("/api/wallets/w-vcb").send({ name: "Của tôi" }).expect(404);
    await other.get("/api/chat/conversations/cv-1").expect(404);
    expect(await t.prisma.transaction.count({ where: { id: lanTx.id } })).toBe(1);
  });

  it("user thường gọi /admin/* → 403; admin gọi được", async () => {
    const lan = await t.as(LAN_EMAIL);
    const res = await lan.get("/api/admin/users").expect(403);
    expect(res.body.message).toMatch(/không có quyền/);
    await lan.patch("/api/admin/users/u-lan").send({ isLocked: false }).expect(403);
    const admin = await t.as(ADMIN_EMAIL);
    await admin.get("/api/admin/users").expect(200);
  });

  it("admin khoá tài khoản → người đó bị chặn ngay ở lần gọi API kế tiếp", async () => {
    const lan = await t.as(LAN_EMAIL);
    await lan.get("/api/wallets").expect(200);
    const admin = await t.as(ADMIN_EMAIL);
    await admin.patch("/api/admin/users/u-lan").send({ isLocked: true }).expect(200);
    const blocked = await lan.get("/api/wallets").expect(401);
    expect(blocked.body.code).toBe("ACCOUNT_LOCKED");
    await lan.post("/api/auth/refresh").expect(401);
    // Không tự khoá chính mình
    await admin.patch("/api/admin/users/u-admin").send({ isLocked: true }).expect(400);
  });

  it("không có cookie → 401 cho route cần đăng nhập", async () => {
    await t.http().get("/api/dashboard/summary").expect(401);
  });
});
