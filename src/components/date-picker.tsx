"use client";

import { CalendarDays } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { vi } from "react-day-picker/locale/vi";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateToIso, formatDate, isoToDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Chọn một ngày, hiển thị dd/MM/yyyy, lịch tiếng Việt bắt đầu thứ Hai */
export function DatePicker({
  id,
  value,
  onChange,
  max,
  className,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  /** Ngày muộn nhất được chọn (ISO) */
  max?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" className={cn("w-full justify-between border-input font-normal max-md:h-11", className)}>
          <span className="num">{formatDate(value)}</span>
          <CalendarDays aria-hidden className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-xl p-0" align="start">
        <Calendar
          mode="single"
          locale={vi}
          weekStartsOn={1}
          selected={isoToDate(value)}
          defaultMonth={isoToDate(value)}
          disabled={max ? { after: isoToDate(max) } : undefined}
          onSelect={(d) => {
            if (d) {
              onChange(dateToIso(d));
              setOpen(false);
            }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/** Lịch chọn khoảng ngày (dùng trong bộ lọc thời gian) */
export function RangeCalendar({
  value,
  onChange,
  max,
}: {
  value: { from?: string; to?: string };
  onChange: (range: { from?: string; to?: string }) => void;
  max?: string;
}) {
  const selected: DateRange | undefined = value.from
    ? { from: isoToDate(value.from), to: value.to ? isoToDate(value.to) : undefined }
    : undefined;
  return (
    <Calendar
      mode="range"
      locale={vi}
      weekStartsOn={1}
      numberOfMonths={2}
      selected={selected}
      defaultMonth={selected?.from}
      disabled={max ? { after: isoToDate(max) } : undefined}
      onSelect={(r) => onChange({ from: r?.from ? dateToIso(r.from) : undefined, to: r?.to ? dateToIso(r.to) : undefined })}
    />
  );
}
