/**
 * Seed tất định: dùng lại bộ sinh dữ liệu của bản mock (src/services/mock) để backend có đúng
 * kịch bản demo của giao diện — persona Lan (~5 tháng dữ liệu, giao dịch chờ duyệt, luật,
 * ngân sách, huy hiệu), quản trị viên và 38 người dùng mẫu.
 *
 * Mọi ngày được dời theo `anchor` (ngày "hôm nay" của seed): anchor = 12/10/2026 cho ra dữ liệu
 * giống hệt mock; anchor = hôm nay giúp demo luôn có dữ liệu mới. Seed xoá sạch rồi tạo lại với
 * id cố định nên chạy hai lần vẫn ra cùng kết quả.
 */
import bcrypt from "bcrypt";
import { answerQuestion } from "@shared/assistant-engine";
import { addDays, daysBetween, isoWeekKey } from "@shared/dates";
import { levelFromXp } from "@shared/gamification-rules";
import { shiftMonth } from "@shared/stats";
import type { Transaction as SharedTransaction } from "@shared/types";
import * as mock from "../../src/services/mock/db";
import { ADMIN_PASSWORD, DEMO_PASSWORD, accounts } from "../../src/services/mock/accounts";
import type { Prisma, PrismaClient } from "../generated/prisma/client";

export const MOCK_TODAY = mock.MOCK_TODAY;
export const LAN_ID = mock.USER_ID;
export const LAN_EMAIL = mock.user.email;
export { ADMIN_PASSWORD, DEMO_PASSWORD };
export const ADMIN_EMAIL = "admin@sotien.vn";

