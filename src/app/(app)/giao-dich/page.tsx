import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionsPage } from "@/components/transactions/transactions-page";

export const metadata: Metadata = { title: "Giao dịch" };

function PageSkeleton() {
  return (
    <div aria-hidden className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 md:px-6 xl:px-8 xl:py-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-[480px] w-full rounded-xl" />
    </div>
  );
}

/** useSearchParams cần Suspense khi bật Cache Components */
export default function GiaoDichPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TransactionsPage />
    </Suspense>
  );
}
