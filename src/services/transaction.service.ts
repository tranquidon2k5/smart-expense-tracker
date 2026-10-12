import type {
  Category,
  ClassificationRule,
  CreateRuleResult,
  QuickEntryPreview,
  QuickEntryResult,
  ReviewResult,
  RulePreview,
  RuleSuggestion,
  Transaction,
  TransactionFilter,
  TransactionPatch,
  TransactionType,
  TransactionView,
  UpdateResult,
  Wallet,
} from "@/types";
import * as db from "./mock/db";
import { failIfErrorScenario, simulateLatency } from "./mock/scenario";
import {
  applyToWallet,
  awardXp,
  bumpMission,
  normalize,
  recordActivity,
  scopedTransactions,
  scopedWallets,
  toView,
} from "./mock/queries";
import { emitDataChanged } from "./events";
import { extractKeyword, matchesKeyword, planRuleApplication } from "./rules";

/** Ngưỡng độ tin cậy: thấp hơn → hàng chờ duyệt (PRD §9.1) */
export const CONFIDENCE_THRESHOLD = 0.7;

function byNewest(a: Transaction, b: Transaction) {
  return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
}

function findOrThrow(id: string): Transaction {
  const t = db.transactions.find((x) => x.id === id);
  if (!t) throw new Error("Không tìm thấy giao dịch, có thể đã bị xoá.");
  return t;
}

function pendingCount(): number {
  return scopedTransactions().filter((t) => t.status === "pending").length;
}

// ───────────── Đọc ─────────────

/** Ngày "hôm nay" theo múi giờ người dùng (bản demo cố định 12/10/2026) */
export function getToday(): string {
  return db.MOCK_TODAY;
}

export async function listCategories(type?: TransactionType): Promise<Category[]> {
  await simulateLatency(150);
  return db.categories.filter((c) => !type || c.type === type);
}

export async function listWallets(): Promise<Wallet[]> {
  await simulateLatency(150);
  return scopedWallets();
}

export async function getRecentTransactions(limit = 8): Promise<TransactionView[]> {
  await simulateLatency();
  return [...scopedTransactions()].sort(byNewest).slice(0, limit).map(toView);
}

export async function searchTransactions(query: string, limit = 8): Promise<TransactionView[]> {
  await simulateLatency(200);
  const q = normalize(query.trim());
  if (!q) return [];
  return [...scopedTransactions()]
    .sort(byNewest)
    .map(toView)
    .filter((t) => normalize(`${t.description} ${t.category.name} ${t.wallet.name}`).includes(q))
    .slice(0, limit);
}

/** Danh sách giao dịch theo bộ lọc, mới nhất trước (sắp xếp khác do bảng xử lý) */
export async function listTransactions(filter: TransactionFilter = {}): Promise<TransactionView[]> {
  await simulateLatency(450);
  failIfErrorScenario();
  const q = filter.query ? normalize(filter.query.trim()) : "";
  return [...scopedTransactions()]
    .filter((t) => {
      if (filter.from && t.date < filter.from) return false;
      if (filter.to && t.date > filter.to) return false;
      if (filter.type && t.type !== filter.type) return false;
      if (filter.status && t.status !== filter.status) return false;
      if (filter.walletIds?.length && !filter.walletIds.includes(t.walletId)) return false;
      if (filter.categoryIds?.length && !filter.categoryIds.includes(t.categoryId)) return false;
      if (filter.minAmount != null && t.amount < filter.minAmount) return false;
      if (filter.maxAmount != null && t.amount > filter.maxAmount) return false;
      return true;
    })
    .sort(byNewest)
    .map(toView)
    .filter((t) => !q || normalize(`${t.description} ${t.category.name} ${t.wallet.name}`).includes(q));
}

export async function getTransaction(id: string): Promise<TransactionView | null> {
  await simulateLatency(200);
  failIfErrorScenario();
  const t = scopedTransactions().find((x) => x.id === id);
  return t ? toView(t) : null;
}

/** Hàng chờ duyệt: giao dịch AI phân loại với độ tin cậy < 0,7 */
export async function listPendingTransactions(): Promise<TransactionView[]> {
  await simulateLatency(400);
  failIfErrorScenario();
  return scopedTransactions()
    .filter((t) => t.status === "pending")
    .sort(byNewest)
    .map(toView);
}

// ───────────── Luật từ khoá (F08) ─────────────

function matchRule(text: string): ClassificationRule | undefined {
  return db.classificationRules.find((r) => matchesKeyword(text, r.keyword));
}

