import type { Metadata } from "next";
import { MotivationPage } from "@/components/admin/motivation-page";

export const metadata: Metadata = { title: "Câu khích lệ" };

export default function Page() {
  return <MotivationPage />;
}
