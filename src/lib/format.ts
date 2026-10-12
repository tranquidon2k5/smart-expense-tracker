import type { TransactionType } from "@/types";

const vnd = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** 45000 → "45.000đ" */
export function formatMoney(amount: number): string {
  return `${vnd.format(Math.round(amount))}đ`;
}

const MINUS = "−";

/** Thu → "+45.000đ", Chi → "−45.000đ" */
export function formatSignedMoney(amount: number, type: TransactionType): string {
  return `${type === "income" ? "+" : MINUS}${formatMoney(Math.abs(amount))}`;
}

/** Số dư có thể âm: -45000 → "−45.000đ" */
export function formatBalance(amount: number): string {
  return amount < 0 ? `${MINUS}${formatMoney(-amount)}` : formatMoney(amount);
}

/** Đọc cho trình đọc màn hình: "Chi 45.000 đồng" */
export function moneyLabel(amount: number, type: TransactionType): string {
  return `${type === "income" ? "Thu" : "Chi"} ${vnd.format(Math.abs(amount))} đồng`;
}

/** Rút gọn cho trục biểu đồ: 450000 → "450k", 1200000 → "1,2tr" */
export function formatCompactMoney(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? MINUS : "";
  const fmt = (n: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(n);
  if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000)}tr`;
  if (abs >= 1_000) return `${sign}${fmt(abs / 1_000)}k`;
  return `${sign}${abs}`;
}

/** "2026-10-12" → "12/10/2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-10" → "Tháng 10/2026" */
export function formatMonthLong(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/** "2026-10" → "T10" (trục biểu đồ) */
export function formatMonthShort(month: string): string {
  return `T${Number(month.split("-")[1])}`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(value)}%`;
}

const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

/** "Thứ Hai, 12/10/2026" */
export function formatWeekdayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `${WEEKDAYS[wd]}, ${formatDate(iso)}`;
}
