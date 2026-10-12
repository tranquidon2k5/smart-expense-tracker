import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { TransactionType } from "@/types";
import { formatBalance, formatSignedMoney, moneyLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  amount: number;
  /** Có type → hiển thị dấu +/− và màu thu/chi; không có → số dư trung tính */
  type?: TransactionType;
  /** Hiện icon mũi tên cạnh số (không chỉ dựa vào màu) */
  withIcon?: boolean;
  className?: string;
}

/** Số tiền chuẩn: Inter tabular, định dạng 45.000đ, thu/chi có dấu + icon + màu */
export function Money({ amount, type, withIcon = false, className }: MoneyProps) {
  if (!type) {
    return <span className={cn("num whitespace-nowrap", className)}>{formatBalance(amount)}</span>;
  }
  const Icon = type === "income" ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      className={cn(
        "num inline-flex items-center justify-end gap-1 whitespace-nowrap",
        type === "income" ? "text-income" : "text-expense",
        className,
      )}
      aria-label={moneyLabel(amount, type)}
    >
      {withIcon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span aria-hidden>{formatSignedMoney(amount, type)}</span>
    </span>
  );
}
