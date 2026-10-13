/** Xuất dữ liệu người dùng (PRD §8 Quyền riêng tư) — dùng chung cho giao diện và backend */
import type { DataExport } from "./types";

/** CSV giao dịch (mở được bằng Excel: UTF-8 có BOM, dấu phẩy, ngày dd/MM/yyyy) */
export function transactionsToCsv(data: Pick<DataExport, "transactions" | "categories" | "wallets">): string {
  const cat = new Map(data.categories.map((c) => [c.id, c.name]));
  const wallet = new Map(data.wallets.map((w) => [w.id, w.name]));
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [...data.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => {
      const [y, m, d] = t.date.split("-");
      return [
        `${d}/${m}/${y}`,
        q(t.description),
        q(cat.get(t.categoryId) ?? ""),
        q(wallet.get(t.walletId) ?? ""),
        t.type === "income" ? "Thu" : "Chi",
        String(t.type === "income" ? t.amount : -t.amount),
        t.status === "pending" ? "Chờ duyệt" : "Đã xác nhận",
      ].join(",");
    });
  return `﻿${["Ngày,Nội dung,Danh mục,Ví,Loại,Số tiền,Trạng thái", ...rows].join("\r\n")}`;
}
