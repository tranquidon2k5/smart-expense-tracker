import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";

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
  if (ratio > 1) {
    return { level: "over", icon: CircleAlert, label: "Vượt hạn mức", textClass: "text-danger", barClass: "bg-danger" };
  }
  if (ratio >= 0.8) {
    return {
      level: "warning",
      icon: TriangleAlert,
      label: ratio >= 1 ? "Đã dùng hết hạn mức" : "Sắp chạm hạn mức",
      textClass: "text-warning",
      barClass: "bg-warning",
    };
  }
  return { level: "ok", icon: CircleCheck, label: "Trong hạn mức", textClass: "text-muted-foreground", barClass: "bg-primary" };
}
