import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CONFIDENCE_THRESHOLD,
  classifyByRules,
  guessWallet,
  parseQuickEntryText,
} from "@shared/quick-entry";
import type { AiFeature, Category, QuickEntryPreview, QuickEntryResult, TransactionType } from "@shared/types";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { AppConfig } from "../common/config";
import { badRequest } from "../common/errors";
import { toCategory, toStreak, toWallet } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { GamificationService } from "../gamification/gamification.service";
import { TransactionsService } from "../transactions/transactions.service";
import { LLM_PROVIDER, type ClassifyItem, type LlmProvider, type LlmResult } from "./llm.provider";

export class AiTimeoutError extends Error {
  constructor() {
    super("AI quá thời gian");
  }
}

export interface Classification {
  categoryId: string | null;
  confidence: number;
  source: "rule" | "llm" | "none";
}

/** Số dòng gửi trong một request phân loại (gộp lô để tiết kiệm token) */
const CLASSIFY_BATCH = 25;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class AiService {
  private readonly logger = new Logger("AI");

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly clock: ClockService,
    private readonly transactions: TransactionsService,
    private readonly gamification: GamificationService,
  ) {}

  get providerName() {
    return this.provider.name;
  }

  /**
   * Gọi LLM có giới hạn thời gian và ghi ai_logs (feature, token, độ trễ, thành công).
   * Lỗi / quá giờ → ném lỗi để người gọi chuyển sang bộ luật.
   */
  async call<T>(feature: AiFeature, userId: string | null, timeoutMs: number, fn: (signal: AbortSignal) => Promise<LlmResult<T>>): Promise<T> {
    const started = Date.now();
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AiTimeoutError());
      }, timeoutMs);
    });
    let tokens = 0;
    let success = false;
    try {
      const result = await Promise.race([fn(controller.signal), timeout]);
      tokens = result.tokens;
      success = true;
      return result.value;
    } catch (error) {
      this.logger.warn(`${feature} thất bại (${this.provider.name}): ${(error as Error).message}`);
      throw error;
    } finally {
      clearTimeout(timer);
      // Bộ luật không tốn token và không phải "lần gọi AI" — chỉ ghi log khi gọi LLM thật
      if (this.provider.name !== "rules") {
        await this.prisma.aiLog
          .create({
            data: { userId, feature, provider: this.provider.name, tokens, latencyMs: Date.now() - started, success, createdAt: this.clock.now() },
          })
          .catch(() => undefined);
      }
    }
  }

  private async userContext(userId: string) {
    const [categories, rules, wallets] = await Promise.all([
      this.prisma.category.findMany({ where: { OR: [{ userId: null }, { userId }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      this.prisma.classificationRule.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      this.prisma.wallet.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    ]);
    return { categories: categories.map(toCategory), rules, wallets: wallets.map(toWallet) };
  }

  // ───────────── Phân loại hybrid (F08) ─────────────

  /**
   * Luật người dùng → luật mặc định → LLM few-shot (gộp lô). LLM lỗi thì giữ "không đoán được"
   * (độ tin cậy thấp → vào hàng chờ duyệt).
   */
  async classifyMany(userId: string, items: ClassifyItem[], ctx?: { categories: Category[]; rules: { keyword: string; categoryId: string }[] }): Promise<Classification[]> {
    const { categories, rules } = ctx ?? (await this.userContext(userId));
    const out: Classification[] = items.map((item) => {
      const r = classifyByRules(item.description, { categories, userRules: rules }, { type: item.type });
      return { categoryId: r.category?.id ?? null, confidence: r.confidence, source: r.category ? "rule" : "none" };
    });
    const unknown = out.map((c, i) => (c.categoryId ? -1 : i)).filter((i) => i >= 0);
    for (let start = 0; start < unknown.length; start += CLASSIFY_BATCH) {
      const idx = unknown.slice(start, start + CLASSIFY_BATCH);
      try {
        const guesses = await this.call("classify", userId, this.config.get("AI_TIMEOUT_MS") * 2, (signal) =>
          this.provider.classify(idx.map((i) => items[i]), categories, signal),
        );
        guesses.forEach((g, k) => {
          if (g.categoryId) out[idx[k]] = { categoryId: g.categoryId, confidence: g.confidence, source: "llm" };
        });
      } catch {
        // giữ kết quả "none"
      }
    }
    return out;
  }

  // ───────────── Ghi nhanh (F07) ─────────────

  /**
   * Câu tự nhiên → bản xem trước. Bộ luật chạy trước (số tiền, ngày, mô tả) làm dự phòng;
   * LLM trích xuất có cấu trúc trong AI_TIMEOUT_MS. LLM lỗi → dùng kết quả luật với độ tin cậy
   * thấp để người dùng xem lại (PRD §8: AI lỗi vẫn cho nhập).
   */
  async parseQuickEntry(user: AuthUser, rawText: string): Promise<QuickEntryPreview> {
    const text = (rawText ?? "").trim();
    if (!text) throw badRequest("Nhập một câu, ví dụ “ăn phở 45k”.", "text");
    if (text.length > 200) throw badRequest("Câu ghi nhanh tối đa 200 ký tự.", "text");
    const today = this.clock.today(user.timezone);
    const ctx = await this.userContext(user.id);
    const rule = parseQuickEntryText(text, today);

    let amount = rule.amount;
    let type: TransactionType = rule.type;
    let date = rule.date;
    let description = rule.description;
    let llmFailed = false;
    if (this.provider.name !== "rules") {
      try {
        const e = await this.call("extract", user.id, this.config.get("AI_TIMEOUT_MS"), (signal) =>
          this.provider.extract(text, { today }, signal),
        );
        if (e.so_tien != null && Number.isFinite(e.so_tien) && e.so_tien > 0) amount = Math.round(e.so_tien);
        if (e.loai === "income" || e.loai === "expense") type = e.loai;
        if (ISO_DATE.test(e.ngay) && e.ngay <= today) date = e.ngay;
        if (e.mo_ta?.trim()) description = e.mo_ta.trim().slice(0, 255);
      } catch {
        llmFailed = true;
      }
    }

    const [guess] = await this.classifyMany(user.id, [{ description: text, amount: amount ?? undefined }], ctx);
    const category = guess.categoryId ? ctx.categories.find((c) => c.id === guess.categoryId) : undefined;
    const finalType = category?.type ?? type;
    const fallback = ctx.categories.find((c) => c.id === (finalType === "income" ? "c-income-other" : "c-other"))
      ?? ctx.categories.find((c) => c.type === finalType);
    let confidence = category ? guess.confidence : 0.55;
    if (llmFailed) confidence = Math.min(confidence, 0.6);
    return {
      rawText: text,
      amount,
      type: finalType,
      date,
      description,
      categoryId: category?.id ?? fallback?.id ?? null,
      confidence,
      walletId: guessWallet(text, ctx.wallets, finalType)?.id ?? ctx.wallets[0]?.id ?? "",
    };
  }

  /** Lưu bản xem trước (người dùng có thể đã sửa): ≥ 0,7 ghi thẳng, thấp hơn vào hàng chờ duyệt */
  async createFromQuickEntry(user: AuthUser, preview: QuickEntryPreview): Promise<QuickEntryResult> {
    if (!preview.amount || preview.amount <= 0) throw badRequest("Số tiền chưa hợp lệ", "amount");
    if (!preview.categoryId) throw badRequest("Chọn danh mục cho giao dịch.", "categoryId");
    const today = this.clock.today(user.timezone);
    if (!ISO_DATE.test(preview.date ?? "")) throw badRequest("Ngày chưa hợp lệ.", "date");
    if (preview.date > today) throw badRequest("Ngày giao dịch không được sau hôm nay.", "date");
    const confidence = Math.min(Math.max(Number(preview.confidence) || 0, 0), 1);

    return this.prisma.$transaction(async (db) => {
      const { transaction, activity } = await this.transactions.createWithRewards(db, user, {
        walletId: preview.walletId,
        categoryId: preview.categoryId!,
        amount: preview.amount!,
        date: preview.date,
        description: preview.description || preview.rawText,
        source: "nlp",
        aiConfidence: confidence,
        status: confidence >= CONFIDENCE_THRESHOLD ? "confirmed" : "pending",
      });
      let message = await this.gamification.afterTransactionMessage(db);
      if (activity.streakIncreased) message = `Chuỗi ${activity.currentStreak} ngày rồi! ${message}`;
      const streak = await db.userStreak.findUnique({ where: { userId: user.id } });
      return {
        transaction,
        xpGained: activity.xp,
        xpLimitReached: activity.limitReached,
        streak: toStreak(streak, user.id),
        message,
      };
    });
  }
}
