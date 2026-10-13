import { Injectable } from "@nestjs/common";
import { extractKeyword, planRuleApplication } from "@shared/rules";
import { normalize } from "@shared/text";
import { formatMoney } from "@shared/format";
import type {
  ClassificationRule,
  CreateRuleResult,
  DeleteResult,
  ReviewResult,
  RulePreview,
  RuleSuggestion,
  TransactionFilter,
  TransactionPatch,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  TransactionView,
  UpdateResult,
} from "@shared/types";
import { ClockService } from "../common/clock.service";
import type { Db } from "../common/db";
import { badRequest, notFound } from "../common/errors";
import {
  TX_INCLUDE,
  dbDate,
  isoDate,
  money,
  toRule,
  toTransaction,
  toTransactionView,
  type TransactionWithRelations,
} from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import type { AuthUser } from "../common/auth";
import { GamificationService, type ActivityResult } from "../gamification/gamification.service";

export const TX_NOT_FOUND = "Không tìm thấy giao dịch, có thể đã bị xoá.";
export const AMOUNT_MAX = 100_000_000_000;

export interface NewTransaction {
  walletId: string;
  categoryId: string;
  amount: number;
  date: string;
  description: string;
  source: TransactionSource;
  aiConfidence: number | null;
  status: TransactionStatus;
}

