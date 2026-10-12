import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as adminService from "./admin.service";
import * as authService from "./auth.service";
import * as notificationService from "./notification.service";
import * as settingsService from "./settings.service";
import * as db from "./mock/db";
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD } from "./mock/accounts";

/** Chạy hết đồng hồ giả; gắn handler trước để lỗi không thành "unhandled rejection" */
async function run<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  );
  await vi.runAllTimersAsync();
  const r = await settled;
  if (!r.ok) throw r.e;
  return r.v;
}

const LAN = db.user.email;

beforeEach(() => vi.useFakeTimers());
afterEach(async () => {
  vi.useRealTimers();
  await authService.logout();
});

describe("Đăng nhập / đăng ký (F01)", () => {
  it("sai mật khẩu và email không tồn tại cho cùng một thông báo (không lộ tài khoản)", async () => {
    const a = await run(authService.login(LAN, "sai-mat-khau1")).catch((e: Error) => e.message);
    const b = await run(authService.login("khongco@example.com", DEMO_PASSWORD)).catch((e: Error) => e.message);
    expect(a).toBe(b);
  });

  it("tài khoản bị khoá không đăng nhập được", async () => {
    await run(authService.login(ADMIN_EMAIL, ADMIN_PASSWORD));
    const locked = (await run(adminService.listUsers())).find((u) => u.isLocked)!;
    await authService.logout();
    await expect(run(authService.login(locked.email, DEMO_PASSWORD))).rejects.toThrow(/bị khoá/);
  });

  it("đăng ký → sổ trống thật có ví Tiền mặt; đăng nhập lại Lan → dữ liệu mẫu trở lại", async () => {
    await run(authService.login(LAN, DEMO_PASSWORD));
    const lanCount = db.transactions.length;
    expect(lanCount).toBeGreaterThan(400);
    await authService.logout();
    await run(authService.register({ fullName: "Trần Minh", email: "minh.test@example.com", password: "abc12345" }));
    expect(authService.getSession()?.fullName).toBe("Trần Minh");
    expect(db.transactions).toHaveLength(0);
    expect(db.wallets.map((w) => w.name)).toEqual(["Tiền mặt"]);
    expect(db.user.fullName).toBe("Trần Minh");

    await authService.logout();
    await run(authService.login(LAN, DEMO_PASSWORD));
    expect(db.transactions).toHaveLength(lanCount);
    expect(db.user.email).toBe(LAN);
  });

  it("email đã có, mật khẩu yếu → lỗi gắn đúng ô", async () => {
    const dup = await run(authService.register({ fullName: "A B", email: LAN, password: "abc12345" })).catch((e) => e);
    expect(dup).toMatchObject({ field: "email" });
    const weak = await run(authService.register({ fullName: "A B", email: "moi@x.vn", password: "abcdefgh" })).catch((e) => e);
    expect(weak).toMatchObject({ field: "password" });
  });

  it("chỉ quay về đường dẫn nội bộ; người dùng thường không được đưa vào /quan-tri", () => {
    const user = { userId: "u", role: "user" as const, email: "", fullName: "" };
    expect(authService.safeNext("https://evil.example", user)).toBe("/");
    expect(authService.safeNext("//evil.example", user)).toBe("/");
    expect(authService.safeNext("/quan-tri", user)).toBe("/");
    expect(authService.safeNext("/ngan-sach", user)).toBe("/ngan-sach");
  });

  it("quên mật khẩu: mã sai bị từ chối, mã đúng đổi được mật khẩu", async () => {
    await run(authService.register({ fullName: "Quên Mật Khẩu", email: "quen@example.com", password: "cu123456" }));
    await authService.logout();
    await run(authService.requestPasswordReset("quen@example.com"));
    await expect(run(authService.resetPassword("quen@example.com", "000000", "moi123456"))).rejects.toThrow(/Mã chưa đúng/);
    await run(authService.resetPassword("quen@example.com", authService.DEMO_RESET_CODE, "moi123456"));
    await expect(run(authService.login("quen@example.com", "cu123456"))).rejects.toThrow();
    await run(authService.login("quen@example.com", "moi123456"));
  });
});

