"use client";

import { ChartColumn, FileUp } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import type { StatsRange } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Money } from "@/components/money";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { useServiceQuery } from "@/hooks/use-service-query";
import { statsService, transactionService } from "@/services";
import { formatBalance, formatDate, formatMoney, formatMonthLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/core";
import { statsMessages } from "@/i18n/messages/stats";

const msg = () => getMessages(statsMessages);
import { MonthCompareChart } from "./month-compare-chart";
import { StatsTrendChart } from "./stats-trend-chart";
import { TopExpenses } from "./top-expenses";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** "5/2026 – 10/2026" hoặc "tháng 10/2026" */
function rangeLabel(r: StatsRange) {
  const short = (m: string) => `${Number(m.slice(5))}/${m.slice(0, 4)}`;
  return r.from === r.to ? msg().rangeMonth(formatMonthLong(r.from)) : msg().rangeMonths(short(r.from), short(r.to));
}

function Kpi({ label, children, hint, loading }: { label: string; children: React.ReactNode; hint?: React.ReactNode; loading: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 md:p-5">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-24" />
        </>
      ) : (
        <>
          <p className="text-2xl leading-8 font-semibold">{children}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </>
      )}
    </div>
  );
}

/** Chọn khoảng thời gian: nút nhanh + chọn tháng bắt đầu / kết thúc. Trạng thái nằm trên URL (?tu=&den=). */
function RangePicker({ range, months, onChange }: { range: StatsRange; months: string[]; onChange: (r: StatsRange) => void }) {
  const last = months.at(-1) ?? range.to;
  const first = months[0] ?? range.from;
  const clamp = (m: string) => (m < first ? first : m);
  const presets: { label: string; range: StatsRange }[] = [
    { label: msg().presets.thisMonth, range: { from: last, to: last } },
    { label: msg().presets.three, range: { from: clamp(shift(last, -2)), to: last } },
    { label: msg().presets.six, range: { from: clamp(shift(last, -5)), to: last } },
    { label: msg().presets.all, range: { from: first, to: last } },
  ];
  const reversed = [...months].reverse();

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3" role="group" aria-label={msg().rangeGroup}>
      <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label={msg().quickGroup}>
        {presets.map((p, i) => {
          // Hai nút trùng khoảng (vd. "6 tháng" = "Tất cả" khi mới dùng 6 tháng) → chỉ sáng nút đầu tiên
          const same = (r: StatsRange) => r.from === range.from && r.to === range.to;
          const active = same(p.range) && presets.findIndex((q) => same(q.range)) === i;
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(p.range)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:h-10",
                active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-row-hover hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="range-from" className="text-[13px] text-muted-foreground">
          {msg().from}
        </Label>
        <Select value={range.from} onValueChange={(v) => onChange({ from: v, to: v > range.to ? v : range.to })}>
          <SelectTrigger id="range-from" className="w-[150px]">
            <SelectValue>{formatMonthLong(range.from)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {reversed.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonthLong(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label htmlFor="range-to" className="text-[13px] text-muted-foreground">
          {msg().to}
        </Label>
        <Select value={range.to} onValueChange={(v) => onChange({ from: v < range.from ? v : range.from, to: v })}>
          <SelectTrigger id="range-to" className="w-[150px]">
            <SelectValue>{formatMonthLong(range.to)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {reversed.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonthLong(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Thống kê (F06): khoảng thời gian tuỳ chọn, xu hướng, cơ cấu chi, so sánh hai tháng, top 5 khoản chi */
export function StatsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openQuickAdd } = useQuickAdd();
  const today = transactionService.getToday();
  const currentMonth = statsService.getCurrentMonth();

  const fallback = statsService.defaultRange();
  const tu = searchParams.get("tu");
  const den = searchParams.get("den");
  const requested: StatsRange = {
    from: tu && MONTH_RE.test(tu) ? tu : fallback.from,
    to: den && MONTH_RE.test(den) ? den : fallback.to,
  };

  const months = useServiceQuery(() => statsService.getAvailableMonths());
  const stats = useServiceQuery(() => statsService.getStatistics(requested), `${requested.from}|${requested.to}`);
  const range = stats.data?.range ?? requested;

  const [compare, setCompare] = React.useState<[string, string]>([shift(currentMonth, -1), currentMonth]);
  const comparison = useServiceQuery(() => statsService.compareMonths(compare[0], compare[1]), compare.join("|"));

  const setRange = (r: StatsRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tu", r.from);
    params.set("den", r.to);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const monthList = months.data ?? [];
  // Ô chọn tháng: luôn chứa khoảng đang xem kể cả khi danh sách chưa tải xong
  const pickerMonths = monthList.length ? monthList : [range.from, range.to].filter((m, i, a) => a.indexOf(m) === i);
  const data = stats.data;
  const loading = stats.loading;
  const noDataAtAll = months.data !== undefined && data !== undefined && data.transactionCount === 0 && monthList.length <= 1;

  return (
    <PageContainer>
      <PageHeader
        title={msg().title}
        description={
          <>
            {msg().introBefore(rangeLabel(range))}{" "}
            <span className="num">{formatDate(today)}</span>
          </>
        }
      />

      <RangePicker range={range} months={pickerMonths} onChange={setRange} />

      {stats.error ? (
        <Panel>
          <ErrorState title={msg().loadFailed} error={stats.error} onRetry={stats.refetch} />
        </Panel>
      ) : noDataAtAll ? (
        <Panel>
          <EmptyState
            icon={ChartColumn}
            title={msg().emptyTitle}
            description={msg().emptyText}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={openQuickAdd}>{msg().addFirst}</Button>
                <Button variant="outline" asChild>
                  <Link href="/nhap-sao-ke">
                    <FileUp aria-hidden /> {msg().import}
                  </Link>
                </Button>
              </div>
            }
          />
        </Panel>
      ) : (
        <div aria-busy={stats.fetching} className={cn("flex flex-col gap-4 transition-opacity duration-150 md:gap-5 xl:gap-6", stats.fetching && !loading && "opacity-70")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4 xl:gap-6" role="group" aria-label={msg().kpiGroup}>
            <Kpi label={msg().totalIncome} loading={loading} hint={data && <><span className="num">{data.monthCount}</span> {msg().months}</>}>
              {data && <Money amount={data.totals.income} type="income" withIcon />}
            </Kpi>
            <Kpi label={msg().totalExpense} loading={loading} hint={data && <><span className="num">{data.transactionCount}</span> {msg().transactions}</>}>
              {data && <Money amount={data.totals.expense} type="expense" withIcon />}
            </Kpi>
            <Kpi label={msg().net} loading={loading} hint={data && (data.totals.income >= data.totals.expense ? msg().saving : msg().overspending)}>
              {data && <span className="num">{formatBalance(data.totals.income - data.totals.expense)}</span>}
            </Kpi>
            <Kpi label={msg().avgMonthly} loading={loading} hint={data && rangeLabel(data.range)}>
              {data && <span className="num">{formatMoney(data.totals.expense / Math.max(1, data.monthCount))}</span>}
            </Kpi>
          </div>

          <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-12 xl:gap-6">
            <StatsTrendChart className="xl:col-span-8" data={data?.trend} loading={loading} today={today} />
            <CategoryDonut className="xl:col-span-4" data={data?.breakdown} loading={loading} periodLabel={rangeLabel(range)} />
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:gap-5 xl:grid-cols-12 xl:gap-6">
            <MonthCompareChart
              className="xl:col-span-7"
              data={comparison.data}
              loading={comparison.loading || comparison.fetching}
              error={comparison.error}
              onRetry={comparison.refetch}
              months={pickerMonths.length > 1 ? pickerMonths : [compare[0], compare[1]]}
              monthA={compare[0]}
              monthB={compare[1]}
              onChange={(a, b) => setCompare([a, b])}
              today={today}
            />
            <TopExpenses className="xl:col-span-5" data={data?.topExpenses} totalExpense={data?.totals.expense ?? 0} loading={loading} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