function categoryOrThrow(categoryId: string): Category {
  const category = db.categories.find((c) => c.id === categoryId);
  if (!category) throw new Error("Danh mục không tồn tại.");
  return category;
}

function buildRuleSuggestion(t: Transaction, newCategoryId: string): RuleSuggestion | null {
  if (t.source === "form") return null;
  const keyword = extractKeyword(t.description);
  if (!keyword) return null;
  const exists = db.classificationRules.some(
    (r) => normalize(r.keyword) === normalize(keyword) && r.categoryId === newCategoryId,
  );
  if (exists) return null;
  const matchingPendingCount = planRuleApplication(scopedTransactions(), keyword, categoryOrThrow(newCategoryId), t.id).filter(
    (p) => !p.typeMismatch,
  ).length;
  return { transactionId: t.id, keyword, categoryId: newCategoryId, matchingPendingCount };
}

/**
 * Xem trước: những giao dịch chờ duyệt nào luật sẽ phân loại lại, giao dịch nào đang thuộc
 * danh mục khác (cần cảnh báo), giao dịch nào bị bỏ qua vì khác loại thu/chi.
 * Dùng cùng planRuleApplication với createRule nên xem trước luôn khớp kết quả thật.
 */
export async function previewRule(keyword: string, categoryId: string, excludeId?: string): Promise<RulePreview> {
  await simulateLatency(200);
  const category = categoryOrThrow(categoryId);
  const items = planRuleApplication(scopedTransactions(), keyword, category, excludeId).map((p) => ({
    ...p,
    transaction: toView(p.transaction),
  }));
  return {
    keyword: keyword.trim().toUpperCase(),
    categoryId,
    items,
    applicableCount: items.filter((i) => !i.typeMismatch).length,
    conflictCount: items.filter((i) => i.conflict).length,
  };
}

/**
 * Tạo luật từ khoá → danh mục. Mặc định KHÔNG đụng tới các giao dịch chờ duyệt khác;
 * chỉ khi `applyToPending` mới phân loại lại đúng danh sách mà previewRule trả về.
 */
export async function createRule(
  keyword: string,
  categoryId: string,
  applyToPending = false,
): Promise<CreateRuleResult> {
  await simulateLatency(350);
  const clean = keyword.trim().toUpperCase();
  if (!clean) throw new Error("Từ khoá không được để trống.");
  const category = categoryOrThrow(categoryId);

  const rule: ClassificationRule = {
    id: `r-${Date.now()}`,
    userId: db.USER_ID,
    keyword: clean,
    categoryId,
    createdFrom: "correction",
  };
  db.classificationRules.unshift(rule);

  let appliedCount = 0;
  if (applyToPending) {
    for (const { transaction: t, typeMismatch } of planRuleApplication(scopedTransactions(), clean, category)) {
      if (typeMismatch) continue;
      t.categoryId = categoryId;
      t.aiConfidence = 0.95;
      t.status = "confirmed";
      appliedCount += 1;
    }
    if (appliedCount) bumpMission("m-d-review", appliedCount);
  }
  emitDataChanged();
  return { rule, appliedCount };
}

// ───────────── Ghi ─────────────

export async function updateTransaction(id: string, patch: TransactionPatch): Promise<UpdateResult> {
  await simulateLatency(400);
  const t = findOrThrow(id);
  if (patch.amount != null && patch.amount <= 0) throw new Error("Số tiền phải lớn hơn 0đ.");
  const prevCategoryId = t.categoryId;

  applyToWallet(t, -1);
  Object.assign(t, patch);
  if (patch.categoryId) {
    t.type = db.categories.find((c) => c.id === patch.categoryId)!.type;
  }
  applyToWallet(t, 1);

  const ruleSuggestion =
    patch.categoryId && patch.categoryId !== prevCategoryId ? buildRuleSuggestion(t, patch.categoryId) : null;
  emitDataChanged();
  return { transaction: toView(t), ruleSuggestion };
}

export async function deleteTransactions(ids: string[]): Promise<number> {
  await simulateLatency(400);
  let removed = 0;
  for (const id of ids) {
    const i = db.transactions.findIndex((t) => t.id === id);
    if (i === -1) continue;
    applyToWallet(db.transactions[i], -1);
    db.transactions.splice(i, 1);
    removed += 1;
  }
  emitDataChanged();
  return removed;
}

