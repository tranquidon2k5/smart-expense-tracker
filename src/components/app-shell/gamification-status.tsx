"use client";

import { Flame, Snowflake, Star } from "lucide-react";
import Link from "next/link";
import type { GamificationStatus } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Pill ngọn lửa chuỗi ngày. Hôm nay chưa ghi → icon outline xám, không dùng đỏ (PRD §6.1) */
export function StreakPill({ status, className }: { status?: GamificationStatus; className?: string }) {
  if (!status) return <Skeleton className={cn("h-9 w-16 rounded-full", className)} />;
  const { streak, activeToday } = status;
  const label = activeToday
    ? `Chuỗi ${streak.currentStreak} ngày. Hôm nay đã ghi chép.`
    : `Chuỗi ${streak.currentStreak} ngày. Hôm nay chưa ghi chép.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/thanh-tich"
          aria-label={label}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3 transition-colors duration-150 max-md:h-11",
            "ring-inset hover:ring-1",
            activeToday ? "bg-streak-soft hover:ring-streak/40" : "bg-muted hover:ring-input/60",
            className,
          )}
        >
          <Flame
            aria-hidden
            className={cn("size-[18px]", activeToday ? "fill-streak/25 text-streak" : "text-muted-foreground")}
          />
          <span className={cn("num text-sm font-semibold", activeToday ? "text-streak-text" : "text-muted-foreground")}>
            {streak.currentStreak}
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-60">
        <p className="font-medium">Chuỗi {streak.currentStreak} ngày · kỷ lục {streak.longestStreak} ngày</p>
        <p className="mt-0.5 opacity-80">
          {activeToday ? "Hôm nay bạn đã giữ lửa rồi." : "Ghi 1 khoản để giữ chuỗi hôm nay."}
        </p>
        {streak.freezeCount > 0 && (
          <p className="mt-1 inline-flex items-center gap-1 opacity-80">
            <Snowflake aria-hidden className="size-3" /> {streak.freezeCount} thẻ đóng băng
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Thanh XP: luôn kèm nhãn số (MASTER.md › Thanh tiến độ) */
export function XpMeter({ status, className }: { status?: GamificationStatus; className?: string }) {
  if (!status) return <Skeleton className={cn("h-9 w-40", className)} />;
  const { level, levelTitle, xpInLevel, xpForNextLevel } = status;
  const pct = Math.min(100, (xpInLevel / xpForNextLevel) * 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/thanh-tich"
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-lg px-2 transition-colors duration-150 hover:bg-row-hover",
            className,
          )}
          aria-label={`Cấp ${level}, ${levelTitle}. ${xpInLevel} trên ${xpForNextLevel} XP`}
        >
          <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-full bg-xp-soft text-xp-text">
            <Star className="size-4 fill-xp/30" />
          </span>
          <span aria-hidden className="flex min-w-0 flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2 text-xs leading-none">
              <span className="font-semibold text-xp-text">
                Cấp <span className="num">{level}</span>
              </span>
              {/* Số XP hiện từ 1280px; nhỏ hơn xem trong tooltip */}
              <span className="num text-muted-foreground max-xl:hidden">
                {xpInLevel}/{xpForNextLevel} XP
              </span>
            </span>
            <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-muted xl:w-28">
              <span className="block h-full rounded-full bg-xp transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </span>
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {levelTitle} · <span className="num">{xpInLevel}/{xpForNextLevel}</span> XP · còn <span className="num">{xpForNextLevel - xpInLevel}</span> XP để lên cấp {level + 1}
      </TooltipContent>
    </Tooltip>
  );
}
