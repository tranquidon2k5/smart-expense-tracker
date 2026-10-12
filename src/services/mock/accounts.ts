/**
 * Bảng users giả lập + số liệu hệ thống cho trang quản trị (F15).
 * Mật khẩu chỉ lưu dạng băm SHA-256 (bản thật: bcrypt ở backend, PRD §8).
 * Tài khoản đăng ký mới / đổi mật khẩu / bị khoá được lưu ở localStorage để tải lại trang vẫn còn.
 */
import type { AdminUserRow, SystemDailyPoint, User } from "@/types";
import * as db from "./db";

export interface Account {
  user: User;
  /** null = chưa băm (tài khoản mẫu), băm lần đầu khi cần */
  passwordHash: string | null;
  seedPassword?: string;
  /** Số liệu hiển thị cho admin (người dùng khác không có dữ liệu chi tiết trong bản demo) */
  stats: Pick<AdminUserRow, "lastActiveDate" | "transactionCount" | "currentStreak" | "aiCalls">;
}

export const DEMO_PASSWORD = "matkhau123";
export const ADMIN_EMAIL = "admin@sotien.vn";
export const ADMIN_PASSWORD = "quantri123";
/** Mã đặt lại mật khẩu của bản demo (bản thật gửi qua email, hết hạn sau 15 phút) */
export const DEMO_RESET_CODE = "123456";

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261012);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

const LAST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương"];
const MIDDLE = ["Văn", "Thị", "Minh", "Thu", "Đức", "Ngọc", "Hoàng", "Thanh", "Quốc", "Bảo"];
const FIRST = ["An", "Bình", "Chi", "Dũng", "Giang", "Hà", "Hải", "Hiếu", "Hoa", "Huy", "Khánh", "Linh", "Long", "Mai", "Minh", "Nam", "Ngân", "Phúc", "Quân", "Sơn", "Thảo", "Trang", "Tuấn", "Vy", "Yến"];
const ASCII: Record<string, string> = { đ: "d", Đ: "d" };
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, (c) => ASCII[c])
    .toLowerCase()
    .replace(/\s+/g, ".");

function seedUser(i: number): Account {
  const fullName = `${pick(LAST)} ${pick(MIDDLE)} ${pick(FIRST)}`;
  const first = fullName.split(" ").at(-1)!;
  const created = addDays("2026-04-20", Math.floor(rand() * 170));
  const inactiveDays = rand() < 0.25 ? 8 + Math.floor(rand() * 40) : Math.floor(rand() * 5);
  const lastActive = addDays(db.MOCK_TODAY, -inactiveDays);
  const ageDays = Math.max(1, Math.round((Date.parse(db.MOCK_TODAY) - Date.parse(created)) / 86_400_000));
  const streak = inactiveDays > 1 ? 0 : Math.min(ageDays, Math.floor(rand() * 40));
  return {
    user: {
      id: `u-${String(i).padStart(3, "0")}`,
      email: `${slug(first)}.${slug(fullName.split(" ")[0])}${i}@example.com`,
      fullName,
      currency: "VND",
      timezone: "Asia/Ho_Chi_Minh",
      role: "user",
      isLocked: i === 7 || i === 23,
      createdAt: `${created}T${String(8 + (i % 12)).padStart(2, "0")}:15:00+07:00`,
    },
    passwordHash: null,
    seedPassword: DEMO_PASSWORD,
    stats: {
      lastActiveDate: lastActive,
      transactionCount: Math.round(ageDays * (0.8 + rand() * 3)),
      currentStreak: streak,
      aiCalls: Math.round(ageDays * (0.5 + rand() * 4)),
    },
  };
}

/** Số liệu của Lan lấy từ dữ liệu mẫu lúc khởi tạo (trước khi bất kỳ bộ dữ liệu nào được nạp lại) */
const lanStats: Account["stats"] = {
  lastActiveDate: db.streak.lastActiveDate,
  transactionCount: db.transactions.length,
  currentStreak: db.streak.currentStreak,
  aiCalls: 412,
};

export const accounts: Account[] = [
  { user: { ...db.user }, passwordHash: null, seedPassword: DEMO_PASSWORD, stats: lanStats },
  {
    user: {
      id: "u-admin",
      email: ADMIN_EMAIL,
      fullName: "Quản trị viên",
      currency: "VND",
      timezone: "Asia/Ho_Chi_Minh",
      role: "admin",
      isLocked: false,
      createdAt: "2026-04-15T09:00:00+07:00",
    },
    passwordHash: null,
    seedPassword: ADMIN_PASSWORD,
    stats: { lastActiveDate: db.MOCK_TODAY, transactionCount: 0, currentStreak: 0, aiCalls: 0 },
  },
  ...Array.from({ length: 38 }, (_, i) => seedUser(i + 1)),
];

// ───────────── Lưu thay đổi tài khoản trên trình duyệt ─────────────

const STORE_KEY = "so-tien:accounts";

/** Ghi lại tài khoản đã thay đổi (đăng ký, đổi mật khẩu, đổi hồ sơ, bị khoá) */
export function persistAccount(account: Account): void {
  if (typeof window === "undefined") return;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "[]") as Account[];
    const next = [...saved.filter((a) => a.user.id !== account.user.id), { ...account, seedPassword: undefined }];
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // Không lưu được (chế độ riêng tư) → thay đổi chỉ còn trong tab này
  }
}

function restoreSaved() {
  if (typeof window === "undefined") return;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "[]") as Account[];
    for (const a of saved) {
      const i = accounts.findIndex((x) => x.user.id === a.user.id);
      if (i >= 0) accounts[i] = { ...accounts[i], ...a, seedPassword: a.passwordHash ? undefined : accounts[i].seedPassword };
      else accounts.push(a);
    }
  } catch {
    // Dữ liệu hỏng → bỏ qua, dùng tài khoản mẫu
  }
}
restoreSaved();

export function findAccountByEmail(email: string): Account | undefined {
  const e = email.trim().toLowerCase();
  return accounts.find((a) => a.user.email.toLowerCase() === e);
}

export function findAccount(id: string): Account | undefined {
  return accounts.find((a) => a.user.id === id);
}

export async function passwordMatches(account: Account, password: string): Promise<boolean> {
  if (!account.passwordHash) account.passwordHash = await sha256(account.seedPassword ?? "");
  return account.passwordHash === (await sha256(password));
}

// ───────────── Số liệu hệ thống 30 ngày (ai_logs, transactions) ─────────────

const sysRand = mulberry32(42);
export const systemDaily: SystemDailyPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = addDays(db.MOCK_TODAY, i - 29);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const weekend = weekday === 0 || weekday === 6;
  const growth = 1 + i / 60;
  const transactions = Math.round((weekend ? 120 : 165) * growth + sysRand() * 40);
  const aiCalls = Math.round(transactions * (1.6 + sysRand() * 0.5));
  return {
    date,
    transactions,
    aiCalls,
    aiFailures: Math.round(aiCalls * (0.01 + sysRand() * 0.025)),
    activeUsers: Math.round((weekend ? 21 : 27) * growth + sysRand() * 5),
  };
});

export const AI_FEATURE_SHARE = { extract: 0.38, classify: 0.34, chat: 0.18, motivation: 0.1 } as const;
export const AI_AVG_LATENCY_MS = 1840;
