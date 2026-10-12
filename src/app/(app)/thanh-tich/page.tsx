import type { Metadata } from "next";
import { AchievementsPage } from "@/components/achievements/achievements-page";

export const metadata: Metadata = { title: "Thành tích" };

export default function Page() {
  return <AchievementsPage />;
}
