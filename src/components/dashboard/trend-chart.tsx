"use client";

import { ChartLine, Table2 } from "lucide-react";
import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { MonthlyTrendPoint } from "@/types";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Panel } from "@/components/panel";
import {
  formatBalance,
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatMonthLong,
  formatMonthShort,
} from "@/lib/format";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { dashboardMessages } from "@/i18n/messages/dashboard";

const t = () => getMessages(dashboardMessages);

const config = {
  income: {
    get label() {
      return getMessages(commonMessages).income;
    },
    color: "var(--income)",
  },
  expense: {
    get label() {
      return getMessages(commonMessages).expense;
    },
    color: "var(--expense)",
  },
} satisfies ChartConfig;

/** Mẫu nét cho legend: Thu nét đứt, Chi nét liền (không chỉ phân biệt bằng màu) */
function LineSwatch({ dashed, color }: { dashed?: boolean; color: string }) {
  return (
    <svg aria-hidden width="20" height="8" className="shrink-0">
      <line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth="2.5" strokeDasharray={dashed ? "5 3" : undefined} />
    </svg>
  );
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  value?: number;
  payload?: MonthlyTrendPoint;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const point = payload[0].payload;
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs shadow-[0_4px_12px_rgb(19_42_38/0.08)]">
      <p className="font-medium">{formatMonthLong(point.month)}</p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <LineSwatch dashed color="var(--income)" /> {getMessages(commonMessages).income}
        </span>
        <Money amount={point.income} type="income" />
      </p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <LineSwatch color="var(--expense)" /> {getMessages(commonMessages).expense}
        </span>
        <Money amount={point.expense} type="expense" />
      </p>
    </div>
  );
}

export function TrendChart({
  data,
  loading,
  today,
  onAddFirst,
  className,
}: {
  data?: MonthlyTrendPoint[];
  loading: boolean;
  today: string;
  onAddFirst: () => void;
  className?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const currentMonth = today.slice(0, 7);
  const points = data ?? [];
  const enough = points.length >= 4;

  // Tiêu đề là câu trả lời ngắn: chi tháng trước so với trung bình
  const complete = points.filter((p) => p.month !== currentMonth);
  const avgExpense = complete.length ? complete.reduce((s, p) => s + p.expense, 0) / complete.length : 0;
  const last = complete.at(-1);
  const summary =
    last && avgExpense
      ? t().trend.summary(formatMonthLong(last.month), formatCompactMoney(last.expense), last.expense > avgExpense, formatCompactMoney(avgExpense))
      : undefined;

  const lastIndex = points.length - 1;
  const endLabel = (key: "income" | "expense") =>
    function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
      if (props.index !== lastIndex || props.x == null || props.y == null) return <g />;
      return (
        <text
          x={Number(props.x) + 10}
          y={Number(props.y)}
          dy={4}
          fontSize={12}
          fontWeight={600}
          fill={`var(--${key})`}
        >
          {key === "income" ? getMessages(commonMessages).income : getMessages(commonMessages).expense}
        </text>
      );
    };

  return (
    <Panel
      title={t().trend.title}
      description={summary ?? t().trend.fallback}
      className={className}
      action={
        enough && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="text-muted-foreground max-md:h-11"
          >
            {asTable ? <ChartLine aria-hidden /> : <Table2 aria-hidden />}
            {asTable ? t().trend.showChart : t().trend.showTable}
          </Button>
        )
      }
    >
      {loading ? (
        <div aria-hidden className="flex h-[280px] flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="flex-1" />
        </div>
      ) : !enough ? (
        <EmptyState
          icon={ChartLine}
          className="h-[280px]"
          title={points.length === 0 ? t().trend.emptyNone : t().trend.emptyFew}
          description={t().trend.emptyText}
          action={
            points.length === 0 && (
              <Button onClick={onAddFirst}>{t().trend.addFirst}</Button>
            )
          }
        />
      ) : asTable ? (
        <Table aria-label={t().trend.tableLabel}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t().trend.month}</TableHead>
              <TableHead className="text-right">{getMessages(commonMessages).income}</TableHead>
              <TableHead className="text-right">{getMessages(commonMessages).expense}</TableHead>
              <TableHead className="text-right">{t().trend.net}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((p) => (
              <TableRow key={p.month}>
                <TableCell>
                  {formatMonthLong(p.month)}
                  {p.month === currentMonth && <span className="text-muted-foreground"> ({t().trend.until} <span className="num">{formatDate(today)}</span>)</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Money amount={p.income} type="income" />
                </TableCell>
                <TableCell className="text-right">
                  <Money amount={p.expense} type="expense" />
                </TableCell>
                <TableCell className="num text-right">{formatBalance(p.income - p.expense)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" aria-hidden>
            <span className="flex items-center gap-1.5">
              <LineSwatch dashed color="var(--income)" /> {getMessages(commonMessages).income}
            </span>
            <span className="flex items-center gap-1.5">
              <LineSwatch color="var(--expense)" /> {getMessages(commonMessages).expense}
            </span>
            <span className="text-muted-foreground">
              {formatMonthShort(currentMonth)} {t().trend.upTo} <span className="num">{formatDate(today)}</span>
            </span>
          </div>
          <p className="sr-only">
            {points
              .map((p) => t().trend.srPoint(formatMonthLong(p.month), formatMoney(p.income), formatMoney(p.expense)))
              .join(". ")}
          </p>
          <ChartContainer config={config} className="aspect-auto h-[260px] w-full xl:h-auto xl:min-h-[260px] xl:flex-1">
            <LineChart data={points} margin={{ top: 12, right: 36, left: 4, bottom: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tickFormatter={(m: string) => (m === currentMonth ? `${formatMonthShort(m)}*` : formatMonthShort(m))}
                className="num"
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v: number) => formatCompactMoney(v)}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-num)" }}
              />
              <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<TrendTooltip />} />
              <Line
                dataKey="income"
                type="monotone"
                stroke="var(--income)"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3, fill: "var(--card)", strokeDasharray: "" }}
                activeDot={{ r: 5 }}
                label={endLabel("income")}
              />
              <Line
                dataKey="expense"
                type="monotone"
                stroke="var(--expense)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--card)" }}
                activeDot={{ r: 5 }}
                label={endLabel("expense")}
              />
            </LineChart>
          </ChartContainer>
        </div>
      )}
    </Panel>
  );
}
