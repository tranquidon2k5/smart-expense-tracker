/** Truy vấn nội bộ trên mock db, có áp kịch bản (?demo=empty). Chỉ services dùng. */
import type { Transaction, TransactionView, Wallet } from "@/types";
import * as db from "./db";
import { getScenario } from "./scenario";

export function scopedTransactions(): Transaction[] {
  return getScenario() === "empty" ? [] : db.transactions;
}

export function scopedWallets(): Wallet[] {
  return getScenario() === "empty"
    ? db.wallets.map((w) => ({ ...w, balance: 0 }))
    : db.wallets;
}

export function toView(t: Transaction): TransactionView {
  return {
    ...t,
    category: db.categories.find((c) => c.id === t.categoryId)!,
    wallet: db.wallets.find((w) => w.id === t.walletId)!,
  };
}

/** Ảnh hưởng của một giao dịch lên số dư ví (thu +, chi −) */
export function applyToWallet(t: Pick<Transaction, "walletId" | "type" | "amount">, sign: 1 | -1): void {
  const wallet = db.wallets.find((w) => w.id === t.walletId);
  if (wallet) wallet.balance += sign * (t.type === "income" ? t.amount : -t.amount);
}

export function addXp(amount: number): void {
  db.level.totalXp += amount;
}

/**
 * Ghi nhận hành động hợp lệ cho chuỗi ngày (PRD §6.2: thêm giao dịch, duyệt giao dịch chờ…).
 * Trả về true nếu đây là hành động đầu tiên trong ngày (chuỗi vừa tăng).
 */
export function recordActivity(): boolean {
  if (db.session.activeToday) return false;
  db.session.activeToday = true;
  db.streak.currentStreak += 1;
  db.streak.lastActiveDate = db.MOCK_TODAY;
  db.streak.longestStreak = Math.max(db.streak.longestStreak, db.streak.currentStreak);
  return true;
}

export function bumpMission(missionId: string, by = 1): void {
  const um = db.userMissions.find((m) => m.missionId === missionId);
  const mission = db.missions.find((m) => m.id === missionId);
  if (!um || !mission || um.progress >= mission.target) return;
  um.progress = Math.min(mission.target, um.progress + by);
  if (um.progress === mission.target) um.completedAt = new Date().toISOString();
}

export { normalize } from "@/lib/text";
