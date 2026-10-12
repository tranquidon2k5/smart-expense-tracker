import { Construction } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Đang xây dựng" };

/** Các mục điều hướng chưa làm (Giao dịch, Ngân sách, …) dẫn về đây thay vì 404 */
export default function ComingSoonPage() {
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-[1600px] flex-col px-4 py-6 md:px-6 xl:px-8">
      <h1 className="sr-only">Trang đang được xây dựng</h1>
      <EmptyState
        icon={Construction}
        title="Trang này đang được xây dựng"
        description="Bản demo hiện mới có trang Tổng quan. Các trang khác sẽ có ở giai đoạn sau."
        action={
          <Button asChild>
            <Link href="/">Về Tổng quan</Link>
          </Button>
        }
      />
    </div>
  );
}
