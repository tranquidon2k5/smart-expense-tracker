import type {
  AdminBadgeRow,
  AdminCategoryRow,
  AdminUserRow,
  Badge,
  Category,
  Mission,
  MotivationMessage,
  SystemStats,
} from "@/types";
import * as db from "./mock/db";
import { AI_AVG_LATENCY_MS, AI_FEATURE_SHARE, accounts, persistAccount, systemDaily } from "./mock/accounts";
import { categoryUsage } from "./mock/dataset";
import { failIfErrorScenario, simulateLatency } from "./mock/scenario";
import { getStoredSession } from "./mock/session-store";
import { emitDataChanged } from "./events";
import { ForbiddenError } from "./errors";

export { ForbiddenError };
import {
  AI_FEATURE_LABEL,
  MOTIVATION_CONTEXTS,
  MOTIVATION_VARIABLES,
  missionCode,
  missionError,
  motivationError,
  previewTemplate,
  unknownVariables,
} from "@shared/admin-rules";
import { USE_API } from "./data-source";
import * as api from "./api/endpoints";

/**
 * Trang quản trị (F15). Mọi hàm kiểm tra vai trò admin trước (bản thật: middleware backend
 * kiểm tra role trong JWT; giao diện ẩn trang chỉ là lớp thứ hai).
 */


function requireAdmin() {
  const s = getStoredSession();
  if (!s || s.role !== "admin") throw new ForbiddenError();
  return s;
}

async function guard(ms = 350) {
  await simulateLatency(ms);
  failIfErrorScenario();
  return requireAdmin();
}

const nextId = (p: string) => `${p}-${Date.now().toString(36)}`;

// ───────────── Thống kê hệ thống ─────────────

export { AI_FEATURE_LABEL };

