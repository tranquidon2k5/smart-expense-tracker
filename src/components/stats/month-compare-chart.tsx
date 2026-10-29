"use client";

import { ChartBar, Minus, Table2, TrendingDown, TrendingUp } from "lucide-react";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import type { CategoryComparisonRow, MonthComparison } from "@/types";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Panel } from "@/components/panel";
import { formatCompactMoney, formatDate, formatMoney, formatMonthLong, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/core";
import { statsMessages } from "@/i18n/messages/stats";

const msg = () => getMessages(statsMessages);

const MINUS = "−";

function changeText(a: number, b: number): { text: string; dir: "up" | "down" | "same" } {
  if (a === b) return { text: msg().compare.unchanged, dir: "same" };
  if (a === 0) return { text: `+${formatMoney(b)}`, dir: "up" };
  const pct = ((b - a) / a) * 100;
  return { text: `${pct > 0 ? "+" : MINUS}${formatPercent(Math.abs(pct))}`, dir: pct > 0 ? "up" : "down" };
}

/** Chênh lệch kèm mũi tên + dấu (không chỉ dựa vào màu); chi tăng không tô đỏ để tránh trách móc */
function Change({ a, b }: { a: number; b: number }) {
  const c = changeText(a, b);
  const Icon = c.dir === "up" ? TrendingUp : c.dir === "down" ? TrendingDown : Minus;
  return (
    <span className="num inline-flex items-center justify-end gap-1">
      <Icon aria-hidden className="size-3.5 text-muted-foreground" />
      {c.text}
    </span>
  );
}

function CompareTooltip({ active, payload, labels }: { active?: boolean; payload?: { payload?: CategoryComparisonRow }[]; labels: [string, string] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="grid min-w-48 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs shadow-[0_4px_12px_rgb(19_42_38/0.08)]">
      <p className="flex items-center gap-1.5 font-medium">
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
        {row.name}
      </p>
      <p className="flex justify-between gap-4">
        <span className="text-muted-foreground">{labels[0]}</span>
        <span className="num">{formatMoney(row.amountA)}</span>
      </p>
      <p className="flex justify-between gap-4">
        <span className="text-muted-foreground">{labels[1]}</span>
        <span className="num">{formatMoney(row.amountB)}</span>
      </p>
      <p className="flex justify-between gap-4 border-t pt-1.5">
        <span className="text-muted-foreground">{msg().compare.change}</span>
        <Change a={row.amountA} b={row.amountB} />
      </p>
    </div>
  );
}

function MonthSelect({ id, label, value, months, onChange }: { id: string; label: string; value: string; months: string[]; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-[13px] text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} size="sm" className="w-[150px]">
          <SelectValue>{formatMonthLong(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {[...months].reverse().map((m) => (
            <SelectItem key={m} value={m}>
              {formatMonthLong(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * So sánh chi theo danh mục giữa hai tháng: thanh ngang nhóm theo danh mục,
 * tháng gốc màu xám, tháng so sánh màu chính, nhãn số ở cuối thanh.
 */
export function MonthCompareChart({
  data,
  loading,
  error,
  onRetry,
  months,
  monthA,
  monthB,
  onChange,
  today,
  className,
}: {
  data?: MonthComparison;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  months: string[];
  monthA: string;
  monthB: string;
  onChange: (a: string, b: string) => void;
  today: string;
  className?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const labelA = formatMonthLong(monthA);
  const labelB = formatMonthLong(monthB);
  const rows = data?.rows ?? [];
  const currentMonth = today.slice(0, 7);
  const partial = [monthA, monthB].includes(currentMonth);

  const config = {
    amountA: { label: labelA, color: "var(--compare-prev)" },
    amountB: { label: labelB, color: "var(--primary)" },
  } satisfies ChartConfig;

  let headline = msg().compare.fallback;
  if (data && (data.totalsA.expense || data.totalsB.expense)) {
    const c = changeText(data.totalsA.expense, data.totalsB.expense);
    headline =
      c.dir === "same"
        ? msg().compare.equal(labelB, labelA)
        : msg().compare.diff(labelB, c.dir === "up", labelA, c.text.replace(/^[+−]/, ""));
    // Tháng hiện tại chưa hết: nói rõ để không hiểu nhầm là đã tiết kiệm được
    if (partial) headline += msg().compare.partial(formatMonthLong(currentMonth), formatDate(today));
  }

  return (
    <Panel
      title={msg().compare.title}
      description={headline}
      className={className}
      action={
        rows.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="text-muted-foreground max-md:h-11">
            {asTable ? <ChartBar aria-hidden /> : <Table2 aria-hidden />}
            {asTable ? msg().showChart : msg().showTable}
          </Button>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <MonthSelect id="cmp-a" label={msg().compare.base} value={monthA} months={months} onChange={(m) => onChange(m, monthB)} />
        <MonthSelect id="cmp-b" label={msg().compare.against} value={monthB} months={months} onChange={(m) => onChange(monthA, m)} />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={onRetry} className="min-h-[280px]" />
      ) : loading || !data ? (
        <div aria-hidden className="flex h-[300px] flex-col gap-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="flex-1" />
        </div>
      ) : monthA === monthB ? (
        <EmptyState icon={ChartBar} className="h-[280px]" title={msg().compare.sameTitle} description={msg().compare.sameText} />
      ) : rows.length === 0 ? (
        <EmptyState icon={ChartBar} className="h-[280px]" title={msg().compare.emptyTitle} description={msg().compare.emptyText} />
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
            {[
              [labelA, data.totalsA, "bg-compare-prev"],
              [labelB, data.totalsB, "bg-primary"],
            ].map(([label, totals, swatch]) => {
              const t = totals as MonthComparison["totalsA"];
              return (
                <div key={label as string} className="rounded-lg bg-surface-subtle px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span aria-hidden className={cn("size-2.5 rounded-sm", swatch as string)} />
                    {label as string}
                    {label === formatMonthLong(currentMonth) && (
                      <span>
                        {" "}
                        ({msg().until} <span className="num">{formatDate(today)}</span>)
                      </span>
                    )}
                  </dt>
                  <dd className="num mt-0.5 font-semibold">Chi {formatMoney(t.expense)}</dd>
                  <dd className="num text-xs text-muted-foreground">Thu {formatMoney(t.income)}</dd>
                </div>
              );
            })}
          </dl>

          {asTable ? (
            <Table aria-label={msg().compare.tableLabel(labelA, labelB)}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-2">{msg().category}</TableHead>
                  <TableHead className="px-2 text-right">{labelA}</TableHead>
                  <TableHead className="px-2 text-right">{labelB}</TableHead>
                  <TableHead className="px-2 text-right">{msg().compare.change}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="px-2">{r.name}</TableCell>
                    <TableCell className="num px-2 text-right">{formatMoney(r.amountA)}</TableCell>
                    <TableCell className="num px-2 text-right">{formatMoney(r.amountB)}</TableCell>
                    <TableCell className="px-2 text-right">
                      <Change a={r.amountA} b={r.amountB} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" aria-hidden>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-compare-prev" /> {labelA}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-primary" /> {labelB}
                </span>
                {partial && <span className="text-muted-foreground">{msg().compare.partialNote(formatDate(today))}</span>}
              </div>
              <p className="sr-only">
                {rows.map((r) => `${r.name}: ${labelA} ${formatMoney(r.amountA)}, ${labelB} ${formatMoney(r.amountB)}`).join(". ")}
              </p>
              <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(220, rows.length * 52 + 24) }}>
                <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%" accessibilityLayer>
                  <CartesianGrid horizontal={false} stroke="var(--grid)" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={88} tick={{ fill: "var(--foreground)", fontSize: 13 }} />
                  <ChartTooltip cursor={{ fill: "var(--row-hover)" }} content={<CompareTooltip labels={[labelA, labelB]} />} />
                  {(["amountA", "amountB"] as const).map((key) => (
                    <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[0, 4, 4, 0]} maxBarSize={18}>
                      <LabelList
                        dataKey={key}
                        position="right"
                        formatter={(v: unknown) => formatCompactMoney(Number(v))}
                        style={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-num)" }}
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ChartContainer>
            </>
          )}
        </>
      )}
    </Panel>
  );
}
