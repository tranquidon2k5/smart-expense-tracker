import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = { title: "Tổng quan" };

export default function HomePage() {
  return <Dashboard />;
}
