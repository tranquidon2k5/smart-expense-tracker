import type { Metadata } from "next";
import { SystemStatsPage } from "@/components/admin/system-stats-page";

export const metadata: Metadata = { title: "Thống kê hệ thống" };

export default function Page() {
  return <SystemStatsPage />;
}
