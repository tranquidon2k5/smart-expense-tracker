import type { GamificationStatus, MissionProgress, MotivationContext, User } from "@/types";
import * as db from "./mock/db";
import { getScenario, simulateLatency } from "./mock/scenario";

/** XP cần để lên cấp n = 100 × n (PRD §6.4) */
function levelFromXp(totalXp: number) {
  let level = 1;
  let floor = 0;
  while (totalXp >= floor + 100 * (level + 1)) {
    floor += 100 * (level + 1);
    level += 1;
  }
  return { level, xpInLevel: totalXp - floor, xpForNextLevel: 100 * (level + 1) };
}

export async function getCurrentUser(): Promise<User> {
  await simulateLatency(150);
  return db.user;
}

export async function getGamificationStatus(): Promise<GamificationStatus> {
  await simulateLatency(300);
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

export async function getTodayMissions(): Promise<MissionProgress[]> {
  await simulateLatency();
  const empty = getScenario() === "empty";
  return db.missions
    .filter((m) => m.period === "daily")
    .map((mission) => {
      const um = db.userMissions.find((x) => x.missionId === mission.id);
      const progress = empty ? 0 : (um?.progress ?? 0);
      return { mission, progress, completed: progress >= mission.target };
    });
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
  const template = db.motivationMessages.find((m) => m.context === context && m.isActive)!.template;
  const firstName = db.user.fullName.split(" ").at(-1) ?? "";
  return template
    .replace("{name}", firstName)
    .replace("{streak}", String(db.streak.currentStreak))
    .replace("{longest}", String(db.streak.longestStreak));
}
