"use client";

import { ChartLine, Info, Table2 } from "lucide-react";
import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { SystemDailyPoint } from "@/types";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/error-state";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { adminService } from "@/services";
import { formatDate, formatPercent } from "@/lib/format";
import { AdminHeader } from "./admin-shell";

const nf = new Intl.NumberFormat("vi-VN");
const n = (v: number) => nf.format(v);

const config = {
  transactions: { label: "Giao dịch", color: "var(--primary)" },
  aiCalls: { label: "Lượt gọi AI", color: "var(--info)" },
} satisfies ChartConfig;

function Swatch({ dashed, color }: { dashed?: boolean; color: string }) {
  return (
    <svg aria-hidden width="18" height="8" className="shrink-0">
      <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2.5" strokeDasharray={dashed ? "4 3" : undefined} />
    </svg>
  );
}

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-card px-3.5 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="num text-xl leading-7 font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function DailyTooltip({ active, payload }: { active?: boolean; payload?: { payload?: SystemDailyPoint }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="grid min-w-44 gap-1 rounded-lg border bg-popover px-3 py-2 text-xs shadow-[0_4px_12px_rgb(19_42_38/0.08)]">
      <p className="num font-medium">{formatDate(p.date)}</p>
      <p className="flex justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Swatch color="var(--primary)" /> Giao dịch
        </span>
        <span className="num">{n(p.transactions)}</span>
      </p>
      <p className="flex justify-between gap-4">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Swatch dashed color="var(--info)" /> Lượt gọi AI
        </span>
        <span className="num">{n(p.aiCalls)}</span>
      </p>
      <p className="flex justify-between gap-4">
        <span className="text-muted-foreground">Gọi AI lỗi</span>
        <span className="num">{n(p.aiFailures)}</span>
      </p>
      <p className="flex justify-between gap-4">
        <span className="text-muted-foreground">Người dùng hoạt động</span>
        <span className="num">{n(p.activeUsers)}</span>
      </p>
    </div>
  );
}

