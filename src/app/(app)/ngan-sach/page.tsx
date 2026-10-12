import type { Metadata } from "next";
import { BudgetsPage } from "@/components/budgets/budgets-page";

export const metadata: Metadata = { title: "Ngân sách" };

export default function Page() {
  return <BudgetsPage />;
}
