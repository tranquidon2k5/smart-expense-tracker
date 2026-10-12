import type { TransferInput, TransferView, WalletSummary, WalletTransfer } from "@/types";
import * as db from "./mock/db";
import { scopedTransactions, scopedWallets } from "./mock/queries";
import { failIfErrorScenario, getScenario, simulateLatency } from "./mock/scenario";
import { emitDataChanged } from "./events";
import { formatMoney } from "@/lib/format";

const CURRENT_MONTH = db.MOCK_TODAY.slice(0, 7);

function scopedTransfers(): WalletTransfer[] {
  return getScenario() === "empty" ? [] : db.transfers;
}

function toTransferView(t: WalletTransfer): TransferView {
  return {
    ...t,
    fromWallet: db.wallets.find((w) => w.id === t.fromWalletId)!,
    toWallet: db.wallets.find((w) => w.id === t.toWalletId)!,
  };
}

/** Các ví kèm số dư và thu/chi tháng này (F02) */
export async function listWalletSummaries(): Promise<WalletSummary[]> {
  await simulateLatency(400);
  failIfErrorScenario();
  const txs = scopedTransactions().filter((t) => t.status === "confirmed");
  return scopedWallets().map((w) => {
    const mine = txs.filter((t) => t.walletId === w.id);
    const month = mine.filter((t) => t.date.startsWith(CURRENT_MONTH));
    return {
      ...w,
      monthIncome: month.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      monthExpense: month.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      transactionCount: mine.length,
    };
  });
}

/** Lịch sử chuyển tiền, mới nhất trước; lọc theo ví nếu có */
export async function listTransfers(walletId?: string, limit = 20): Promise<TransferView[]> {
  await simulateLatency(300);
  failIfErrorScenario();
  return scopedTransfers()
    .filter((t) => !walletId || t.fromWalletId === walletId || t.toWalletId === walletId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map(toTransferView);
}

/** Kiểm tra dữ liệu chuyển tiền; trả về câu lỗi tiếng Việt hoặc null */
export function validateTransfer(input: TransferInput, today = db.MOCK_TODAY): string | null {
  const from = db.wallets.find((w) => w.id === input.fromWalletId);
  const to = db.wallets.find((w) => w.id === input.toWalletId);
  if (!from || !to) return "Chọn ví chuyển và ví nhận.";
  if (from.id === to.id) return "Ví chuyển và ví nhận phải khác nhau.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Số tiền phải lớn hơn 0đ.";
  if (input.amount > from.balance) return `Số dư ${from.name} không đủ (còn ${formatMoney(from.balance)}).`;
  if (input.date > today) return "Ngày chuyển không được sau hôm nay.";
  if (input.note.length > 100) return "Ghi chú tối đa 100 ký tự.";
  return null;
}

/** Chuyển tiền giữa hai ví: trừ ví chuyển, cộng ví nhận, không tạo khoản thu/chi */
export async function transfer(input: TransferInput): Promise<TransferView> {
  await simulateLatency(450);
  const error = validateTransfer(input);
  if (error) throw new Error(error);

  const from = db.wallets.find((w) => w.id === input.fromWalletId)!;
  const to = db.wallets.find((w) => w.id === input.toWalletId)!;
  from.balance -= input.amount;
  to.balance += input.amount;

  const record: WalletTransfer = {
    id: `tf-${Date.now()}`,
    userId: db.USER_ID,
    fromWalletId: from.id,
    toWalletId: to.id,
    amount: Math.round(input.amount),
    date: input.date,
    note: input.note.trim(),
    createdAt: new Date().toISOString(),
  };
  db.transfers.unshift(record);
  emitDataChanged();
  return toTransferView(record);
}