export function SystemStatsPage() {
  const stats = useServiceQuery(() => adminService.getSystemStats());
  const [asTable, setAsTable] = React.useState(false);
  const s = stats.data;

  if (stats.error) {
    return (
      <>
        <AdminHeader title="Thống kê hệ thống" />
        <Panel>
          <ErrorState title="Không tải được thống kê" error={stats.error} onRetry={stats.refetch} />
        </Panel>
      </>
    );
  }

  const first = s?.daily[0];
  const last = s?.daily.at(-1);
  const maxCalls = Math.max(1, ...(s?.aiByFeature.map((f) => f.calls) ?? [1]));

  return (
    <>
      <AdminHeader
        title="Thống kê hệ thống"
        description={first && last ? `30 ngày gần nhất: ${formatDate(first.date)} – ${formatDate(last.date)}` : "30 ngày gần nhất"}
      />

      <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-busy={!s}>
        {!s ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[86px] rounded-lg" />)
        ) : (
          <>
            <Kpi label="Người dùng" value={n(s.totalUsers)} hint={`+${n(s.newUsers30d)} trong 30 ngày`} />
            <Kpi label="Hoạt động 7 ngày" value={n(s.activeUsers7d)} hint={`${formatPercent((s.activeUsers7d / s.totalUsers) * 100)} người dùng`} />
            <Kpi label="Giao dịch 30 ngày" value={n(s.transactions30d)} hint={`Tổng ${n(s.totalTransactions)}`} />
            <Kpi label="Lượt gọi AI 30 ngày" value={n(s.aiCalls30d)} hint={`Thành công ${formatPercent(s.aiSuccessRate * 100, 1)}`} />
            <Kpi label="Độ trễ AI trung bình" value={`${n(s.aiAvgLatencyMs)} ms`} hint="Mục tiêu dưới 3.000 ms" />
            <Kpi
              label="Tỷ lệ giữ chuỗi"
              value={formatPercent(s.streakRetention * 100)}
              hint={`trên ${n(s.streakRetentionBase)} người hoạt động 30 ngày`}
            />
          </>
        )}
      </dl>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel
          title="Giao dịch và lượt gọi AI mỗi ngày"
          className="xl:col-span-8"
          action={
            s && (
              <Button variant="ghost" size="sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)} className="text-muted-foreground">
                {asTable ? <ChartLine aria-hidden /> : <Table2 aria-hidden />}
                {asTable ? "Xem biểu đồ" : "Xem dạng bảng"}
              </Button>
            )
          }
        >
          {!s ? (
            <Skeleton className="h-[260px]" />
          ) : asTable ? (
            <Table aria-label="Số liệu hệ thống theo ngày" containerClassName="max-h-[320px] overflow-y-auto">
              <TableHeader className="sticky top-0 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Ngày</TableHead>
                  <TableHead className="text-right">Giao dịch</TableHead>
                  <TableHead className="text-right">Gọi AI</TableHead>
                  <TableHead className="text-right">AI lỗi</TableHead>
                  <TableHead className="text-right">Người hoạt động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...s.daily].reverse().map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="num">{formatDate(d.date)}</TableCell>
                    <TableCell className="num text-right">{n(d.transactions)}</TableCell>
                    <TableCell className="num text-right">{n(d.aiCalls)}</TableCell>
                    <TableCell className="num text-right">{n(d.aiFailures)}</TableCell>
                    <TableCell className="num text-right">{n(d.activeUsers)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <>
              <div aria-hidden className="mb-2 flex gap-4 text-[13px]">
                <span className="flex items-center gap-1.5">
                  <Swatch color="var(--primary)" /> Giao dịch
                </span>
                <span className="flex items-center gap-1.5">
                  <Swatch dashed color="var(--info)" /> Lượt gọi AI
                </span>
              </div>
              <p className="sr-only">
                Trong 30 ngày có {n(s.transactions30d)} giao dịch và {n(s.aiCalls30d)} lượt gọi AI. Ngày gần nhất {formatDate(last!.date)}: {n(last!.transactions)}{" "}
                giao dịch, {n(last!.aiCalls)} lượt gọi AI.
              </p>
              <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
                <LineChart data={s.daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke="var(--grid)" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={(d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-num)" }}
                  />
                  <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-num)" }} />
                  <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<DailyTooltip />} />
                  <Line dataKey="transactions" type="monotone" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line dataKey="aiCalls" type="monotone" stroke="var(--info)" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </>
          )}
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel title="Lượt gọi AI theo tính năng" description="30 ngày gần nhất">
            {!s ? (
              <Skeleton className="h-40" />
            ) : (
              <Table aria-label="Lượt gọi AI theo tính năng">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-1">Tính năng</TableHead>
                    <TableHead className="px-1 text-right">Lượt gọi</TableHead>
                    <TableHead className="px-1 text-right">Lỗi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.aiByFeature.map((f) => (
                    <TableRow key={f.feature}>
                      <TableCell className="px-1">
                        <span className="flex flex-col gap-1">
                          {f.label}
                          <span aria-hidden className="block h-1.5 rounded-full bg-info" style={{ width: `${(f.calls / maxCalls) * 100}%` }} />
                        </span>
                      </TableCell>
                      <TableCell className="num px-1 text-right">{n(f.calls)}</TableCell>
                      <TableCell className="num px-1 text-right">{formatPercent((f.failures / f.calls) * 100, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
          <Panel>
            <p className="flex gap-2 text-[13px] text-muted-foreground">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Tỷ lệ giữ chuỗi</span> = số người dùng đang có chuỗi ghi chép từ 1 ngày trở lên, chia cho số người
                dùng hoạt động trong 30 ngày. Không gồm tài khoản quản trị.
                {s && s.lockedUsers > 0 && (
                  <>
                    {" "}
                    Hiện có <span className="num">{s.lockedUsers}</span> tài khoản bị khoá.
                  </>
                )}
              </span>
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
