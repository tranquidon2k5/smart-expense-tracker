import { Injectable } from "@nestjs/common";
import { CSV_MAX_ROWS, checkRows, mappingErrors, splitDuplicates } from "@shared/csv-import";
import { CONFIDENCE_THRESHOLD } from "@shared/quick-entry";
import type { ImportRequest, ImportResult } from "@shared/types";
import { AiService } from "../ai/ai.service";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { badRequest, notFound } from "../common/errors";
import { TX_INCLUDE, dbDate, isoDate, money, toCategory, toTransactionView, toWallet } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { GamificationService } from "../gamification/gamification.service";
import { TransactionsService } from "../transactions/transactions.service";

/**
 * Nhập sao kê (F09, Luồng 2). Trình duyệt đọc file và ánh xạ cột (D4); server kiểm tra lại
 * từng dòng bằng cùng hàm ở shared/csv-import → loại trùng → phân loại hybrid theo lô → lưu.
 */
@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly ai: AiService,
    private readonly transactions: TransactionsService,
    private readonly gamification: GamificationService,
  ) {}

  async importCsv(user: AuthUser, req: ImportRequest): Promise<ImportResult> {
    const file = req.file;
    if (!file || !Array.isArray(file.rows) || !Array.isArray(file.lineNumbers) || file.rows.length !== file.lineNumbers.length) {
      throw badRequest("Dữ liệu file chưa hợp lệ. Chọn lại file nhé.");
    }
    if (file.rows.length > CSV_MAX_ROWS) throw badRequest(`File có hơn ${CSV_MAX_ROWS} dòng. Hãy chia nhỏ theo tháng.`);
    const missing = Object.values(mappingErrors(req.mapping ?? { date: null, amount: null, description: null }));
    if (missing.length) throw badRequest(`Chưa ánh xạ đủ cột: ${missing.join("; ")}.`);
    if (req.amountMode !== "signed" && req.amountMode !== "all_expense") throw badRequest("Cách đọc số tiền chưa hợp lệ.");
    const wallet = await this.prisma.wallet.findFirst({ where: { id: req.walletId, userId: user.id } });
    if (!wallet) throw notFound("Ví đích không tồn tại.");

    const today = this.clock.today(user.timezone);
    const { candidates, errors } = checkRows(file, req.mapping, req.amountMode, today);
    const dates = candidates.map((c) => c.date).sort();
    const existing = dates.length
      ? await this.prisma.transaction.findMany({
          where: { walletId: wallet.id, date: { gte: dbDate(dates[0]), lte: dbDate(dates.at(-1)!) } },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        })
      : [];
    const { fresh, duplicates } = splitDuplicates(
      candidates,
      existing.map((t) => ({ id: t.id, date: isoDate(t.date), amount: money(t.amount), type: t.type, description: t.description })),
    );

    const [categories, rules] = await Promise.all([
      this.prisma.category.findMany({ where: { OR: [{ userId: null }, { userId: user.id }] } }),
      this.prisma.classificationRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    ]);
    const guesses = await this.ai.classifyMany(
      user.id,
      fresh.map((c) => ({ description: c.description, amount: c.amount, type: c.type })),
      { categories: categories.map(toCategory), rules },
    );
    const fallback = (type: "income" | "expense") =>
      categories.find((c) => c.id === (type === "income" ? "c-income-other" : "c-other")) ?? categories.find((c) => c.type === type);

    const created = await this.prisma.$transaction(
      async (db) => {
        if (!fresh.length) return [];
        const now = this.clock.now();
        const rows = await db.transaction.createManyAndReturn({
          data: fresh.map((c, i) => {
            const g = guesses[i];
            const categoryId = g.categoryId ?? fallback(c.type)?.id;
            if (!categoryId) throw badRequest("Chưa có danh mục mặc định để xếp giao dịch.");
            return {
              userId: user.id,
              walletId: wallet.id,
              categoryId,
              amount: BigInt(c.amount),
              type: c.type,
              date: dbDate(c.date),
              description: c.description,
              source: "csv" as const,
              aiConfidence: g.confidence,
              status: g.confidence >= CONFIDENCE_THRESHOLD ? ("confirmed" as const) : ("pending" as const),
              createdAt: new Date(now.getTime() + i),
            };
          }),
        });
        const delta = rows.reduce((s, t) => s + (t.type === "income" ? money(t.amount) : -money(t.amount)), 0);
        if (delta) await db.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: BigInt(delta) } } });

        // Nhập sao kê giữ chuỗi ngày nhưng không cộng XP theo từng dòng (tránh dồn XP hàng loạt)
        await this.gamification.recordActivity(db, user.id, today, "add_transaction");
        await this.gamification.evaluateBadges(db, user.id, today);
        const touched = new Set(
          rows.filter((t) => t.status === "confirmed" && t.type === "expense").map((t) => `${t.categoryId}|${isoDate(t.date).slice(0, 7)}`),
        );
        for (const key of touched) {
          const [categoryId, month] = key.split("|");
          await this.transactions.checkBudgetAlert(db, user.id, categoryId, month);
        }
        return db.transaction.findMany({
          where: { id: { in: rows.map((t) => t.id) } },
          include: TX_INCLUDE,
          orderBy: { createdAt: "asc" },
        });
      },
      { timeout: 30_000 },
    );

    const finalWallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    return {
      fileName: file.fileName,
      wallet: toWallet(finalWallet),
      created: created.map(toTransactionView),
      confirmedCount: created.filter((t) => t.status === "confirmed").length,
      pendingCount: created.filter((t) => t.status === "pending").length,
      duplicates,
      errors,
    };
  }
}
