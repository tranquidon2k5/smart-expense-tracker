import type {
  Category,
  ClassificationRule,
  CreateRuleResult,
  DeleteResult,
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
  evaluateBadges,
  normalize,
  recordActivity,
  rememberTransactionXp,
  revokeTransactionXp,
  scopedTransactions,
  scopedWallets,
  toView,
} from "./mock/queries";
import { emitDataChanged } from "./events";
import { extractKeyword, planRuleApplication } from "./rules";
import { CONFIDENCE_THRESHOLD, classifyByRules, guessWallet, parseQuickEntryText } from "@shared/quick-entry";
import { USE_API } from "./data-source";
import { getApiSession } from "./api/session";
import { todayIn } from "@shared/dates";
import * as api from "./api/endpoints";

export { CONFIDENCE_THRESHOLD };

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

/** Ngày "hôm nay" theo múi giờ người dùng (bản mock cố định 12/10/2026) */
export function getToday(): string {
  if (USE_API) {
    // Chưa biết phiên (prerender, trước khi /auth/me trả về): nội dung còn ẩn sau AuthGate → giá trị
    // cố định để server và client render khớp, không đọc đồng hồ lúc prerender
    const session = getApiSession();
    return session ? todayIn(session.timezone ?? "Asia/Ho_Chi_Minh") : db.MOCK_TODAY;
  }
  return db.MOCK_TODAY;
}

export async function listCategories(type?: TransactionType): Promise<Category[]> {
  if (USE_API) return api.transactions.listCategories(type);
  await simulateLatency(150);
  return db.categories.filter((c) => !type || c.type === type);
}

export async function listWallets(): Promise<Wallet[]> {
  if (USE_API) return api.transactions.listWallets();
  await simulateLatency(150);
  return scopedWallets();
}

export async function getRecentTransactions(limit = 8): Promise<TransactionView[]> {
  if (USE_API) return api.transactions.getRecentTransactions(limit);
  await simulateLatency();
  return [...scopedTransactions()].sort(byNewest).slice(0, limit).map(toView);
}

export async function searchTransactions(query: string, limit = 8): Promise<TransactionView[]> {
  if (USE_API) return api.transactions.searchTransactions(query, limit);
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
  if (USE_API) return api.transactions.listTransactions(filter);
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
  if (USE_API) return api.transactions.getTransaction(id);
  await simulateLatency(200);
  failIfErrorScenario();
  const t = scopedTransactions().find((x) => x.id === id);
  return t ? toView(t) : null;
}

/** Hàng chờ duyệt: giao dịch AI phân loại với độ tin cậy < 0,7 */
export async function listPendingTransactions(): Promise<TransactionView[]> {
  if (USE_API) return api.transactions.listPendingTransactions();
  await simulateLatency(400);
  failIfErrorScenario();
  return scopedTransactions()
    .filter((t) => t.status === "pending")
    .sort(byNewest)
    .map(toView);
}

// ───────────── Luật từ khoá (F08) ─────────────

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
  if (USE_API) return api.transactions.previewRule(keyword, categoryId, excludeId);
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
  if (USE_API) return api.transactions.createRule(keyword, categoryId, applyToPending);
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
  if (USE_API) return api.transactions.updateTransaction(id, patch);
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

  const categoryChanged = !!patch.categoryId && patch.categoryId !== prevCategoryId;
  // Sửa danh mục của giao dịch do AI phân loại = dạy AI (huy hiệu "Thầy giáo của AI")
  if (categoryChanged && t.source !== "form") {
    db.session.corrections += 1;
    evaluateBadges();
  }
  const ruleSuggestion = categoryChanged ? buildRuleSuggestion(t, patch.categoryId!) : null;
  emitDataChanged();
  return { transaction: toView(t), ruleSuggestion };
}

/**
 * Xoá giao dịch. Giao dịch được ghi và cộng XP trong hôm nay thì trừ lại đúng số XP đó
 * (PRD §13.1, chống spam ghi rồi xoá); tổng XP không bao giờ âm.
 */
