/**
 * Định dạng hiển thị theo ngôn ngữ giao diện. `shared/format.ts` giữ bản tiếng Việt cho backend và
 * engine trợ lý; ở đây các hàm có chữ được bọc lại theo ngôn ngữ đang render (getActiveLocale).
 */
import * as base from "@shared/format";
import type { TransactionType } from "@/types";
import { getActiveLocale, INTL_LOCALE } from "@/i18n/core";

export { isoToDate, dateToIso, addDaysIso } from "@shared/format";

const MINUS = "−";
const isVi = () => getActiveLocale() === "vi";
const number = (digits = 0) => new Intl.NumberFormat(INTL_LOCALE[getActiveLocale()], { maximumFractionDigits: digits });

/** vi: 45000 → "45.000đ" · en: "45,000₫" */
export function formatMoney(amount: number): string {
  return `${number().format(Math.round(amount))}${isVi() ? "đ" : "₫"}`;
}

/** Thu → "+45.000đ", Chi → "−45.000đ" */
export function formatSignedMoney(amount: number, type: TransactionType): string {
  return `${type === "income" ? "+" : MINUS}${formatMoney(Math.abs(amount))}`;
}

/** Số dư có thể âm: -45000 → "−45.000đ" */
export function formatBalance(amount: number): string {
  return amount < 0 ? `${MINUS}${formatMoney(-amount)}` : formatMoney(amount);
}

/** Đọc cho trình đọc màn hình: "Chi 45.000 đồng" · "Expense 45,000 dong" */
export function moneyLabel(amount: number, type: TransactionType): string {
  if (isVi()) return base.moneyLabel(amount, type);
  return `${type === "income" ? "Income" : "Expense"} ${number().format(Math.abs(amount))} dong`;
}

/** Rút gọn cho trục biểu đồ: vi "450k", "1,2tr", "1,5 tỷ" · en "450K", "1.2M", "1.5B" */
export function formatCompactMoney(amount: number): string {
  if (isVi()) return base.formatCompactMoney(amount);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? MINUS : "";
  const fmt = (n: number) => number(1).format(n);
  if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${fmt(abs / 1_000)}K`;
  return `${sign}${abs}`;
}

/** Ngày luôn dạng dd/MM/yyyy ở cả hai ngôn ngữ (người dùng ở Việt Nam, sao kê ngân hàng cũng ghi vậy) */
export const formatDate = base.formatDate;

const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_EN_SHORT = MONTHS_EN.map((m) => m.slice(0, 3));

/** vi: "Tháng 10/2026" · en: "October 2026" */
export function formatMonthLong(month: string): string {
  if (isVi()) return base.formatMonthLong(month);
  const [y, m] = month.split("-");
  return `${MONTHS_EN[Number(m) - 1]} ${y}`;
}

/** Trục biểu đồ — vi: "T10" · en: "Oct" */
export function formatMonthShort(month: string): string {
  if (isVi()) return base.formatMonthShort(month);
  return MONTHS_EN_SHORT[Number(month.split("-")[1]) - 1];
}

export function formatPercent(value: number, digits = 0): string {
  return `${number(digits).format(value)}%`;
}

const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** vi: "Thứ Hai, 12/10/2026" · en: "Monday, 12/10/2026" */
export function formatWeekdayDate(iso: string): string {
  if (isVi()) return base.formatWeekdayDate(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS_EN[new Date(y, m - 1, d).getDay()]}, ${formatDate(iso)}`;
}
