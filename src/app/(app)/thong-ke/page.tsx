import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsPage } from "@/components/stats/stats-page";

export const metadata: Metadata = { title: "Thống kê" };

function PageSkeleton() {
  return (
    <div aria-hidden className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 md:px-6 xl:gap-6 xl:px-8 xl:py-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-2/3" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[108px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[360px] w-full rounded-xl" />
    </div>
  );
}

/** useSearchParams (?tu=&den=) cần Suspense khi bật Cache Components */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StatsPage />
    </Suspense>
  );
}