/**
 * Sửa hàng loạt. Đổi danh mục chỉ áp cho giao dịch cùng loại (thu/chi) với danh mục đích.
 */
export async function bulkUpdateTransactions(
  ids: string[],
  patch: Pick<TransactionPatch, "categoryId" | "walletId">,
): Promise<{ updated: number; skipped: number }> {
  await simulateLatency(450);
  const category = patch.categoryId ? db.categories.find((c) => c.id === patch.categoryId) : undefined;
  let updated = 0;
  let skipped = 0;
  for (const id of ids) {
    const t = db.transactions.find((x) => x.id === id);
    if (!t) continue;
    if (category && category.type !== t.type) {
      skipped += 1;
      continue;
    }
    applyToWallet(t, -1);
    if (patch.walletId) t.walletId = patch.walletId;
    if (category) t.categoryId = category.id;
    applyToWallet(t, 1);
    updated += 1;
  }
  emitDataChanged();
  return { updated, skipped };
}

/**
 * Duyệt một giao dịch chờ (F08). Truyền categoryId nếu người dùng sửa danh mục AI đoán —
 * khi đó trả về gợi ý tạo luật từ khoá. +5 XP, tính vào chuỗi ngày.
 */
export async function reviewTransaction(id: string, categoryId?: string): Promise<ReviewResult> {
  await simulateLatency(300);
  const t = findOrThrow(id);
  const changed = !!categoryId && categoryId !== t.categoryId;
  if (changed) {
    t.categoryId = categoryId!;
    t.type = db.categories.find((c) => c.id === categoryId)!.type;
  }
  t.status = "confirmed";

  const xp = awardXp("review");
  recordActivity();
  bumpMission("m-d-review");

  const ruleSuggestion = changed ? buildRuleSuggestion(t, categoryId!) : null;
  emitDataChanged();
  return {
    transaction: toView(t),
    xpGained: xp.xp,
    xpLimitReached: xp.limitReached,
    ruleSuggestion,
    remainingPending: pendingCount(),
  };
}

// ───────────── Ghi nhanh bằng câu tự nhiên (giả lập F07 + F08) ─────────────

const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
  { keywords: ["luong"], categoryId: "c-salary" },
  { keywords: ["thuong"], categoryId: "c-bonus" },
  { keywords: ["hoan tien", "ban do", "duoc cho", "me cho", "bo cho"], categoryId: "c-income-other" },
  // Từ khoá ngắn có khoảng trắng hai bên để không khớp nhầm ("pho" ≠ "phong", "an" ≠ "Lan")
  { keywords: [" pho ", " bun ", " com ", " an ", " banh mi", "ca phe", "cafe", " cf ", "tra sua", " lau ", " nuong", " xoi ", "highlands", "tra da"], categoryId: "c-food" },
  { keywords: ["grab", "be bike", " xang", "taxi", "xe buyt", "gui xe", "ve tau", "xanh sm"], categoryId: "c-move" },
  { keywords: [" sach", " hoc ", "khoa hoc", "ielts", "toeic", "giao trinh"], categoryId: "c-study" },
  { keywords: [" phim", "cgv", "karaoke", " game", "netflix", "spotify", "ca nhac", "du lich"], categoryId: "c-fun" },
  { keywords: ["shopee", "tiki", "lazada", " ao ", " quan ", " giay", "my pham", "uniqlo"], categoryId: "c-shop" },
  { keywords: ["tien dien", "tien nuoc", "internet", "wifi", "tien nha", "tien phong", "cuoc dien thoai", " 4g"], categoryId: "c-bill" },
  { keywords: ["thuoc", "kham", "gym", "nha khoa", "bao hiem", "pharmacity"], categoryId: "c-health" },
];

const INCOME_HINTS = ["luong", "thuong", "nhan ", "duoc cho", "hoan tien", "ban do", "thu "];

function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function parseAmount(text: string): { amount: number | null; match: string | null } {
  // "1tr2", "1,5tr", "45k", "45 nghìn", "200.000đ", "300000"
  const patterns: [RegExp, (m: RegExpMatchArray) => number][] = [
    [/(\d+)\s*(?:tr|triệu|củ)\s*(\d)(?!\d)/i, (m) => Number(m[1]) * 1e6 + Number(m[2]) * 1e5],
    [/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|củ)\b/i, (m) => Number(m[1].replace(",", ".")) * 1e6],
    [/(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|ngàn|ng)\b/i, (m) => Number(m[1].replace(",", ".")) * 1e3],
    [/(\d{1,3}(?:\.\d{3})+)\s*(?:đ|d|vnd)?/i, (m) => Number(m[1].replace(/\./g, ""))],
    [/(\d{4,})\s*(?:đ|d|vnd)?/i, (m) => Number(m[1])],
  ];
  for (const [re, toNumber] of patterns) {
    const m = text.match(re);
    if (m) return { amount: Math.round(toNumber(m)), match: m[0] };
  }
  return { amount: null, match: null };
}

