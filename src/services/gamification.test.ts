import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuickEntryPreview } from "@/types";
import * as db from "./mock/db";
import { onCelebrate, type Celebration } from "./events";
import * as gamificationService from "./gamification.service";
import * as transactionService from "./transaction.service";

async function run<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

const preview: QuickEntryPreview = {
  rawText: "phở 45k",
  amount: 45_000,
  type: "expense",
  date: db.MOCK_TODAY,
  description: "Phở",
  categoryId: "c-food",
  confidence: 0.95,
  walletId: "w-cash",
};

describe("Chuỗi ngày & thành tích (F11–F14)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("chuỗi và kỷ lục được tính từ nhật ký hoạt động, khớp kịch bản demo", () => {
    expect(db.streak.currentStreak).toBe(13);
    expect(db.streak.longestStreak).toBe(15);
    const s = db.computeStreaks(
      new Set(["2026-01-01", "2026-01-02", "2026-01-04"]),
      new Set(["2026-01-03"]), // ngày đóng băng giữ chuỗi nhưng không cộng
      "2026-01-01",
      "2026-01-04",
    );
    expect(s).toEqual({ current: 3, longest: 3 });
  });

  it("ghi chép hôm nay → chuỗi 14, chạm mốc: +150 XP, thêm thẻ đóng băng, chúc mừng", async () => {
    const events: Celebration[] = [];
    const off = onCelebrate((c) => events.push(c));
    const xpBefore = db.level.totalXp;
    const freezeBefore = db.streak.freezeCount;

    const r = await run(transactionService.createFromQuickEntry(preview));
    off();

    expect(db.streak.currentStreak).toBe(14);
    expect(db.streak.freezeCount).toBe(Math.min(2, freezeBefore + 1)); // mỗi 7 ngày +1, tối đa 2
    const streakEvent = events.find((e) => e.kind === "streak");
    expect(streakEvent).toMatchObject({ title: "Chuỗi 14 ngày!", xp: 150 });
    // 10 XP ghi giao dịch + 150 XP mốc chuỗi
    expect(db.level.totalXp - xpBefore).toBe(r.xpGained + 150);
    // Giọng điệu tích cực
    expect(streakEvent!.description).toMatch(/Tuyệt vời/);
  });

  it("hành động thứ hai trong ngày không cộng chuỗi lần nữa", async () => {
    const before = db.streak.currentStreak;
    await run(transactionService.createFromQuickEntry({ ...preview, description: "Cà phê" }));
    expect(db.streak.currentStreak).toBe(before);
  });

  it("trang Thành tích: lịch nhiệt 26 tuần có ngày đóng băng, nhiệm vụ, huy hiệu kèm điều kiện", async () => {
    const a = await run(gamificationService.getAchievements());
    expect(a.days.at(-1)!.date).toBe(db.MOCK_TODAY);
    expect(a.days.length).toBeGreaterThan(gamificationService.HEATMAP_WEEKS * 7 - 7);
    expect(a.days.find((d) => d.date === "2026-10-04")).toMatchObject({ frozen: true, count: 0 });
    expect(a.dailyMissions.length).toBeGreaterThan(0);
    expect(a.weeklyMissions.length).toBeGreaterThan(0);
    expect(a.badges).toHaveLength(9);
    for (const b of a.badges) expect(b.badge.condition.length).toBeGreaterThan(0);
    const fire30 = a.badges.find((b) => b.badge.code === "FIRE_30")!;
    expect(fire30.unlockedAt).toBeNull();
    expect(fire30.progress).toEqual({ current: db.streak.longestStreak, target: 30 });
    expect(a.nextMilestone).toEqual({ days: 30, xp: 300, remaining: 30 - db.streak.currentStreak });
  });
});