const TABLES = [
  "motivation_history", "freeze_usages", "refresh_tokens", "password_reset_tokens", "chat_messages", "conversations",
  "wallet_transfers", "notifications", "user_badges", "user_missions", "user_levels", "user_streaks", "activity_logs",
  "ai_logs", "classification_rules", "budgets", "transactions", "wallets", "categories", "missions", "badges",
  "motivation_messages", "users",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Giờ Việt Nam → Date */
const vn = (iso: string, hh = 12, mm = 0, ss = 0) =>
  new Date(`${iso}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}+07:00`);

export interface SeedOptions {
  /** "Hôm nay" của bộ dữ liệu, mặc định 12/10/2026 (giống mock) */
  anchor?: string;
  bcryptCost?: number;
  /** Bỏ 38 người dùng mẫu + log AI (test chạy nhanh hơn) */
  minimal?: boolean;
}

export async function seedDatabase(prisma: PrismaClient, options: SeedOptions = {}) {
  const anchor = options.anchor ?? MOCK_TODAY;
  const offset = daysBetween(MOCK_TODAY, anchor);
  const day = (iso: string) => addDays(iso, offset);
  const at = (isoDateTime: string) => new Date(Date.parse(isoDateTime) + offset * 86_400_000);
  const monthOffset = (Number(anchor.slice(0, 4)) - 2026) * 12 + Number(anchor.slice(5, 7)) - 10;
  const cost = options.bcryptCost ?? 10;

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);

  // ───────────── Danh mục mặc định, nhiệm vụ, huy hiệu, câu khích lệ ─────────────
  const base = vn("2026-04-01", 8).getTime();
  await prisma.category.createMany({
    data: mock.categories
      .filter((c) => c.userId === null)
      .map((c, i) => ({ id: c.id, userId: null, name: c.name, type: c.type, icon: c.icon, color: c.color, createdAt: new Date(base + i * 1000) })),
  });
  await prisma.mission.createMany({
    data: mock.missions.map((m, i) => ({ ...m, isActive: m.isActive ?? true, createdAt: new Date(base + i * 1000) })),
  });
  await prisma.badge.createMany({ data: mock.badges.map((b) => ({ ...b, isActive: true })) });
  await prisma.motivationMessage.createMany({
    data: mock.motivationMessages.map((m, i) => ({ ...m, createdAt: new Date(base + i * 1000) })),
  });

  // ───────────── Tài khoản ─────────────
  const hashes = new Map<string, string>();
  const hash = async (pw: string) => {
    if (!hashes.has(pw)) hashes.set(pw, await bcrypt.hash(pw, cost));
    return hashes.get(pw)!;
  };
  const lanAccount = accounts.find((a) => a.user.id === LAN_ID)!;
  const adminAccount = accounts.find((a) => a.user.role === "admin")!;
  const others = options.minimal ? [] : accounts.filter((a) => a.user.id !== LAN_ID && a.user.role !== "admin");
  for (const a of [lanAccount, adminAccount, ...others]) {
    await prisma.user.create({
      data: {
        id: a.user.id,
        email: a.user.email,
        fullName: a.user.fullName,
        passwordHash: await hash(a.user.role === "admin" ? ADMIN_PASSWORD : DEMO_PASSWORD),
        timezone: a.user.timezone,
        role: a.user.role,
        isLocked: a.user.isLocked,
        reminderEnabled: mock.reminderSettings.enabled,
        reminderTime: mock.reminderSettings.time,
        reminderEmail: mock.reminderSettings.email,
        createdAt: at(a.user.createdAt),
        updatedAt: at(a.user.createdAt),
      },
    });
  }
  await prisma.userStreak.create({ data: { userId: adminAccount.user.id } });
  await prisma.userLevel.create({ data: { userId: adminAccount.user.id } });

  // ───────────── Lan ─────────────
  await prisma.category.createMany({
    data: mock.categories
      .filter((c) => c.userId !== null)
      .map((c, i) => ({ id: c.id, userId: LAN_ID, name: c.name, type: c.type, icon: c.icon, color: c.color, createdAt: vn("2026-05-02", 9, 0, i) })),
  });
  await prisma.wallet.createMany({
    data: mock.wallets.map((w, i) => ({ id: w.id, userId: LAN_ID, name: w.name, type: w.type, balance: BigInt(w.balance), createdAt: new Date(base + i * 1000) })),
  });
  const lanTx: SharedTransaction[] = mock.transactions.map((t) => ({ ...t, date: day(t.date) }));
  await prisma.transaction.createMany({
    data: lanTx.map((t, i) => ({
      id: t.id,
      userId: LAN_ID,
      walletId: t.walletId,
      categoryId: t.categoryId,
      amount: BigInt(t.amount),
      type: t.type,
      date: D(t.date),
      description: t.description,
      source: t.source,
      aiConfidence: t.aiConfidence,
      status: t.status,
      // Giờ tạo tăng dần theo thứ tự sinh → sắp "mới nhất trước" giống mock
      createdAt: vn(t.date, 8, Math.floor((i % 600) / 60), i % 60),
      updatedAt: vn(t.date, 8, Math.floor((i % 600) / 60), i % 60),
    })),
  });
  await prisma.walletTransfer.createMany({
    data: mock.transfers.map((t) => ({ ...t, amount: BigInt(t.amount), date: D(day(t.date)), createdAt: at(t.createdAt) })),
  });
  await prisma.classificationRule.createMany({
    data: mock.classificationRules.map((r, i) => ({ ...r, createdAt: vn("2026-09-01", 9, 0, i) })),
  });
  await prisma.budget.createMany({
    data: mock.budgets.map((b) => ({ ...b, month: shiftMonth(b.month, monthOffset), limitAmount: BigInt(b.limitAmount), createdAt: at("2026-10-01T09:00:00+07:00") })),
  });
  await prisma.activityLog.createMany({
    data: mock.activityLogs.map((l, i) => ({
      id: l.id,
      userId: LAN_ID,
      date: D(day(l.date)),
      actionType: l.actionType,
      xp: 0,
      createdAt: vn(day(l.date), 19, Math.floor(i % 60), 0),
    })),
  });
  await prisma.freezeUsage.createMany({ data: mock.freezeDays.map((d) => ({ userId: LAN_ID, date: D(day(d)) })) });
  const yesterday = addDays(anchor, -1);
  await prisma.userStreak.create({
    data: {
      userId: LAN_ID,
      currentStreak: mock.streak.currentStreak,
      longestStreak: mock.streak.longestStreak,
      lastActiveDate: D(yesterday),
      freezeCount: mock.streak.freezeCount,
      settledDate: D(yesterday),
    },
  });
  await prisma.userLevel.create({
    data: { userId: LAN_ID, totalXp: mock.level.totalXp, level: mock.level.level, aiCorrections: mock.session.corrections },
  });
  await prisma.userMission.createMany({
    data: mock.missions.map((m) => ({ userId: LAN_ID, missionId: m.id, periodKey: m.period === "daily" ? anchor : isoWeekKey(anchor), progress: 0 })),
  });
  await prisma.userBadge.createMany({ data: mock.userBadges.map((b) => ({ ...b, unlockedAt: at(b.unlockedAt) })) });
  await prisma.notification.createMany({
    data: mock.notifications.map((n) => ({
      id: n.id,
      userId: LAN_ID,
      type: n.type,
      title: n.title ?? null,
      content: n.content,
      link: n.link ?? null,
      isRead: n.isRead,
      createdAt: at(n.createdAt),
    })),
  });

  // Hội thoại mẫu: câu trả lời tính bằng engine trên chính dữ liệu đã seed (không viết tay số liệu)
  const ctx = {
    transactions: lanTx,
    categories: mock.categories.map((c) => ({ ...c })),
    budgets: mock.budgets.map((b) => ({ ...b, month: shiftMonth(b.month, monthOffset) })),
    today: anchor,
  };
  const sep = shiftMonth("2026-09", monthOffset);
  const aug = shiftMonth("2026-08", monthOffset);
  const mm = (m: string) => Number(m.slice(5, 7));
  const conversations = [
    {
      id: "cv-3",
      title: `Hỏi nhanh tháng ${mm(sep)}`,
      at: at("2026-09-28T21:00:00+07:00"),
      questions: [
        `Tháng ${mm(sep)} mình chi nhiều nhất vào đâu?`,
        `Tháng ${mm(sep)} tiêu di chuyển bao nhiêu?`,
        `Tháng ${mm(sep)} tổng thu chi thế nào?`,
        `Tháng ${mm(sep)} tiêu giải trí bao nhiêu?`,
        `So sánh mua sắm tháng ${mm(sep)} với tháng ${mm(aug)}`,
        `Tháng ${mm(aug)} tiêu ăn uống bao nhiêu?`,
      ],
    },
    {
      id: "cv-2",
      title: `Khoản chi lớn tháng ${mm(sep)}`,
      at: at("2026-10-05T12:20:00+07:00"),
      questions: [`5 khoản chi lớn nhất tháng ${mm(sep)}`],
    },
    {
      id: "cv-1",
      title: `Tiền ăn tháng ${mm(sep)} so với tháng ${mm(aug)}`,
      at: at("2026-10-11T21:05:00+07:00"),
      questions: [`Tháng ${mm(sep)} mình tiêu ăn uống bao nhiêu?`, `So sánh ăn uống tháng ${mm(sep)} với tháng ${mm(aug)}`],
    },
  ];
  for (const c of conversations) {
    await prisma.conversation.create({ data: { id: c.id, userId: LAN_ID, title: c.title, createdAt: c.at, updatedAt: c.at } });
    let k = 0;
    for (const q of c.questions) {
      const a = answerQuestion(q, ctx);
      await prisma.chatMessage.createMany({
        data: [
          { id: `${c.id}-q${k}`, userId: LAN_ID, conversationId: c.id, role: "user", content: q, refused: a.refused, createdAt: new Date(c.at.getTime() + k * 2000) },
          {
            id: `${c.id}-a${k}`,
            userId: LAN_ID,
            conversationId: c.id,
            role: "assistant",
            content: a.content,
            toolCalls: a.toolCalls as unknown as object,
            sourceIds: a.sourceIds,
            refused: a.refused,
            createdAt: new Date(c.at.getTime() + k * 2000 + 1000),
          },
        ],
      });
      k += 1;
    }
  }

  if (options.minimal) return { anchor, users: 2 };

  // ───────────── 38 người dùng mẫu: sổ đơn giản nhưng có thật trong DB (số liệu admin tính thật) ─────────────
  const rand = mulberry32(4711);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const EXPENSES = [
    ["c-food", "Cơm trưa", 30_000, 60_000],
    ["c-food", "Cà phê", 20_000, 50_000],
    ["c-move", "Grab", 25_000, 70_000],
    ["c-shop", "Shopee", 80_000, 400_000],
    ["c-fun", "Xem phim", 90_000, 200_000],
    ["c-bill", "Tiền điện", 300_000, 700_000],
  ] as const;
  const FEATURES = [
    ["extract", 0.38],
    ["classify", 0.34],
    ["chat", 0.18],
    ["motivation", 0.1],
  ] as const;
  const feature = () => {
    let r = rand();
    for (const [f, share] of FEATURES) {
      if ((r -= share) < 0) return f;
    }
    return "extract" as const;
  };

  const aiLogs: Prisma.AiLogCreateManyInput[] = [];
  const pushAiLogs = (userId: string, count: number, from: string, to: string) => {
    const span = Math.max(1, daysBetween(from, to));
    for (let i = 0; i < count; i++) {
      const d = addDays(from, Math.floor(rand() * (span + 1)));
      const success = rand() > 0.025;
      aiLogs.push({
        id: `ai-${userId}-${i}`,
        userId,
        feature: feature(),
        provider: "openai",
        tokens: 150 + Math.floor(rand() * 900),
        latencyMs: Math.round(700 + rand() * 2400),
        success,
        createdAt: vn(d, 8 + Math.floor(rand() * 14), Math.floor(rand() * 60)),
      });
    }
  };
  pushAiLogs(LAN_ID, 412, day(mock.FIRST_DAY), yesterday);

  for (const a of others) {
    const id = a.user.id;
    const created = day(a.user.createdAt.slice(0, 10));
    const lastActive = day(a.stats.lastActiveDate ?? MOCK_TODAY);
    const walletId = `w-${id}`;
    const txs: { id: string; userId: string; walletId: string; categoryId: string; amount: bigint; type: "income" | "expense"; date: Date; description: string; createdAt: Date }[] = [];
    let balance = 2_000_000;
    const span = Math.max(1, daysBetween(created, lastActive));
    for (let i = 0; i < a.stats.transactionCount; i++) {
      const d = addDays(created, Math.floor(rand() * (span + 1)));
      const income = rand() < 0.04;
      const [categoryId, description, min, max] = income ? (["c-salary", "Lương", 8_000_000, 15_000_000] as const) : pick(EXPENSES);
      const amount = Math.round((min + rand() * (max - min)) / 1000) * 1000;
      balance += income ? amount : -amount;
      txs.push({
        id: `t-${id}-${i}`,
        userId: id,
        walletId,
        categoryId,
        amount: BigInt(amount),
        type: income ? "income" : "expense",
        date: D(d),
        description,
        createdAt: vn(d, 7 + Math.floor(rand() * 15), Math.floor(rand() * 60), i % 60),
      });
    }
    await prisma.wallet.create({ data: { id: walletId, userId: id, name: "Tiền mặt", type: "cash", balance: BigInt(balance), createdAt: at(a.user.createdAt) } });
    if (txs.length) await prisma.transaction.createMany({ data: txs.map((t) => ({ ...t, updatedAt: t.createdAt, source: "form", status: "confirmed" })) });

    // Hoạt động: chuỗi hiện tại liền mạch tới ngày cuối, cộng ngày rải rác trước đó
    const activeDays = new Set<string>();
    for (let k = 0; k < a.stats.currentStreak; k++) activeDays.add(addDays(lastActive, -k));
    activeDays.add(lastActive);
    for (let k = 0; k < span; k++) if (rand() < 0.55) activeDays.add(addDays(created, k));
    const logs = [...activeDays].filter((d) => d >= created && d <= lastActive).sort();
    await prisma.activityLog.createMany({
      data: logs.map((d, k) => ({ id: `al-${id}-${k}`, userId: id, date: D(d), actionType: "add_transaction" as const, createdAt: vn(d, 20) })),
    });
    const longest = Math.max(a.stats.currentStreak, Math.floor(rand() * 20));
    await prisma.userStreak.create({
      data: {
        userId: id,
        currentStreak: a.stats.currentStreak,
        longestStreak: longest,
        lastActiveDate: D(lastActive),
        freezeCount: 0,
        settledDate: D(lastActive),
      },
    });
    const xp = a.stats.transactionCount * 10;
    await prisma.userLevel.create({ data: { userId: id, totalXp: xp, level: levelFromXp(xp).level } });
    const badgeData = [
      a.stats.transactionCount > 0 && "bd-first",
      longest >= 7 && "bd-fire7",
      longest >= 30 && "bd-fire30",
      a.stats.transactionCount >= 100 && "bd-collector",
    ].filter(Boolean) as string[];
    await prisma.userBadge.createMany({ data: badgeData.map((badgeId) => ({ userId: id, badgeId, unlockedAt: vn(created, 21) })) });
    pushAiLogs(id, a.stats.aiCalls, created, lastActive);
  }
  for (let i = 0; i < aiLogs.length; i += 5000) await prisma.aiLog.createMany({ data: aiLogs.slice(i, i + 5000) });

  return { anchor, users: 2 + others.length, transactions: await prisma.transaction.count(), aiLogs: aiLogs.length };
}