function parseDate(text: string): { date: string; match: string | null } {
  const lower = text.toLowerCase();
  const relative: [string, number][] = [
    ["hôm kia", -2],
    ["hôm qua", -1],
    ["hôm nay", 0],
  ];
  for (const [phrase, delta] of relative) {
    if (lower.includes(phrase)) return { date: addDays(db.MOCK_TODAY, delta), match: phrase };
  }
  const m = text.match(/(?:ngày\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (m) {
    const year = m[3] ?? db.MOCK_TODAY.slice(0, 4);
    return { date: `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, match: m[0] };
  }
  return { date: db.MOCK_TODAY, match: null };
}

function cleanDescription(text: string, remove: (string | null)[]): string {
  let out = text;
  for (const r of remove) if (r) out = out.replace(new RegExp(r.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "i"), " ");
  out = out.replace(/\s+/g, " ").trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}

export async function parseQuickEntry(text: string): Promise<QuickEntryPreview> {
  await simulateLatency(700);
  const { amount, match: amountMatch } = parseAmount(text);
  const { date, match: dateMatch } = parseDate(text);
  const norm = ` ${normalize(text).replace(/[^a-z0-9]+/g, " ")} `;

  // Luật người dùng chạy trước luật mặc định (F08: hybrid, luật trước rồi mới tới LLM)
  const userRule = matchRule(text);
  const rule = KEYWORD_RULES.find((r) => r.keywords.some((k) => norm.includes(k)));
  const inferredIncome = INCOME_HINTS.some((k) => norm.includes(k));
  const categoryId = userRule?.categoryId ?? rule?.categoryId;
  const category = categoryId ? db.categories.find((c) => c.id === categoryId)! : null;
  const type: TransactionType = category?.type ?? (inferredIncome ? "income" : "expense");

  const walletId = norm.includes("momo")
    ? "w-momo"
    : norm.includes("vietcombank") || norm.includes("vcb")
      ? "w-vcb"
      : norm.includes("techcombank") || norm.includes("tcb")
        ? "w-tcb"
        : type === "income"
          ? "w-vcb"
          : "w-cash";

  return {
    rawText: text,
    amount,
    type,
    date,
    description: cleanDescription(text, [amountMatch, dateMatch]) || text,
    categoryId: category?.id ?? (type === "income" ? "c-income-other" : "c-other"),
    // Khớp luật → tin cậy cao; không khớp → "LLM" đoán với độ tin cậy thấp
    confidence: userRule ? 0.97 : rule ? 0.95 : 0.55,
    walletId,
  };
}

export async function createFromQuickEntry(preview: QuickEntryPreview): Promise<QuickEntryResult> {
  await simulateLatency(400);
  if (!preview.amount || preview.amount <= 0) throw new Error("Số tiền chưa hợp lệ");
  const category = db.categories.find((c) => c.id === preview.categoryId)!;

  const transaction: Transaction = {
    id: `t-new-${Date.now()}`,
    userId: db.USER_ID,
    walletId: preview.walletId,
    categoryId: category.id,
    amount: preview.amount,
    type: category.type,
    date: preview.date,
    description: preview.description,
    source: "nlp",
    aiConfidence: preview.confidence,
    status: preview.confidence >= CONFIDENCE_THRESHOLD ? "confirmed" : "pending",
  };
  db.transactions.push(transaction);
  applyToWallet(transaction, 1);

  // Gamification: +10 XP, cập nhật chuỗi ngày và nhiệm vụ "Ghi 3 giao dịch"
  const xp = awardXp("add_transaction");
  let message = db.motivationMessages.find((m) => m.context === "after_transaction")!.template;
  if (recordActivity()) message = `Chuỗi ${db.streak.currentStreak} ngày rồi! ${message}`;
  bumpMission("m-d-3tx");

  emitDataChanged();
  return {
    transaction: toView(transaction),
    xpGained: xp.xp,
    xpLimitReached: xp.limitReached,
    streak: { ...db.streak },
    message,
  };
}