const ORDER = [{ date: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];

/** Ảnh hưởng lên số dư ví: thu +, chi − */
const walletDelta = (type: TransactionType, amount: number) => (type === "income" ? amount : -amount);

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly gamification: GamificationService,
  ) {}

  today(user: AuthUser): string {
    return this.clock.today(user.timezone);
  }

  // ───────────── Kiểm tra quyền sở hữu (không thuộc người dùng → 404) ─────────────

  /** Danh mục người dùng thấy được: mặc định (user_id NULL) + của riêng mình */
  async categoryOrThrow(db: Db, userId: string, id: string) {
    const c = await db.category.findFirst({ where: { id, OR: [{ userId: null }, { userId }] } });
    if (!c) throw notFound("Danh mục không tồn tại.");
    return c;
  }

  async walletOrThrow(db: Db, userId: string, id: string) {
    const w = await db.wallet.findFirst({ where: { id, userId } });
    if (!w) throw notFound("Ví không tồn tại.");
    return w;
  }

  private async ownOrThrow(db: Db, userId: string, id: string) {
    const t = await db.transaction.findFirst({ where: { id, userId } });
    if (!t) throw notFound(TX_NOT_FOUND);
    return t;
  }

  private async view(db: Db, id: string): Promise<TransactionView> {
    return toTransactionView(await db.transaction.findUniqueOrThrow({ where: { id }, include: TX_INCLUDE }));
  }

  private async adjustWallet(db: Db, walletId: string, delta: number) {
    if (delta !== 0) await db.wallet.update({ where: { id: walletId }, data: { balance: { increment: BigInt(delta) } } });
  }

  // ───────────── Đọc ─────────────

  private matchesQuery(t: TransactionWithRelations, q: string) {
    return normalize(`${t.description} ${t.category.name} ${t.wallet.name}`).includes(q);
  }

  /** Danh sách theo bộ lọc, mới nhất trước. `cursor` = vị trí bắt đầu (trang kế tiếp) */
  async list(userId: string, filter: TransactionFilter, page: { limit?: number; cursor?: number } = {}) {
    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { ...(filter.from ? { gte: dbDate(filter.from) } : {}), ...(filter.to ? { lte: dbDate(filter.to) } : {}) },
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.walletIds?.length ? { walletId: { in: filter.walletIds } } : {}),
        ...(filter.categoryIds?.length ? { categoryId: { in: filter.categoryIds } } : {}),
        amount: {
          ...(filter.minAmount != null ? { gte: BigInt(Math.ceil(filter.minAmount)) } : {}),
          ...(filter.maxAmount != null ? { lte: BigInt(Math.floor(filter.maxAmount)) } : {}),
        },
      },
      include: TX_INCLUDE,
      orderBy: ORDER,
    });
    const q = filter.query ? normalize(filter.query.trim()) : "";
    const all = q ? rows.filter((t) => this.matchesQuery(t, q)) : rows;
    const start = page.cursor ?? 0;
    const limit = Math.min(page.limit ?? 5000, 5000);
    const items = all.slice(start, start + limit).map(toTransactionView);
    const next = start + limit < all.length ? start + limit : null;
    return { items, nextCursor: next, total: all.length };
  }

  async recent(userId: string, limit = 8): Promise<TransactionView[]> {
    const rows = await this.prisma.transaction.findMany({ where: { userId }, include: TX_INCLUDE, orderBy: ORDER, take: Math.min(limit, 100) });
    return rows.map(toTransactionView);
  }

  async search(userId: string, query: string, limit = 8): Promise<TransactionView[]> {
    const q = normalize((query ?? "").trim());
    if (!q) return [];
    const { items } = await this.list(userId, { query }, { limit: Math.min(limit, 50) });
    return items;
  }

  async get(userId: string, id: string): Promise<TransactionView> {
    const t = await this.prisma.transaction.findFirst({ where: { id, userId }, include: TX_INCLUDE });
    if (!t) throw notFound(TX_NOT_FOUND);
    return toTransactionView(t);
  }

  async pending(userId: string): Promise<TransactionView[]> {
    const rows = await this.prisma.transaction.findMany({ where: { userId, status: "pending" }, include: TX_INCLUDE, orderBy: ORDER });
    return rows.map(toTransactionView);
  }

  pendingCount(db: Db, userId: string): Promise<number> {
    return db.transaction.count({ where: { userId, status: "pending" } });
  }

  /** Giao dịch theo danh sách id (bỏ qua id không thuộc người dùng / đã xoá), giữ thứ tự đầu vào */
  async byIds(userId: string, ids: string[]): Promise<TransactionView[]> {
    const rows = await this.prisma.transaction.findMany({ where: { userId, id: { in: ids.slice(0, 500) } }, include: TX_INCLUDE });
    const byId = new Map(rows.map((t) => [t.id, t]));
    return ids.flatMap((id) => {
      const t = byId.get(id);
      return t ? [toTransactionView(t)] : [];
    });
  }

  // ───────────── Ghi ─────────────

  private validateAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) throw badRequest("Số tiền phải lớn hơn 0đ.", "amount");
    if (amount > AMOUNT_MAX) throw badRequest("Số tiền quá lớn, bạn kiểm tra lại số 0 nhé.", "amount");
  }

  /**
   * Tạo một giao dịch trong `db` (một transaction DB): cập nhật số dư ví và cảnh báo ngân sách.
   * Không cộng XP — người gọi quyết định (ghi nhanh có XP, nhập CSV thì không).
   */
  async insert(db: Db, userId: string, input: NewTransaction) {
    this.validateAmount(input.amount);
    const [category] = await Promise.all([
      this.categoryOrThrow(db, userId, input.categoryId),
      this.walletOrThrow(db, userId, input.walletId),
    ]);
    const description = input.description.trim().slice(0, 255) || category.name;
    const t = await db.transaction.create({
      data: {
        userId,
        walletId: input.walletId,
        categoryId: category.id,
        amount: BigInt(Math.round(input.amount)),
        type: category.type,
        date: dbDate(input.date),
        description,
        source: input.source,
        aiConfidence: input.aiConfidence,
        status: input.status,
        createdAt: this.clock.now(),
      },
    });
    await this.adjustWallet(db, t.walletId, walletDelta(t.type, money(t.amount)));
    if (t.status === "confirmed" && t.type === "expense") await this.checkBudgetAlert(db, userId, t.categoryId, isoDate(t.date).slice(0, 7));
    return t;
  }

  /**
   * Ghi một giao dịch mới kèm gamification: +10 XP (giới hạn 10 lần/ngày), chuỗi ngày,
   * nhiệm vụ "Ghi 3 giao dịch", huy hiệu.
   */
  async createWithRewards(db: Db, user: AuthUser, input: NewTransaction) {
    const t = await this.insert(db, user.id, input);
    const today = this.today(user);
    const activity: ActivityResult = await this.gamification.recordActivity(db, user.id, today, "add_transaction", {
      xpAction: "add_transaction",
      refId: t.id,
    });
    await this.gamification.bumpMission(db, user.id, "DAILY_3_TX", today);
    await this.gamification.evaluateBadges(db, user.id, today);
    return { transaction: await this.view(db, t.id), activity };
  }

  /** Cảnh báo ngân sách khi chi vượt 80% và 100% hạn mức (mỗi mốc một lần mỗi tháng) */
  async checkBudgetAlert(db: Db, userId: string, categoryId: string, month: string) {
    const budget = await db.budget.findUnique({
      where: { userId_categoryId_month: { userId, categoryId, month } },
      include: { category: true },
    });
    if (!budget) return;
    const sum = await db.transaction.aggregate({
      where: {
        userId,
        categoryId,
        status: "confirmed",
        type: "expense",
        date: { gte: dbDate(`${month}-01`), lt: dbDate(nextMonthStart(month)) },
      },
      _sum: { amount: true },
    });
    const spent = money(sum._sum.amount);
    const limit = money(budget.limitAmount);
    const ratio = spent / limit;
    const level = ratio > 1 ? 100 : ratio >= 0.8 ? 80 : 0;
    if (!level) return;
    const name = budget.category.name;
    const title = level === 100 ? `Ngân sách ${name} đã vượt hạn mức` : `Ngân sách ${name} đã dùng ${Math.floor(ratio * 100)}%`;
    const content =
      level === 100
        ? `Bạn đã chi ${formatMoney(spent)} / ${formatMoney(limit)} cho ${name} tháng này, vượt ${formatMoney(spent - limit)}.`
        : `Bạn đã chi ${formatMoney(spent)} / ${formatMoney(limit)} cho ${name} tháng này. Còn ${formatMoney(limit - spent)}.`;
    await db.notification.createMany({
      data: [
        {
          userId,
          type: "budget_alert",
          title,
          content,
          link: "/ngan-sach",
          dedupeKey: `budget:${budget.id}:${level}`,
          createdAt: this.clock.now(),
        },
      ],
      skipDuplicates: true,
    });
  }

  async update(user: AuthUser, id: string, patch: TransactionPatch): Promise<UpdateResult> {
    if (patch.amount != null) this.validateAmount(patch.amount);
    return this.prisma.$transaction(async (db) => {
      const t = await this.ownOrThrow(db, user.id, id);
      const category = patch.categoryId ? await this.categoryOrThrow(db, user.id, patch.categoryId) : null;
      if (patch.walletId) await this.walletOrThrow(db, user.id, patch.walletId);

      const next = {
        amount: patch.amount != null ? Math.round(patch.amount) : money(t.amount),
        type: category?.type ?? patch.type ?? t.type,
        walletId: patch.walletId ?? t.walletId,
      };
      // Hoàn tác ảnh hưởng cũ lên ví cũ, áp ảnh hưởng mới lên ví mới (kể cả đổi ví / đổi loại)
      await this.adjustWallet(db, t.walletId, -walletDelta(t.type, money(t.amount)));
      await this.adjustWallet(db, next.walletId, walletDelta(next.type, next.amount));
      await db.transaction.update({
        where: { id },
        data: {
          amount: BigInt(next.amount),
          type: next.type,
          walletId: next.walletId,
          ...(category ? { categoryId: category.id } : {}),
          ...(patch.date ? { date: dbDate(patch.date) } : {}),
          ...(patch.description != null ? { description: patch.description.trim().slice(0, 255) || t.description } : {}),
        },
      });

      const categoryChanged = !!category && category.id !== t.categoryId;
      const today = this.today(user);
      if (categoryChanged && t.source !== "form") {
        await this.gamification.recordCorrection(db, user.id);
        await this.gamification.evaluateBadges(db, user.id, today);
      }
      const updated = await db.transaction.findUniqueOrThrow({ where: { id } });
      if (updated.status === "confirmed" && updated.type === "expense") {
        await this.checkBudgetAlert(db, user.id, updated.categoryId, isoDate(updated.date).slice(0, 7));
      }
      const ruleSuggestion = categoryChanged ? await this.buildRuleSuggestion(db, user.id, updated, category.id) : null;
      return { transaction: await this.view(db, id), ruleSuggestion };
    });
  }

  /**
   * Xoá giao dịch. Giao dịch được ghi và cộng XP trong hôm nay thì trừ lại đúng số XP đó
   * (PRD §13.1, chống spam ghi rồi xoá); tổng XP không bao giờ âm.
   */
  async remove(user: AuthUser, ids: string[]): Promise<DeleteResult> {
    const today = this.today(user);
    return this.prisma.$transaction(async (db) => {
      const rows = await db.transaction.findMany({ where: { userId: user.id, id: { in: ids } } });
      let xpRemoved = 0;
      for (const t of rows) {
        await this.adjustWallet(db, t.walletId, -walletDelta(t.type, money(t.amount)));
        xpRemoved += await this.gamification.revokeTransactionXp(db, user.id, t.id, today);
      }
      await db.transaction.deleteMany({ where: { id: { in: rows.map((t) => t.id) } } });
      return { removed: rows.length, xpRemoved };
    });
  }

  /** Sửa hàng loạt. Đổi danh mục chỉ áp cho giao dịch cùng loại (thu/chi) với danh mục đích. */
  async bulkUpdate(user: AuthUser, ids: string[], patch: Pick<TransactionPatch, "categoryId" | "walletId">) {
    return this.prisma.$transaction(async (db) => {
      const category = patch.categoryId ? await this.categoryOrThrow(db, user.id, patch.categoryId) : null;
      if (patch.walletId) await this.walletOrThrow(db, user.id, patch.walletId);
      const rows = await db.transaction.findMany({ where: { userId: user.id, id: { in: ids } } });
      let updated = 0;
      let skipped = 0;
      for (const t of rows) {
        if (category && category.type !== t.type) {
          skipped += 1;
          continue;
        }
        if (patch.walletId && patch.walletId !== t.walletId) {
          const delta = walletDelta(t.type, money(t.amount));
          await this.adjustWallet(db, t.walletId, -delta);
          await this.adjustWallet(db, patch.walletId, delta);
        }
        await db.transaction.update({
          where: { id: t.id },
          data: { ...(patch.walletId ? { walletId: patch.walletId } : {}), ...(category ? { categoryId: category.id } : {}) },
        });
        updated += 1;
      }
      return { updated, skipped };
    });
  }

  /**
   * Duyệt một giao dịch chờ (F08). Có categoryId khác danh mục AI đoán → trả gợi ý tạo luật.
   * +5 XP (giới hạn 10 lần/ngày), tính vào chuỗi ngày và nhiệm vụ duyệt.
   */
  async review(user: AuthUser, id: string, categoryId?: string): Promise<ReviewResult> {
    return this.prisma.$transaction(async (db) => {
      const t = await this.ownOrThrow(db, user.id, id);
      const category = categoryId ? await this.categoryOrThrow(db, user.id, categoryId) : null;
      const changed = !!category && category.id !== t.categoryId;
      if (changed && category.type !== t.type) {
        const amount = money(t.amount);
        await this.adjustWallet(db, t.walletId, walletDelta(category.type, amount) - walletDelta(t.type, amount));
      }
      const wasPending = t.status === "pending";
      await db.transaction.update({
        where: { id },
        data: { status: "confirmed", ...(changed ? { categoryId: category.id, type: category.type } : {}) },
      });

      const today = this.today(user);
      let xp = { xp: 0, limitReached: false };
      if (wasPending) {
        xp = await this.gamification.recordActivity(db, user.id, today, "review_transaction", { xpAction: "review", refId: id });
        await this.gamification.bumpMission(db, user.id, "DAILY_REVIEW_ALL", today);
        await this.gamification.bumpMission(db, user.id, "WEEKLY_REVIEW_10", today);
      }
      if (changed) await this.gamification.recordCorrection(db, user.id);
      await this.gamification.evaluateBadges(db, user.id, today);
      const updated = await db.transaction.findUniqueOrThrow({ where: { id } });
      if (updated.type === "expense") await this.checkBudgetAlert(db, user.id, updated.categoryId, isoDate(updated.date).slice(0, 7));

      return {
        transaction: await this.view(db, id),
        xpGained: xp.xp,
        xpLimitReached: xp.limitReached,
        ruleSuggestion: changed ? await this.buildRuleSuggestion(db, user.id, updated, category.id) : null,
        remainingPending: await this.pendingCount(db, user.id),
      };
    });
  }

  // ───────────── Luật từ khoá (F08) ─────────────

  async listRules(userId: string): Promise<ClassificationRule[]> {
    const rows = await this.prisma.classificationRule.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return rows.map(toRule);
  }

  private async pendingCandidates(db: Db, userId: string) {
    const rows = await db.transaction.findMany({ where: { userId, status: "pending" }, include: TX_INCLUDE, orderBy: ORDER });
    return rows.map((t) => ({ row: t, ...toTransaction(t) }));
  }

  private async buildRuleSuggestion(
    db: Db,
    userId: string,
    t: { id: string; source: TransactionSource; description: string },
    newCategoryId: string,
  ): Promise<RuleSuggestion | null> {
    if (t.source === "form") return null;
    const keyword = extractKeyword(t.description);
    if (!keyword) return null;
    const rules = await db.classificationRule.findMany({ where: { userId, categoryId: newCategoryId } });
    if (rules.some((r) => normalize(r.keyword) === normalize(keyword))) return null;
    const category = await this.categoryOrThrow(db, userId, newCategoryId);
    const matchingPendingCount = planRuleApplication(await this.pendingCandidates(db, userId), keyword, category, t.id).filter(
      (p) => !p.typeMismatch,
    ).length;
    return { transactionId: t.id, keyword, categoryId: newCategoryId, matchingPendingCount };
  }

  /** Xem trước tác động của luật — cùng planRuleApplication với createRule nên luôn khớp kết quả thật */
  async previewRule(userId: string, keyword: string, categoryId: string, excludeId?: string): Promise<RulePreview> {
    const category = await this.categoryOrThrow(this.prisma, userId, categoryId);
    const items = planRuleApplication(await this.pendingCandidates(this.prisma, userId), keyword, category, excludeId).map((p) => ({
      transaction: toTransactionView(p.transaction.row),
      conflict: p.conflict,
      typeMismatch: p.typeMismatch,
    }));
    return {
      keyword: keyword.trim().toUpperCase(),
      categoryId,
      items,
      applicableCount: items.filter((i) => !i.typeMismatch).length,
      conflictCount: items.filter((i) => i.conflict).length,
    };
  }

  /** Tạo luật. Chỉ khi `applyToPending` mới phân loại lại đúng danh sách mà previewRule trả về. */
  async createRule(user: AuthUser, keyword: string, categoryId: string, applyToPending = false): Promise<CreateRuleResult> {
    const clean = (keyword ?? "").trim().toUpperCase();
    if (!clean) throw badRequest("Từ khoá không được để trống.", "keyword");
    if (clean.length > 60) throw badRequest("Từ khoá tối đa 60 ký tự.", "keyword");
    return this.prisma.$transaction(async (db) => {
      const category = await this.categoryOrThrow(db, user.id, categoryId);
      const rule = await db.classificationRule.create({
        data: { userId: user.id, keyword: clean, categoryId, createdFrom: "correction", createdAt: this.clock.now() },
      });
      let appliedCount = 0;
      if (applyToPending) {
        const plan = planRuleApplication(await this.pendingCandidates(db, user.id), clean, category).filter((p) => !p.typeMismatch);
        for (const { transaction } of plan) {
          await db.transaction.update({
            where: { id: transaction.id },
            data: { categoryId, aiConfidence: 0.95, status: "confirmed" },
          });
          appliedCount += 1;
        }
        if (appliedCount) await this.gamification.bumpMission(db, user.id, "DAILY_REVIEW_ALL", this.today(user), appliedCount);
      }
      return { rule: toRule(rule), appliedCount };
    });
  }
}

/** "2026-10" → "2026-11-01" */
export function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}