export async function deleteTransactions(ids: string[]): Promise<DeleteResult> {
  if (USE_API) return api.transactions.deleteTransactions(ids);
  await simulateLatency(400);
  let removed = 0;
  let xpRemoved = 0;
  for (const id of ids) {
    const i = db.transactions.findIndex((t) => t.id === id);
    if (i === -1) continue;
    applyToWallet(db.transactions[i], -1);
    db.transactions.splice(i, 1);
    xpRemoved += revokeTransactionXp(id);
    removed += 1;
  }
  emitDataChanged();
  return { removed, xpRemoved };
}

/**
 * Sửa hàng loạt. Đổi danh mục chỉ áp cho giao dịch cùng loại (thu/chi) với danh mục đích.
 */
export async function bulkUpdateTransactions(
  ids: string[],
  patch: Pick<TransactionPatch, "categoryId" | "walletId">,
): Promise<{ updated: number; skipped: number }> {
  if (USE_API) return api.transactions.bulkUpdateTransactions(ids, patch);
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
  if (USE_API) return api.transactions.reviewTransaction(id, categoryId);
  await simulateLatency(300);
  const t = findOrThrow(id);
  const changed = !!categoryId && categoryId !== t.categoryId;
  if (changed) {
    t.categoryId = categoryId!;
    t.type = db.categories.find((c) => c.id === categoryId)!.type;
  }
  t.status = "confirmed";

  const xp = awardXp("review");
  recordActivity("review_transaction");
  bumpMission("m-d-review");
  bumpMission("m-w-review10");
  if (changed) db.session.corrections += 1;
  evaluateBadges();

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

export interface ClassifyResult {
  category: Category | null;
  confidence: number;
  /** rule: luật người dùng/mặc định khớp; llm: AI đoán; none: không đoán được */
  source: "rule" | "llm" | "none";
}

/**
 * Phân loại hybrid (F08, PRD §9.1 bước 4): luật người dùng → luật mặc định → "LLM" đoán.
 * `type` (nếu biết, vd. từ dấu số tiền trong sao kê) loại bỏ danh mục khác loại thu/chi.
 */
export function classifyDescription(text: string, type?: TransactionType): ClassifyResult {
  return classifyByRules(text, { categories: db.categories, userRules: db.classificationRules }, { type, includeGuesses: true });
}

export async function parseQuickEntry(text: string): Promise<QuickEntryPreview> {
  if (USE_API) return api.transactions.parseQuickEntry(text);
  await simulateLatency(700);
  const parsed = parseQuickEntryText(text, db.MOCK_TODAY);
  const guess = classifyDescription(text);
  const type: TransactionType = guess.category?.type ?? parsed.type;
  return {
    rawText: text,
    amount: parsed.amount,
    type,
    date: parsed.date,
    description: parsed.description,
    categoryId: guess.category?.id ?? (type === "income" ? "c-income-other" : "c-other"),
    confidence: guess.category ? guess.confidence : 0.55,
    walletId: guessWallet(text, scopedWallets(), type)?.id ?? "w-cash",
  };
}

export async function createFromQuickEntry(preview: QuickEntryPreview): Promise<QuickEntryResult> {
  if (USE_API) return api.transactions.createFromQuickEntry(preview);
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
  rememberTransactionXp(transaction.id, xp.xp);
  let message = db.motivationMessages.find((m) => m.context === "after_transaction")!.template;
  const activity = recordActivity("add_transaction");
  if (activity.streakIncreased) message = `Chuỗi ${db.streak.currentStreak} ngày rồi! ${message}`;
  bumpMission("m-d-3tx");
  evaluateBadges();

  emitDataChanged();
  return {
    transaction: toView(transaction),
    xpGained: xp.xp,
    xpLimitReached: xp.limitReached,
    streak: { ...db.streak },
    message,
  };
}
