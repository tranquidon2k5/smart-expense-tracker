import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";

export type BudgetLevel = "ok" | "warning" | "over";

export interface BudgetStatus {
  level: BudgetLevel;
  icon: LucideIcon;
  /** Nhãn ngắn — luôn đi kèm icon, không chỉ dựa vào màu (MASTER.md) */
  label: string;
  /** Lớp màu chữ / thanh tiến độ theo mức */
  textClass: string;
  barClass: string;
}

/**
 * Ngưỡng cảnh báo ngân sách (PRD F05): đạt 80% → cảnh báo; vượt 100% → vượt hạn mức.
 * Đúng 100% vẫn là cảnh báo ("Đã dùng hết hạn mức"), chưa tính là vượt.
 */
export function budgetStatus(ratio: number): BudgetStatus {
  const t = getMessages(commonMessages).budgetStatus;
  if (ratio > 1) {
    return { level: "over", icon: CircleAlert, label: t.over, textClass: "text-danger", barClass: "bg-danger" };
  }
  if (ratio >= 0.8) {
    return {
      level: "warning",
      icon: TriangleAlert,
      label: ratio >= 1 ? t.used : t.near,
      textClass: "text-warning",
      barClass: "bg-warning",
    };
  }
  return { level: "ok", icon: CircleCheck, label: t.ok, textClass: "text-muted-foreground", barClass: "bg-primary" };
}
