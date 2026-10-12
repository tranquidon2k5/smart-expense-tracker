/** Truy vấn nội bộ trên mock db, có áp kịch bản (?demo=empty). Chỉ services dùng. */
import type { Transaction, TransactionView, Wallet } from "@/types";
import * as db from "./db";
import { getScenario } from "./scenario";

export function scopedTransactions(): Transaction[] {
  return getScenario() === "empty" ? [] : db.transactions;
}

export function scopedWallets(): Wallet[] {
  return getScenario() === "empty"
    ? db.wallets.map((w) => ({ ...w, balance: 0 }))
    : db.wallets;
}

export function toView(t: Transaction): TransactionView {
  return {
    ...t,
    category: db.categories.find((c) => c.id === t.categoryId)!,
    wallet: db.wallets.find((w) => w.id === t.walletId)!,
  };
}

export { normalize } from "@/lib/text";
