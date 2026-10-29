"use client";

import { ChartColumn, ChartLine, Table2 } from "lucide-react";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { MonthlyTrendPoint } from "@/types";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Panel } from "@/components/panel";
import { formatBalance, formatCompactMoney, formatDate, formatMoney, formatMonthLong, formatMonthShort } from "@/lib/format";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { statsMessages } from "@/i18n/messages/stats";

const msg = () => getMessages(statsMessages);
const common = () => getMessages(commonMessages);

const config = {
  income: {
    get label() {
      return common().income;
    },
    color: "var(--income)",
  },
  expense: {
    get label() {
      return common().expense;
    },
    color: "var(--expense)",
  },
} satisfies ChartConfig;

/** Ký hiệu chú thích: Thu nét đứt / cột viền đứt, Chi nét liền (không chỉ phân biệt bằng màu) */
function Swatch({ dashed, color, bar }: { dashed?: boolean; color: string; bar?: boolean }) {
  return bar ? (
    <svg aria-hidden width="14" height="12" className="shrink-0">
      <rect x="1" y="1" width="12" height="10" rx="2" fill={color} fillOpacity={dashed ? 0.25 : 1} stroke={color} strokeWidth="1.5" strokeDasharray={dashed ? "3 2" : undefined} />
    </svg>
  ) : (
    <svg aria-hidden width="20" height="8" className="shrink-0">
      <line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth="2.5" strokeDasharray={dashed ? "5 3" : undefined} />
    </svg>
  );
}

function TrendTooltip({ active, payload, bar }: { active?: boolean; payload?: { payload?: MonthlyTrendPoint }[]; bar?: boolean }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs shadow-[0_4px_12px_rgb(19_42_38/0.08)]">
      <p className="font-medium">{formatMonthLong(point.month)}</p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Swatch dashed bar={bar} color="var(--income)" /> Thu
        </span>
        <Money amount={point.income} type="income" />
      </p>
      <p className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Swatch bar={bar} color="var(--expense)" /> Chi
        </span>
        <Money amount={point.expense} type="expense" />
      </p>
    </div>
  );
}

/**
 * Xu hướng thu/chi theo tháng trong khoảng đã chọn (MASTER.md › Charts):
 * từ 4 tháng → đường (Thu nét đứt, Chi nét liền, nhãn cuối đường); ít hơn → cột nhóm.
 */
export function StatsTrendChart({
  data,
  loading,
  today,
  className,
}: {
  data?: MonthlyTrendPoint[];
  loading: boolean;
  today: string;
  className?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const points = data ?? [];
  const currentMonth = today.slice(0, 7);
  const hasData = points.some((p) => p.income || p.expense);
  const asLine = points.length >= 4;

  const complete = points.filter((p) => p.month !== currentMonth && (p.income || p.expense));
  const peak = complete.reduce<MonthlyTrendPoint | null>((m, p) => (!m || p.expense > m.expense ? p : m), null);
  const avg = complete.length ? complete.reduce((s, p) => s + p.expense, 0) / complete.length : 0;
  const summary =
    peak && complete.length > 1
      ? msg().trend.summary(formatCompactMoney(avg), formatMonthLong(peak.month), formatCompactMoney(peak.expense))
      : msg().trend.fallback;

  const lastIndex = points.length - 1;
  const endLabel = (key: "income" | "expense") =>
    function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
      if (props.index !== lastIndex || props.x == null || props.y == null) return <g />;
      return (
        <text x={Number(props.x) + 10} y={Number(props.y)} dy={4} fontSize={12} fontWeight={600} fill={`var(--${key})`}>
          {key === "income" ? common().income : common().expense}
        </text>
      );
    };

  const xAxis = (
    <XAxis
      dataKey="month"
      tickLine={false}
      axisLine={false}
      tickMargin={10}
      tickFormatter={(m: string) => (m === currentMonth ? `${formatMonthShort(m)}*` : formatMonthShort(m))}
      tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-num)" }}
    />
  );
  const yAxis = (
    <YAxis
      tickLine={false}
      axisLine={false}
      width={52}
      tickFormatter={(v: number) => formatCompactMoney(v)}
      tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-num)" }}
    />
  );

  return (
    <Panel
      title={msg().trend.title}
      description={summary}
      className={className}
      action={
        hasData && (
          <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="text-muted-foreground max-md:h-11">
            {asTable ? asLine ? <ChartLine aria-hidden /> : <ChartColumn aria-hidden /> : <Table2 aria-hidden />}
            {asTable ? msg().showChart : msg().showTable}
          </Button>
        )
      }
    >
      {loading ? (
        <div aria-hidden className="flex h-[280px] flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="flex-1" />
        </div>
      ) : !hasData ? (
        <EmptyState icon={ChartLine} className="h-[280px]" title={msg().trend.emptyTitle} description={msg().trend.emptyText} />
      ) : asTable ? (
        <Table aria-label={msg().trend.tableLabel}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{msg().month}</TableHead>
              <TableHead className="text-right">{common().income}</TableHead>
              <TableHead className="text-right">{common().expense}</TableHead>
              <TableHead className="text-right">{msg().netShort}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((p) => (
              <TableRow key={p.month}>
                <TableCell>
                  {formatMonthLong(p.month)}
                  {p.month === currentMonth && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({msg().until} <span className="num">{formatDate(today)}</span>)
                    </span>
                  )}
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
              <Swatch dashed bar={!asLine} color="var(--income)" /> {common().income}
            </span>
            <span className="flex items-center gap-1.5">
              <Swatch bar={!asLine} color="var(--expense)" /> {common().expense}
            </span>
            {points.some((p) => p.month === currentMonth) && (
              <span className="text-muted-foreground">
                {formatMonthShort(currentMonth)}* {msg().upTo} <span className="num">{formatDate(today)}</span>
              </span>
            )}
          </div>
          <p className="sr-only">
            {points.map((p) => msg().trend.srPoint(formatMonthLong(p.month), formatMoney(p.income), formatMoney(p.expense))).join(". ")}
          </p>
          <ChartContainer config={config} className="aspect-auto h-[280px] w-full xl:h-auto xl:min-h-[280px] xl:flex-1">
            {asLine ? (
              <LineChart data={points} margin={{ top: 12, right: 36, left: 4, bottom: 0 }} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                {xAxis}
                {yAxis}
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
                <Line dataKey="expense" type="monotone" stroke="var(--expense)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--card)" }} activeDot={{ r: 5 }} label={endLabel("expense")} />
              </LineChart>
            ) : (
              <BarChart data={points} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} barGap={4} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                {xAxis}
                {yAxis}
                <ChartTooltip cursor={{ fill: "var(--row-hover)" }} content={<TrendTooltip bar />} />
                <Bar dataKey="income" fill="var(--income)" fillOpacity={0.25} stroke="var(--income)" strokeWidth={1.5} strokeDasharray="4 3" radius={[4, 4, 0, 0]} maxBarSize={48} />
                <Bar dataKey="expense" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            )}
          </ChartContainer>
        </div>
      )}
    </Panel>
  );
}
