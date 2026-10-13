/**
 * Chuyển bản ghi Prisma → kiểu dùng chung ở shared/types (camelCase, tiền là number,
 * ngày "yyyy-MM-dd"). Mọi response đi qua đây nên frontend nhận đúng dạng như bản mock.
 */
import type * as S from "@shared/types";
import type * as P from "../../generated/prisma/client";

/** BIGINT tiền (đồng) → number: an toàn tới 9 triệu tỷ đồng */
export const money = (v: bigint | number | null | undefined): number => (v == null ? 0 : Number(v));

/** Cột DATE → "yyyy-MM-dd" */
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** "yyyy-MM-dd" → Date cho cột DATE (nửa đêm UTC) */
export const dbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export const isoDateTime = (d: Date): string => d.toISOString();

export function toUser(u: P.User): S.User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    currency: "VND",
    timezone: u.timezone,
    role: u.role,
    isLocked: u.isLocked,
    createdAt: isoDateTime(u.createdAt),
  };
}

export function toSession(u: Pick<P.User, "id" | "role" | "email" | "fullName" | "timezone">): S.AuthSession {
  return { userId: u.id, role: u.role, email: u.email, fullName: u.fullName, timezone: u.timezone };
}

export function toWallet(w: P.Wallet): S.Wallet {
  return { id: w.id, userId: w.userId, name: w.name, type: w.type, balance: money(w.balance) };
}

export function toCategory(c: P.Category): S.Category {
  return { id: c.id, userId: c.userId, name: c.name, type: c.type, icon: c.icon, color: c.color };
}

export function toTransaction(t: P.Transaction): S.Transaction {
  return {
    id: t.id,
    userId: t.userId,
    walletId: t.walletId,
    categoryId: t.categoryId,
    amount: money(t.amount),
    type: t.type,
    date: isoDate(t.date),
    description: t.description,
    source: t.source,
    aiConfidence: t.aiConfidence,
    status: t.status,
  };
}

export type TransactionWithRelations = P.Transaction & { category: P.Category; wallet: P.Wallet };

export const TX_INCLUDE = { category: true, wallet: true } as const;

export function toTransactionView(t: TransactionWithRelations): S.TransactionView {
  return { ...toTransaction(t), category: toCategory(t.category), wallet: toWallet(t.wallet) };
}

export function toBudget(b: P.Budget): S.Budget {
  return { id: b.id, userId: b.userId, categoryId: b.categoryId, month: b.month, limitAmount: money(b.limitAmount) };
}

export function toRule(r: P.ClassificationRule): S.ClassificationRule {
  return { id: r.id, userId: r.userId, keyword: r.keyword, categoryId: r.categoryId, createdFrom: r.createdFrom };
}

export function toTransfer(t: P.WalletTransfer): S.WalletTransfer {
  return {
    id: t.id,
    userId: t.userId,
    fromWalletId: t.fromWalletId,
    toWalletId: t.toWalletId,
    amount: money(t.amount),
    date: isoDate(t.date),
    note: t.note,
    createdAt: isoDateTime(t.createdAt),
  };
}

export function toNotification(n: P.Notification): S.AppNotification {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    ...(n.title ? { title: n.title } : {}),
    content: n.content,
    ...(n.link ? { link: n.link } : {}),
    isRead: n.isRead,
    createdAt: isoDateTime(n.createdAt),
  };
}

export function toMission(m: P.Mission): S.Mission {
  return { id: m.id, code: m.code, title: m.title, period: m.period, target: m.target, xp: m.xp, isActive: m.isActive };
}

export function toBadge(b: P.Badge): S.Badge {
  return { id: b.id, code: b.code, name: b.name, icon: b.icon, condition: b.condition };
}

export function toMotivation(m: P.MotivationMessage): S.MotivationMessage {
  return { id: m.id, context: m.context, template: m.template, isActive: m.isActive };
}

export function toStreak(s: P.UserStreak | null, userId: string): S.UserStreak {
  return {
    userId,
    currentStreak: s?.currentStreak ?? 0,
    longestStreak: s?.longestStreak ?? 0,
    lastActiveDate: s?.lastActiveDate ? isoDate(s.lastActiveDate) : null,
    freezeCount: s?.freezeCount ?? 0,
  };
}

export function toChatMessageView(m: P.ChatMessage): S.ChatMessageView {
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    toolCalls: (m.toolCalls as S.ChatToolCall[] | null) ?? [],
    sourceIds: m.sourceIds,
    // Cột refused của câu hỏi chỉ dùng để đếm huy hiệu; giao diện chỉ đánh dấu câu trả lời
    refused: m.role === "user" ? false : m.refused,
    createdAt: isoDateTime(m.createdAt),
  };
}
