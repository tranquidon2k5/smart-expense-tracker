import { Injectable } from "@nestjs/common";
import { formatMoney } from "@shared/format";
import type { TransferInput, TransferView, Wallet, WalletSummary, WalletType } from "@shared/types";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { badRequest, notFound } from "../common/errors";
import { dbDate, money, toTransfer, toWallet } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { nextMonthStart } from "../transactions/transactions.service";

const WALLET_TYPES: WalletType[] = ["cash", "bank", "ewallet"];

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async list(userId: string): Promise<Wallet[]> {
    const rows = await this.prisma.wallet.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map(toWallet);
  }

  /** Các ví kèm số dư và thu/chi tháng này (F02) — chỉ tính giao dịch đã xác nhận */
  async summaries(user: AuthUser): Promise<WalletSummary[]> {
    const month = this.clock.today(user.timezone).slice(0, 7);
    const [wallets, monthly, counts] = await Promise.all([
      this.list(user.id),
      this.prisma.transaction.groupBy({
        by: ["walletId", "type"],
        where: { userId: user.id, status: "confirmed", date: { gte: dbDate(`${month}-01`), lt: dbDate(nextMonthStart(month)) } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.groupBy({ by: ["walletId"], where: { userId: user.id, status: "confirmed" }, _count: { _all: true } }),
    ]);
    const sum = (walletId: string, type: "income" | "expense") =>
      money(monthly.find((m) => m.walletId === walletId && m.type === type)?._sum.amount);
    return wallets.map((w) => ({
      ...w,
      monthIncome: sum(w.id, "income"),
      monthExpense: sum(w.id, "expense"),
      transactionCount: counts.find((c) => c.walletId === w.id)?._count._all ?? 0,
    }));
  }

  private validateName(name: string | undefined): string {
    const clean = (name ?? "").trim().replace(/\s+/g, " ");
    if (!clean) throw badRequest("Nhập tên ví.", "name");
    if (clean.length > 50) throw badRequest("Tên ví tối đa 50 ký tự.", "name");
    return clean;
  }

  private validateType(type: string): WalletType {
    if (!WALLET_TYPES.includes(type as WalletType)) throw badRequest("Loại ví không hợp lệ.", "type");
    return type as WalletType;
  }

  async create(userId: string, input: { name: string; type: WalletType; balance?: number }): Promise<Wallet> {
    const balance = Math.round(input.balance ?? 0);
    if (!Number.isFinite(balance)) throw badRequest("Số dư ban đầu chưa hợp lệ.", "balance");
    const w = await this.prisma.wallet.create({
      data: { userId, name: this.validateName(input.name), type: this.validateType(input.type), balance: BigInt(balance) },
    });
    return toWallet(w);
  }

  async update(userId: string, id: string, input: { name?: string; type?: WalletType }): Promise<Wallet> {
    const w = await this.prisma.wallet.findFirst({ where: { id, userId } });
    if (!w) throw notFound("Ví không tồn tại.");
    const updated = await this.prisma.wallet.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: this.validateName(input.name) } : {}),
        ...(input.type != null ? { type: this.validateType(input.type) } : {}),
      },
    });
    return toWallet(updated);
  }

  /** Chỉ xoá được ví chưa có giao dịch; luôn giữ ít nhất một ví */
  async remove(userId: string, id: string): Promise<void> {
    const w = await this.prisma.wallet.findFirst({ where: { id, userId } });
    if (!w) throw notFound("Ví không tồn tại.");
    const [txCount, walletCount] = await Promise.all([
      this.prisma.transaction.count({ where: { walletId: id } }),
      this.prisma.wallet.count({ where: { userId } }),
    ]);
    if (txCount) throw badRequest(`Ví đang có ${txCount} giao dịch nên chưa xoá được. Chuyển giao dịch sang ví khác trước nhé.`);
    if (walletCount <= 1) throw badRequest("Cần giữ lại ít nhất một ví.");
    await this.prisma.wallet.delete({ where: { id } });
  }

  // ───────────── Chuyển tiền giữa ví ─────────────

  async transfers(userId: string, walletId?: string, limit = 20): Promise<TransferView[]> {
    const rows = await this.prisma.walletTransfer.findMany({
      where: { userId, ...(walletId ? { OR: [{ fromWalletId: walletId }, { toWalletId: walletId }] } : {}) },
      include: { fromWallet: true, toWallet: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((t) => ({ ...toTransfer(t), fromWallet: toWallet(t.fromWallet), toWallet: toWallet(t.toWallet) }));
  }

  /** Trừ ví chuyển, cộng ví nhận trong cùng một transaction DB; không tạo khoản thu/chi */
  async transfer(user: AuthUser, input: TransferInput): Promise<TransferView> {
    const today = this.clock.today(user.timezone);
    const record = await this.prisma.$transaction(async (db) => {
      const [from, to] = await Promise.all([
        db.wallet.findFirst({ where: { id: input.fromWalletId, userId: user.id } }),
        db.wallet.findFirst({ where: { id: input.toWalletId, userId: user.id } }),
      ]);
      if (!from || !to) throw badRequest("Chọn ví chuyển và ví nhận.");
      if (from.id === to.id) throw badRequest("Ví chuyển và ví nhận phải khác nhau.");
      const amount = Math.round(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw badRequest("Số tiền phải lớn hơn 0đ.", "amount");
      if (amount > money(from.balance)) throw badRequest(`Số dư ${from.name} không đủ (còn ${formatMoney(money(from.balance))}).`, "amount");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) throw badRequest("Ngày chuyển chưa hợp lệ.", "date");
      if (input.date > today) throw badRequest("Ngày chuyển không được sau hôm nay.", "date");
      const note = (input.note ?? "").trim();
      if (note.length > 100) throw badRequest("Ghi chú tối đa 100 ký tự.", "note");

      // Trừ có điều kiện để hai lệnh chuyển đồng thời không làm âm số dư
      const debited = await db.wallet.updateMany({
        where: { id: from.id, balance: { gte: BigInt(amount) } },
        data: { balance: { decrement: BigInt(amount) } },
      });
      if (!debited.count) throw badRequest(`Số dư ${from.name} không đủ.`, "amount");
      await db.wallet.update({ where: { id: to.id }, data: { balance: { increment: BigInt(amount) } } });
      return db.walletTransfer.create({
        data: { userId: user.id, fromWalletId: from.id, toWalletId: to.id, amount: BigInt(amount), date: dbDate(input.date), note, createdAt: this.clock.now() },
        include: { fromWallet: true, toWallet: true },
      });
    });
    return { ...toTransfer(record), fromWallet: toWallet(record.fromWallet), toWallet: toWallet(record.toWallet) };
  }
}
