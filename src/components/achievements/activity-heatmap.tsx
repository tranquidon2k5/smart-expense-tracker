"use client";

import { CalendarDays, Snowflake, Table2 } from "lucide-react";
import * as React from "react";
import type { ActivityDay } from "@/types";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Panel } from "@/components/panel";
import { formatMonthLong, formatWeekdayDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/core";
import { achievementsMessages } from "@/i18n/messages/achievements";

const msg = () => getMessages(achievementsMessages);

/** 5 mức teal từ --muted tới --primary (MASTER.md › Lịch ghi chép) */
const LEVEL_BG = ["bg-muted", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-primary"];

function level(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function describe(d: ActivityDay, today: string) {
  const t = msg().heatmap;
  const when = formatWeekdayDate(d.date) + (d.date === today ? t.today : "");
  if (d.frozen) return t.frozen(when);
  if (d.count === 0) return t.none(when);
  return t.count(when, d.count);
}

/**
 * Lịch nhiệt các ngày ghi chép. Đọc được không chỉ bằng màu:
 * - Mỗi ô có nhãn đầy đủ (trình đọc màn hình, tooltip khi rê chuột)
 * - Phím mũi tên di chuyển giữa các ngày, dòng mô tả bên dưới đọc ra số lần ghi chép
 * - Ngày đóng băng có biểu tượng bông tuyết
 * - Có chế độ xem dạng bảng theo tháng
 */
export function ActivityHeatmap({ days, today }: { days: ActivityDay[]; today: string }) {
  const [asTable, setAsTable] = React.useState(false);
  const [active, setActive] = React.useState(days.length - 1);
  const cellRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  // Cột = tuần (bắt đầu thứ Hai), hàng = thứ trong tuần
  const weeks: (ActivityDay & { index: number })[][] = [];
  days.forEach((d, index) => {
    const w = Math.floor(index / 7);
    (weeks[w] ??= []).push({ ...d, index });
  });

  const activeDays = days.filter((d) => d.count > 0).length;
  const totalActions = days.reduce((s, d) => s + d.count, 0);
  const current = days[active];

  const move = (to: number) => {
    const next = Math.max(0, Math.min(days.length - 1, to));
    setActive(next);
    cellRefs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    if (e.key in step) {
      e.preventDefault();
      move(active + step[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(days.length - 1);
    }
  };

  const byMonth = React.useMemo(() => {
    const map = new Map<string, { days: number; actions: number; frozen: number }>();
    for (const d of days) {
      const m = d.date.slice(0, 7);
      const row = map.get(m) ?? { days: 0, actions: 0, frozen: 0 };
      if (d.count > 0) row.days += 1;
      row.actions += d.count;
      if (d.frozen) row.frozen += 1;
      map.set(m, row);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [days]);

  const WEEKDAY_LABELS = msg().heatmap.weekdays;

  return (
    <Panel
      title={msg().heatmap.title}
      icon={<CalendarDays aria-hidden className="size-5 text-muted-foreground" />}
      description={
        <>
          <span className="num">{msg().heatmap.summary(activeDays, totalActions, weeks.length)}</span>
        </>
      }
      action={
        <Button variant="ghost" size="sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)} className="text-muted-foreground max-md:h-11">
          {asTable ? <CalendarDays aria-hidden /> : <Table2 aria-hidden />}
          {asTable ? msg().heatmap.showCalendar : msg().heatmap.showTable}
        </Button>
      }
    >
      {asTable ? (
        <Table aria-label={msg().heatmap.tableLabel}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-2">{msg().heatmap.month}</TableHead>
              <TableHead className="px-2 text-right">{msg().heatmap.activeDays}</TableHead>
              <TableHead className="px-2 text-right">{msg().heatmap.actions}</TableHead>
              <TableHead className="px-2 text-right">{msg().heatmap.frozenDays}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byMonth.map(([m, r]) => (
              <TableRow key={m}>
                <TableCell className="px-2">{formatMonthLong(m)}</TableCell>
                <TableCell className="num px-2 text-right">{r.days}</TableCell>
                <TableCell className="num px-2 text-right">{r.actions}</TableCell>
                <TableCell className="num px-2 text-right">{r.frozen}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex gap-2">
              {/* Nhãn thứ */}
              <div aria-hidden className="grid grid-rows-7 gap-[3px] pt-5 text-[10px] leading-4 text-muted-foreground">
                {WEEKDAY_LABELS.map((l, i) => (
                  <span key={i} className="h-4">
                    {l}
                  </span>
                ))}
              </div>
              <div>
                {/* Nhãn tháng ở tuần chứa ngày mùng 1 */}
                <div aria-hidden className="mb-1 flex h-4 gap-[3px] text-[10px] text-muted-foreground">
                  {weeks.map((w, i) => {
                    const first = w.find((d) => d.date.endsWith("-01"));
                    return (
                      <span key={i} className="num w-4 overflow-visible whitespace-nowrap">
                        {first ? msg().heatmap.monthShort(Number(first.date.slice(5, 7))) : ""}
                      </span>
                    );
                  })}
                </div>
                <div
                  role="grid"
                  aria-label={msg().heatmap.gridLabel}
                  onKeyDown={onKeyDown}
                  className="flex gap-[3px]"
                >
                  {weeks.map((w, wi) => (
                    <div key={wi} role="row" className="grid grid-rows-7 gap-[3px]">
                      {w.map((d) => {
                        const label = describe(d, today);
                        return (
                          <div
                            key={d.date}
                            ref={(el) => {
                              cellRefs.current[d.index] = el;
                            }}
                            role="gridcell"
                            tabIndex={d.index === active ? 0 : -1}
                            aria-label={label}
                            aria-selected={d.index === active}
                            title={label}
                            onMouseEnter={() => setActive(d.index)}
                            onFocus={() => setActive(d.index)}
                            className={cn(
                              "relative inline-flex size-4 items-center justify-center rounded-[3px] outline-none",
                              d.frozen ? "bg-freeze-soft" : LEVEL_BG[level(d.count)],
                              d.date === today && "ring-1 ring-foreground ring-offset-1 ring-offset-card",
                              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            )}
                          >
                            {d.frozen && <Snowflake aria-hidden className="size-3 text-freeze" />}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Dòng mô tả ô đang chọn — đọc được bằng chữ */}
          <p aria-live="polite" className="min-h-5 text-sm">
            {current ? describe(current, today) : null}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label={msg().heatmap.legend}>
            <span className="flex items-center gap-1.5">
              {msg().heatmap.less}
              {LEVEL_BG.map((bg, i) => (
                <span key={i} title={msg().heatmap.levels[i]} className={cn("inline-block size-3.5 rounded-[3px]", bg)} />
              ))}
              {msg().heatmap.more}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex size-3.5 items-center justify-center rounded-[3px] bg-freeze-soft">
                <Snowflake aria-hidden className="size-2.5 text-freeze" />
              </span>
              {msg().heatmap.freezeUsed}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3.5 rounded-[3px] bg-muted ring-1 ring-foreground ring-offset-1" />
              {msg().heatmap.todayLegend}
            </span>
          </div>
        </div>
      )}
    </Panel>
  );
}