describe("Quản trị (F15)", () => {
  it("người dùng thường bị chặn ở mọi API quản trị", async () => {
    await run(authService.login(LAN, DEMO_PASSWORD));
    await expect(run(adminService.listUsers())).rejects.toThrow(adminService.ForbiddenError);
    await expect(run(adminService.getSystemStats())).rejects.toThrow(adminService.ForbiddenError);
  });

  it("không xoá được danh mục mặc định đang được dùng (kể cả khi admin đang nạp sổ trống)", async () => {
    await run(authService.login(ADMIN_EMAIL, ADMIN_PASSWORD));
    const food = (await run(adminService.listDefaultCategories())).find((c) => c.id === "c-food")!;
    expect(food.usage).toBeGreaterThan(0);
    await expect(run(adminService.deleteDefaultCategory("c-food"))).rejects.toThrow(/đang được dùng/);
  });

  it("danh mục mặc định admin thêm vẫn còn sau khi đổi sang tài khoản Lan", async () => {
    await run(authService.login(ADMIN_EMAIL, ADMIN_PASSWORD));
    const c = await run(adminService.saveDefaultCategory({ name: "Du lịch", type: "expense", icon: "Plane", color: "#0E7490" }));
    await authService.logout();
    await run(authService.login(LAN, DEMO_PASSWORD));
    expect(db.categories.some((x) => x.id === c.id)).toBe(true);
  });

  it("mỗi ngữ cảnh câu khích lệ còn ít nhất 1 câu bật; biến lạ bị từ chối", async () => {
    await run(authService.login(ADMIN_EMAIL, ADMIN_PASSWORD));
    await expect(run(adminService.setMotivationActive("mm-7", false))).rejects.toThrow(/ít nhất 1 câu/);
    await expect(
      run(adminService.saveMotivationMessage({ context: "morning", template: "Chào {ten}, hôm nay thế nào?", isActive: true })),
    ).rejects.toThrow(/\{ten\}/);
    expect(adminService.previewTemplate("Chào {name}! Chuỗi {streak} ngày")).toBe("Chào Lan! Chuỗi 12 ngày");
  });

  it("không tự khoá chính mình", async () => {
    await run(authService.login(ADMIN_EMAIL, ADMIN_PASSWORD));
    await expect(run(adminService.setUserLocked("u-admin", true))).rejects.toThrow(/tự khoá/);
  });
});

describe("Nhắc nhở & dữ liệu (§6.3, §8)", () => {
  it("nhắc đúng một lần sau giờ nhắc nếu chưa ghi; tắt nhắc nhở thì không nhắc", async () => {
    await run(authService.login(LAN, DEMO_PASSWORD));
    const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m);
    expect(notificationService.runReminderSchedule(at(19, 59))).toBeNull();
    const n = notificationService.runReminderSchedule(at(20, 0));
    expect(n?.content).toContain(`${db.streak.currentStreak} ngày`);
    expect(notificationService.runReminderSchedule(at(21, 0))).toBeNull();

    await run(authService.login(LAN, DEMO_PASSWORD)); // nạp lại sổ, chưa nhắc hôm nay
    await run(settingsService.updateReminder({ enabled: false, time: "20:00", email: false }));
    expect(notificationService.runReminderSchedule(at(22, 0))).toBeNull();
    await expect(run(notificationService.sendTestReminder())).rejects.toThrow(/đang tắt/);
  });

  it("chúc mừng được lưu vào trung tâm thông báo", async () => {
    await run(authService.login(LAN, DEMO_PASSWORD));
    const before = await run(notificationService.getUnreadCount());
    await run(settingsService.updateReminder({ enabled: true, time: "20:00", email: false }));
    await run(notificationService.sendTestReminder());
    expect(await run(notificationService.getUnreadCount())).toBe(before + 1);
    expect(await run(notificationService.markAllRead())).toBe(before + 1);
    expect(await run(notificationService.getUnreadCount())).toBe(0);
  });

  it("xuất dữ liệu ra CSV đúng số dòng; xoá toàn bộ cần gõ đúng cụm xác nhận", async () => {
    await run(authService.login(LAN, DEMO_PASSWORD));
    const data = await run(settingsService.exportAllData());
    const csv = settingsService.transactionsToCsv(data);
    expect(csv.split("\r\n")).toHaveLength(data.transactions.length + 1);
    await expect(run(settingsService.deleteAllData("xoa"))).rejects.toThrow();
    await run(settingsService.deleteAllData("xóa dữ liệu"));
    expect(db.transactions).toHaveLength(0);
    expect(db.user.email).toBe(LAN);
  });
});
