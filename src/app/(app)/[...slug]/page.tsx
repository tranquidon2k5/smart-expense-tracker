import type { Metadata } from "next";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Đang xây dựng" };

/** Các mục điều hướng chưa làm (Giao dịch, Ngân sách, …) dẫn về đây thay vì 404 */
export default function ComingSoonPage() {
  return <ComingSoon />;
}
