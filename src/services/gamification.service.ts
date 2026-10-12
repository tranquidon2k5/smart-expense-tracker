import type {
  AchievementsOverview,
  ActivityDay,
  GamificationStatus,
  MissionPeriod,
  MissionProgress,
  MotivationContext,
  User,
} from "@/types";
import * as db from "./mock/db";
import { badgeProgress, levelFromXp } from "./mock/queries";
import { failIfErrorScenario, getScenario, simulateLatency } from "./mock/scenario";

/** Số tuần hiển thị trên lịch nhiệt (≈ 6 tháng, khớp thời gian dùng app của bản demo) */
export const HEATMAP_WEEKS = 26;

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Thứ Hai của tuần chứa `iso` (lịch Việt Nam bắt đầu tuần từ thứ Hai) */
function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = CN
  return addDays(iso, -((wd + 6) % 7));
}

export async function getCurrentUser(): Promise<User> {
  await simulateLatency(150);
  return db.user;
}

export async function getGamificationStatus(): Promise<GamificationStatus> {
  await simulateLatency(300);
  return statusNow();
}

async function statusNow(): Promise<GamificationStatus> {
  const empty = getScenario() === "empty";
  const streak = empty
    ? { ...db.streak, currentStreak: 0, longestStreak: 0, lastActiveDate: null, freezeCount: 0 }
    : { ...db.streak };
  const { level, xpInLevel, xpForNextLevel } = levelFromXp(empty ? 0 : db.level.totalXp);
  return {
    streak,
    activeToday: !empty && db.session.activeToday,
    level,
    levelTitle: db.LEVEL_TITLES[level] ?? db.LEVEL_TITLES[10],
    xpInLevel,
    xpForNextLevel,
  };
}

function missionsOf(period: MissionPeriod): MissionProgress[] {
  const empty = getScenario() === "empty";
  return db.missions
    .filter((m) => m.period === period && m.isActive !== false)
    .map((mission) => {
      const um = db.userMissions.find((x) => x.missionId === mission.id);
      const progress = empty ? 0 : (um?.progress ?? 0);
      return { mission, progress, completed: progress >= mission.target };
    });
}

export async function getTodayMissions(): Promise<MissionProgress[]> {
  await simulateLatency();
  return missionsOf("daily");
}

/** Lịch nhiệt: mỗi ngày trong HEATMAP_WEEKS tuần gần nhất, tính tới hôm nay */
function activityDays(): ActivityDay[] {
  const empty = getScenario() === "empty";
  const counts = new Map<string, number>();
  if (!empty) for (const l of db.activityLogs) counts.set(l.date, (counts.get(l.date) ?? 0) + 1);
  const frozen = new Set(empty ? [] : db.freezeDays);
  const start = addDays(mondayOf(db.MOCK_TODAY), -(HEATMAP_WEEKS - 1) * 7);
  const days: ActivityDay[] = [];
  for (let d = start; d <= db.MOCK_TODAY; d = addDays(d, 1)) {
    days.push({ date: d, count: counts.get(d) ?? 0, frozen: frozen.has(d) });
  }
  return days;
}

/** Toàn bộ trang Thành tích: chuỗi, cấp độ, lịch nhiệt, nhiệm vụ, huy hiệu (F11–F14) */
export async function getAchievements(): Promise<AchievementsOverview> {
  await simulateLatency(450);
  failIfErrorScenario();
  const status = await statusNow();
  const empty = getScenario() === "empty";
  const nextDays = Object.keys(db.STREAK_MILESTONES)
    .map(Number)
    .find((d) => d > status.streak.currentStreak);
  return {
    status,
    nextMilestone: nextDays
      ? { days: nextDays, xp: db.STREAK_MILESTONES[nextDays], remaining: nextDays - status.streak.currentStreak }
      : null,
    nextLevelTitle: db.LEVEL_TITLES[status.level + 1] ?? db.LEVEL_TITLES[10],
    totalXp: empty ? 0 : db.level.totalXp,
    days: activityDays(),
    dailyMissions: missionsOf("daily"),
    weeklyMissions: missionsOf("weekly"),
    badges: db.badges.map((badge) => {
      const ub = empty ? undefined : db.userBadges.find((x) => x.badgeId === badge.id);
      const p = badgeProgress(badge);
      return {
        badge,
        unlockedAt: ub?.unlockedAt ?? null,
        progress: p && empty ? { current: 0, target: p.target } : p,
      };
    }),
  };
}

/** Chọn câu khích lệ theo ngữ cảnh và chèn biến (PRD §6.3) */
export async function getMotivation(): Promise<string> {
  await simulateLatency(300);
  const empty = getScenario() === "empty";
  const context: MotivationContext = empty
    ? "first_day"
    : db.session.activeToday
      ? "after_transaction"
      : "morning";
  // Luân phiên các câu đang bật theo ngày (PRD §6.3: ưu tiên câu chưa hiện gần đây để tránh lặp)
  const pool = db.motivationMessages.filter((m) => m.context === context && m.isActive);
  const dayIndex = Math.floor(Date.parse(`${db.MOCK_TODAY}T00:00:00Z`) / 86_400_000);
  const template = pool.length ? pool[dayIndex % pool.length].template : "Mỗi khoản bạn ghi là một bước hiểu túi tiền của mình hơn.";
  const firstName = db.user.fullName.split(" ").at(-1) ?? "";
  return template
    .replaceAll("{name}", firstName)
    .replaceAll("{streak}", String(db.streak.currentStreak))
    .replaceAll("{longest}", String(db.streak.longestStreak))
    .replaceAll("{amount}", "");
}
