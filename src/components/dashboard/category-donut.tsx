"use client";

import { ChartPie, Table2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Cell, Label, Pie, PieChart } from "recharts";
import type { CategoryBreakdown, CategorySlice } from "@/types";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { Panel } from "@/components/panel";
import { formatCompactMoney, formatMoney, formatMonthLong, formatPercent } from "@/lib/format";

function sliceHref(s: CategorySlice) {
  return s.categoryId ? `/giao-dich?danh-muc=${s.categoryId}` : "/giao-dich";
}

function SliceTooltip({ active, payload }: { active?: boolean; payload?: { payload?: CategorySlice }[] }) {
  const s = payload?.[0]?.payload;
  if (!active || !s) return null;
  return (
    <div className="grid gap-1 rounded-lg border bg-popover px-3 py-2 text-xs shadow-[0_4px_12px_rgb(19_42_38/0.08)]">
      <p className="flex items-center gap-1.5 font-medium">
        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
        {s.name}
      </p>
      <p className="num">
        {formatMoney(s.amount)} · {formatPercent(s.percent)}
      </p>
    </div>
  );
}

export function CategoryDonut({
  data,
  loading,
  onAddFirst,
  className,
}: {
  data?: CategoryBreakdown;
  loading: boolean;
  onAddFirst: () => void;
  className?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const slices = data?.slices ?? [];
  const top = slices[0];
  const config = Object.fromEntries(slices.map((s) => [s.name, { label: s.name, color: s.color }])) satisfies ChartConfig;

  return (
    <Panel
      title="Chi theo danh mục"
      description={
        top && data
          ? `${top.name} chiếm nhiều nhất: ${formatPercent(top.percent)} tổng chi ${formatMonthLong(data.month).toLowerCase()}`
          : "Tỷ lệ chi tiêu của từng danh mục trong tháng"
      }
      className={className}
      action={
        slices.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            aria-label={asTable ? "Xem biểu đồ" : "Xem dạng bảng"}
            title={asTable ? "Xem biểu đồ" : "Xem dạng bảng"}
            className="text-muted-foreground max-md:size-11"
          >
            {asTable ? <ChartPie aria-hidden /> : <Table2 aria-hidden />}
          </Button>
        )
      }
    >
      {loading ? (
        <div aria-hidden className="flex flex-col items-center gap-5">
          <Skeleton className="size-[184px] rounded-full" />
          <div className="flex w-full flex-col gap-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
      ) : slices.length === 0 ? (
        <EmptyState
          icon={ChartPie}
          className="min-h-[320px]"
          title="Chưa có khoản chi nào tháng này"
          description="Ghi khoản chi đầu tiên để xem tiền của bạn đi đâu."
          action={<Button onClick={onAddFirst}>Ghi khoản chi</Button>}
        />
      ) : asTable ? (
        <Table aria-label="Chi theo danh mục">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-2">Danh mục</TableHead>
              <TableHead className="px-2 text-right">Số tiền</TableHead>
              <TableHead className="px-2 text-right">Tỷ lệ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slices.map((s) => (
              <TableRow key={s.name}>
                <TableCell className="px-2">{s.name}</TableCell>
                <TableCell className="num px-2 text-right">{formatMoney(s.amount)}</TableCell>
                <TableCell className="num px-2 text-right">{formatPercent(s.percent)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-10 xl:flex-col xl:items-stretch xl:gap-5">
          {/* 768–1279px khối rộng 12 cột: donut và chú thích nằm cạnh nhau */}
          <p className="sr-only">
            {slices.map((s) => `${s.name}: ${formatMoney(s.amount)}, ${formatPercent(s.percent)}`).join(". ")}
          </p>
          <ChartContainer config={config} className="mx-auto aspect-square h-[196px] shrink-0 md:mx-0 xl:mx-auto">
            <PieChart accessibilityLayer>
              <ChartTooltip content={<SliceTooltip />} />
              <Pie
                data={slices}
                dataKey="amount"
                nameKey="name"
                innerRadius={62}
                outerRadius={94}
                startAngle={90}
                endAngle={-270}
                stroke="var(--card)"
                strokeWidth={2}
                labelLine={false}
                label={(p: { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; payload?: CategorySlice }) => {
                  const s = p.payload;
                  if (!s || s.percent < 8 || p.cx == null || p.cy == null) return <g />;
                  const r = ((p.innerRadius ?? 0) + (p.outerRadius ?? 0)) / 2;
                  const a = (-(p.midAngle ?? 0) * Math.PI) / 180;
                  return (
                    <text
                      x={p.cx + r * Math.cos(a)}
                      y={p.cy + r * Math.sin(a)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff"
                      fontSize={11}
                      fontWeight={600}
                      fontFamily="var(--font-num)"
                    >
                      {Math.round(s.percent)}%
                    </text>
                  );
                }}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox)) return null;
                    const { cx = 0, cy = 0 } = viewBox as { cx?: number; cy?: number };
                    return (
                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={cx} dy="-0.6em" fontSize={12} fill="var(--muted-foreground)">
                          Tổng chi
                        </tspan>
                        <tspan x={cx} dy="1.5em" fontSize={17} fontWeight={600} fill="var(--foreground)" fontFamily="var(--font-num)">
                          {formatCompactMoney(data!.total)}
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          <ul className="flex flex-col md:max-w-md md:flex-1 xl:max-w-none" aria-label="Chú thích danh mục">
            {slices.map((s) => (
              <li key={s.name}>
                <Link
                  href={sliceHref(s)}
                  className="-mx-2 flex h-9 items-center gap-2.5 rounded-lg px-2 text-sm transition-colors duration-150 hover:bg-row-hover"
                >
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="num text-muted-foreground">{formatPercent(s.percent)}</span>
                  <span className="num w-[92px] text-right font-medium">{formatMoney(s.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
