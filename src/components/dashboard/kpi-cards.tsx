"use client";

import { ArrowDownLeft, ArrowUpRight, Minus, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import type { DashboardSummary } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/money";
import { formatDate, formatMoney, formatMonthLong, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

function KpiCard({
  label,
  icon: Icon,
  children,
  footer,
}: {
  label: string;
  icon: typeof Wallet;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-2 text-[13px] leading-[18px] text-muted-foreground">
        <span>{label}</span>
        <Icon aria-hidden className="size-[18px]" />
      </div>
      <div className="mt-2 text-2xl leading-8 font-semibold">{children}</div>
      {footer && <div className="mt-2 text-[13px] leading-[18px] text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** So sánh với cùng kỳ tháng trước: icon + dấu, màu trung tính (không phán xét) */
function Delta({ current, previous, prevMonthLabel }: { current: number; previous: number; prevMonthLabel: string }) {
  if (previous === 0) return <span>Chưa có số liệu {prevMonthLabel} để so sánh</span>;
  const change = ((current - previous) / previous) * 100;
  const Icon = Math.abs(change) < 0.5 ? Minus : change > 0 ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="num">
        {change > 0 ? "+" : change < 0 ? "−" : ""}
        {formatPercent(Math.abs(change))}
      </span>
      <span>so với cùng kỳ {prevMonthLabel}</span>
    </span>
  );
}

function prevMonthLabel(month: string) {
  const m = Number(month.split("-")[1]);
  return `tháng ${m === 1 ? 12 : m - 1}`;
}

export function KpiCards({ summary, loading, today }: { summary?: DashboardSummary; loading: boolean; today: string }) {
  if (loading || !summary) {
    return (
      <>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 md:p-5" aria-hidden>
            <Skeleton className="h-[18px] w-24" />
            <Skeleton className="mt-2 h-8 w-36" />
            <Skeleton className="mt-2 h-[18px] w-44" />
          </div>
        ))}
      </>
    );
  }

  const { balance, current, previousSamePeriod: prev, budgetTotal, budgetSpent, month } = summary;
  const prevLabel = prevMonthLabel(month);
  const remaining = budgetTotal - budgetSpent;
  const usedRatio = budgetTotal > 0 ? budgetSpent / budgetTotal : 0;
  const barColor = usedRatio > 1 ? "bg-danger" : usedRatio >= 0.8 ? "bg-warning" : "bg-primary";

  return (
    <>
      <KpiCard label="Số dư các ví" icon={Wallet} footer={<span>Tính đến <span className="num">{formatDate(today)}</span></span>}>
        <Money amount={balance} />
      </KpiCard>

      <KpiCard
        label={`Tổng thu ${formatMonthLong(month).toLowerCase()}`}
        icon={ArrowDownLeft}
        footer={<Delta current={current.income} previous={prev.income} prevMonthLabel={prevLabel} />}
      >
        {current.income > 0 ? <Money amount={current.income} type="income" /> : <span className="num">0đ</span>}
      </KpiCard>

      <KpiCard
        label={`Tổng chi ${formatMonthLong(month).toLowerCase()}`}
        icon={ArrowUpRight}
        footer={<Delta current={current.expense} previous={prev.expense} prevMonthLabel={prevLabel} />}
      >
        {current.expense > 0 ? <Money amount={current.expense} type="expense" /> : <span className="num">0đ</span>}
      </KpiCard>

      <KpiCard
        label="Ngân sách còn lại"
        icon={PiggyBank}
        footer={
          budgetTotal > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div
                role="progressbar"
                aria-label="Mức dùng ngân sách tháng"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(usedRatio * 100)}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, usedRatio * 100)}%` }} />
              </div>
              <span>
                Đã dùng <span className="num">{formatPercent(usedRatio * 100)}</span> của{" "}
                <span className="num">{formatMoney(budgetTotal)}</span>
              </span>
            </div>
          ) : (
            <Link href="/ngan-sach" className="font-medium text-primary underline-offset-4 hover:underline">
              Đặt ngân sách tháng này
            </Link>
          )
        }
      >
        {budgetTotal > 0 ? (
          <Money amount={remaining} className={remaining < 0 ? "text-danger" : undefined} />
        ) : (
          <span className="text-muted-foreground">Chưa đặt</span>
        )}
      </KpiCard>
    </>
  );
}