export async function getSystemStats(): Promise<SystemStats> {
  if (USE_API) return api.admin.getSystemStats();
  await guard(500);
  const users = accounts.filter((a) => a.user.role === "user");
  const since = (days: number) => {
    const d = new Date(`${db.MOCK_TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const active7 = users.filter((a) => (a.stats.lastActiveDate ?? "") >= since(7));
  const active30 = users.filter((a) => (a.stats.lastActiveDate ?? "") >= since(30));
  const aiCalls30d = systemDaily.reduce((s, d) => s + d.aiCalls, 0);
  const aiFailures = systemDaily.reduce((s, d) => s + d.aiFailures, 0);

  return {
    totalUsers: users.length,
    newUsers30d: users.filter((a) => a.user.createdAt.slice(0, 10) >= since(30)).length,
    activeUsers7d: active7.length,
    lockedUsers: users.filter((a) => a.user.isLocked).length,
    totalTransactions: users.reduce((s, a) => s + a.stats.transactionCount, 0),
    transactions30d: systemDaily.reduce((s, d) => s + d.transactions, 0),
    aiCalls30d,
    aiSuccessRate: 1 - aiFailures / aiCalls30d,
    aiAvgLatencyMs: AI_AVG_LATENCY_MS,
    aiByFeature: (Object.keys(AI_FEATURE_SHARE) as (keyof typeof AI_FEATURE_SHARE)[]).map((feature) => ({
      feature,
      label: AI_FEATURE_LABEL[feature],
      calls: Math.round(aiCalls30d * AI_FEATURE_SHARE[feature]),
      failures: Math.round(aiFailures * AI_FEATURE_SHARE[feature] * (feature === "chat" ? 1.6 : 0.8)),
    })),
    streakRetention: active30.length ? active30.filter((a) => a.stats.currentStreak > 0).length / active30.length : 0,
    streakRetentionBase: active30.length,
    daily: systemDaily,
  };
}

// ───────────── Người dùng ─────────────

export async function listUsers(): Promise<AdminUserRow[]> {
  if (USE_API) return api.admin.listUsers();
  await guard(450);
  return accounts
    .map((a) => ({ ...a.user, ...a.stats }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setUserLocked(userId: string, locked: boolean): Promise<AdminUserRow> {
  if (USE_API) return api.admin.setUserLocked(userId, locked);
  const me = await guard(400);
  const account = accounts.find((a) => a.user.id === userId);
  if (!account) throw new Error("Không tìm thấy người dùng.");
  if (account.user.id === me.userId) throw new Error("Bạn không thể tự khoá tài khoản của mình.");
  if (account.user.role === "admin") throw new Error("Không khoá được tài khoản quản trị viên khác từ đây.");
  account.user.isLocked = locked;
  persistAccount(account);
  emitDataChanged();
  return { ...account.user, ...account.stats };
}

// ───────────── Danh mục mặc định ─────────────

export async function listDefaultCategories(): Promise<AdminCategoryRow[]> {
  if (USE_API) return api.admin.listDefaultCategories();
  await guard();
  return db.categories
    .filter((c) => c.userId === null)
    .map((c) => ({ ...c, usage: categoryUsage(c.id) }));
}

export async function saveDefaultCategory(input: Omit<Category, "id" | "userId"> & { id?: string }): Promise<Category> {
  if (USE_API) return api.admin.saveDefaultCategory(input);
  await guard(400);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Tên danh mục cần ít nhất 2 ký tự.");
  const dup = db.categories.find(
    (c) => c.userId === null && c.id !== input.id && c.type === input.type && c.name.toLowerCase() === name.toLowerCase(),
  );
  if (dup) throw new Error(`Đã có danh mục mặc định “${dup.name}”.`);
  if (input.id) {
    const c = db.categories.find((x) => x.id === input.id && x.userId === null);
    if (!c) throw new Error("Danh mục không tồn tại.");
    // Đổi loại thu/chi khi đã có giao dịch sẽ làm sai số liệu của người dùng
    if (c.type !== input.type && categoryUsage(c.id) > 0) {
      throw new Error("Danh mục đang có giao dịch nên không đổi được loại thu/chi.");
    }
    Object.assign(c, { name, type: input.type, icon: input.icon, color: input.color });
    emitDataChanged();
    return c;
  }
  const c: Category = { id: nextId("c-def"), userId: null, name, type: input.type, icon: input.icon, color: input.color };
  db.categories.push(c);
  emitDataChanged();
  return c;
}

export async function deleteDefaultCategory(id: string): Promise<void> {
  if (USE_API) return api.admin.deleteDefaultCategory(id);
  await guard(400);
  const usage = categoryUsage(id);
  if (usage) throw new Error(`Danh mục đang được dùng cho ${usage} giao dịch nên không xoá được. Bạn có thể đổi tên thay vì xoá.`);
  const i = db.categories.findIndex((c) => c.id === id && c.userId === null);
  if (i < 0) throw new Error("Danh mục không tồn tại.");
  db.categories.splice(i, 1);
  emitDataChanged();
}

// ───────────── Ngân hàng câu khích lệ ─────────────

export { MOTIVATION_CONTEXTS, MOTIVATION_VARIABLES, previewTemplate, unknownVariables };

export async function listMotivationMessages(): Promise<MotivationMessage[]> {
  if (USE_API) return api.admin.listMotivationMessages();
  await guard();
  return db.motivationMessages.map((m) => ({ ...m }));
}

export async function saveMotivationMessage(input: Omit<MotivationMessage, "id"> & { id?: string }): Promise<MotivationMessage> {
  if (USE_API) return api.admin.saveMotivationMessage(input);
  await guard(400);
  const template = input.template.trim();
  const invalid = motivationError(template);
  if (invalid) throw new Error(invalid);
  if (input.id) {
    const m = db.motivationMessages.find((x) => x.id === input.id);
    if (!m) throw new Error("Không tìm thấy câu.");
    ensureContextKeepsActive(m, input.isActive && input.context === m.context);
    Object.assign(m, { context: input.context, template, isActive: input.isActive });
    emitDataChanged();
    return { ...m };
  }
  const m: MotivationMessage = { id: nextId("mm"), context: input.context, template, isActive: input.isActive };
  db.motivationMessages.push(m);
  emitDataChanged();
  return { ...m };
}

/** Mỗi ngữ cảnh phải còn ít nhất 1 câu đang bật, nếu không người dùng sẽ không nhận được câu nào */
function ensureContextKeepsActive(m: MotivationMessage, staysActiveHere: boolean) {
  if (!m.isActive || staysActiveHere) return;
  const others = db.motivationMessages.filter((x) => x.id !== m.id && x.context === m.context && x.isActive);
  if (!others.length) {
    const label = MOTIVATION_CONTEXTS.find((c) => c.value === m.context)?.label ?? m.context;
    throw new Error(`“${label}” cần còn ít nhất 1 câu đang bật. Thêm câu khác trước khi tắt câu này.`);
  }
}

export async function setMotivationActive(id: string, isActive: boolean): Promise<void> {
  if (USE_API) return api.admin.setMotivationActive(id, isActive);
  await guard(250);
  const m = db.motivationMessages.find((x) => x.id === id);
  if (!m) throw new Error("Không tìm thấy câu.");
  ensureContextKeepsActive(m, isActive);
  m.isActive = isActive;
  emitDataChanged();
}

export async function deleteMotivationMessage(id: string): Promise<void> {
  if (USE_API) return api.admin.deleteMotivationMessage(id);
  await guard(300);
  const m = db.motivationMessages.find((x) => x.id === id);
  if (!m) return;
  ensureContextKeepsActive(m, false);
  db.motivationMessages.splice(db.motivationMessages.indexOf(m), 1);
  emitDataChanged();
}

// ───────────── Nhiệm vụ ─────────────

export async function listMissions(): Promise<Mission[]> {
  if (USE_API) return api.admin.listMissions();
  await guard();
  return db.missions.map((m) => ({ ...m, isActive: m.isActive ?? true }));
}

export async function saveMission(input: Omit<Mission, "id" | "code"> & { id?: string; code?: string }): Promise<Mission> {
  if (USE_API) return api.admin.saveMission(input);
  await guard(400);
  const title = input.title.trim();
  const invalid = missionError(input);
  if (invalid) throw new Error(invalid);
  if (input.id) {
    const m = db.missions.find((x) => x.id === input.id);
    if (!m) throw new Error("Không tìm thấy nhiệm vụ.");
    if (m.period !== input.period) throw new Error("Không đổi được chu kỳ của nhiệm vụ đang chạy. Tạo nhiệm vụ mới thay thế.");
    Object.assign(m, { title, target: input.target, xp: input.xp, isActive: input.isActive ?? true });
    emitDataChanged();
    return { ...m };
  }
  const code = missionCode(input.code?.trim() || title);
  if (db.missions.some((m) => m.code === code)) throw new Error(`Mã ${code} đã tồn tại.`);
  const m: Mission = { id: nextId("m"), code, title, period: input.period, target: input.target, xp: input.xp, isActive: input.isActive ?? true };
  db.missions.push(m);
  emitDataChanged();
  return { ...m };
}

// ───────────── Huy hiệu ─────────────

export async function listBadges(): Promise<AdminBadgeRow[]> {
  if (USE_API) return api.admin.listBadges();
  await guard();
  const users = accounts.filter((a) => a.user.role === "user");
  return db.badges.map((b, i) => {
    // Người dùng khác: ước lượng từ số liệu (bản demo không có user_badges của họ)
    const estimate = users.filter((a) => {
      switch (b.code) {
        case "FIRST_STEP":
          return a.stats.transactionCount > 0;
        case "FIRE_7":
          return a.stats.currentStreak >= 7;
        case "FIRE_30":
          return a.stats.currentStreak >= 30;
        case "FIRE_100":
          return a.stats.currentStreak >= 100;
        case "COLLECTOR":
          return a.stats.transactionCount >= 100;
        case "CHAT_10":
          return a.stats.aiCalls >= 40;
        default:
          return (a.stats.transactionCount + i) % 5 === 0;
      }
    }).length;
    return { ...b, unlockedUsers: estimate };
  });
}

/** Điều kiện mở khoá gắn với mã huy hiệu trong code → admin chỉ sửa tên, mô tả, icon */
export async function saveBadge(input: Pick<Badge, "id" | "name" | "condition" | "icon">): Promise<Badge> {
  if (USE_API) return api.admin.saveBadge(input);
  await guard(400);
  const b = db.badges.find((x) => x.id === input.id);
  if (!b) throw new Error("Không tìm thấy huy hiệu.");
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Tên huy hiệu cần ít nhất 2 ký tự.");
  if (input.condition.trim().length < 5) throw new Error("Mô tả điều kiện cần ít nhất 5 ký tự.");
  Object.assign(b, { name, condition: input.condition.trim(), icon: input.icon });
  emitDataChanged();
  return { ...b };
}
