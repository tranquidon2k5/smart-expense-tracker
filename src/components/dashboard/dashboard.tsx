"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { useServiceQuery } from "@/hooks/use-service-query";
import { dashboardService, gamificationService, transactionService } from "@/services";
import { formatMonthLong, formatWeekdayDate } from "@/lib/format";
import { CategoryDonut } from "./category-donut";
import { KpiCards } from "./kpi-cards";
import { RecentTransactions } from "./recent-transactions";
import { BudgetWatchPanel, MissionsPanel, MotivationCard } from "./side-panels";
import { TrendChart } from "./trend-chart";

/**
 * Lưới Tổng quan (MASTER.md › Lưới theo trang), ≥ 1280px:
 *  Hàng 1: 4 KPI × 3 cột
 *  Hàng 2: Xu hướng (8) · Cơ cấu chi (4)
 *  Hàng 3: Giao dịch gần đây (8) · Khích lệ + Nhiệm vụ + Ngân sách (4)
 * 1024–1279px: KPI 2×2, các khối 12 cột.
 */
export function Dashboard() {
  const { openQuickAdd } = useQuickAdd();
  const today = transactionService.getToday();
  const month = dashboardService.getCurrentMonth();

  const summary = useServiceQuery(() => dashboardService.getDashboardSummary());
  const trend = useServiceQuery(() => dashboardService.getMonthlyTrend(6));
  const breakdown = useServiceQuery(() => dashboardService.getCategoryBreakdown());
  const recent = useServiceQuery(() => transactionService.getRecentTransactions(8));
  const budgets = useServiceQuery(() => dashboardService.getBudgetWatchlist(4));
  const pending = useServiceQuery(() => dashboardService.getPendingCount());
  const missions = useServiceQuery(() => gamificationService.getTodayMissions());
  const motivation = useServiceQuery(() => gamificationService.getMotivation());

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 md:px-6 xl:gap-8 xl:px-8 xl:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-8 font-bold">Tổng quan {formatMonthLong(month).toLowerCase()}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="num">{formatWeekdayDate(today)}</span> · số liệu tính đến hôm nay
          </p>
        </div>
        {!!pending.data && (
          <Link
            href="/giao-dich?trang-thai=cho-duyet"
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium transition-colors duration-150 hover:bg-row-hover"
          >
            <Sparkles aria-hidden className="size-4 text-info" />
            <span className="num">{pending.data}</span> giao dịch AI chờ bạn duyệt
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4 xl:gap-6" aria-label="Chỉ số chính" role="group">
        <KpiCards summary={summary.data} loading={summary.loading} today={today} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-12 xl:gap-6">
        <TrendChart
          className="xl:col-span-8"
          data={trend.data}
          loading={trend.loading}
          today={today}
          onAddFirst={openQuickAdd}
        />
        <CategoryDonut
          className="xl:col-span-4"
          data={breakdown.data}
          loading={breakdown.loading}
          onAddFirst={openQuickAdd}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 md:gap-5 xl:grid-cols-12 xl:gap-6">
        <RecentTransactions
          className="xl:col-span-8"
          data={recent.data}
          loading={recent.loading}
          onAddFirst={openQuickAdd}
        />
        <div className="flex flex-col gap-4 md:gap-5 xl:col-span-4 xl:gap-6">
          <MotivationCard message={motivation.data} loading={motivation.loading} />
          <MissionsPanel data={missions.data} loading={missions.loading} />
          <BudgetWatchPanel data={budgets.data} loading={budgets.loading} />
        </div>
      </div>
    </div>
  );
}
