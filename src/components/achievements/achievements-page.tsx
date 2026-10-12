"use client";

import { CircleCheck, Circle, Flame, ListChecks, Lock, Snowflake, Star, Trophy } from "lucide-react";
import * as React from "react";
import type { AchievementsOverview, BadgeView, MissionProgress } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AchievementIcon } from "@/components/achievement-icon";
import { ErrorState } from "@/components/error-state";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { useServiceQuery } from "@/hooks/use-service-query";
import { gamificationService, transactionService } from "@/services";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ActivityHeatmap } from "./activity-heatmap";

function Bar({ value, max, className, label }: { value: number; max: number; className?: string; label: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className="h-2 overflow-hidden rounded-full bg-muted"
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StreakCard({ data, onLogToday }: { data: AchievementsOverview; onLogToday: () => void }) {
  const { streak, activeToday } = data.status;
  const m = data.nextMilestone;
  // Giọng điệu tích cực, không trách móc (PRD §6.1)
  const message =
    streak.currentStreak === 0
      ? streak.longestStreak
        ? `Bắt đầu lại thôi! Kỷ lục ${streak.longestStreak} ngày vẫn ở đây chờ bạn phá.`
        : "Ghi khoản đầu tiên hôm nay để thắp lửa nhé."
      : !activeToday && m?.remaining === 1
        ? `Ghi 1 khoản hôm nay là chạm mốc ${m.days} ngày, nhận thêm ${m.xp} XP!`
        : !activeToday
          ? "Ghi 1 khoản hôm nay để giữ lửa nhé."
          : m
            ? `Hôm nay đã giữ lửa. Còn ${m.remaining} ngày nữa tới mốc ${m.days} ngày.`
            : "Hôm nay đã giữ lửa. Bạn thật bền bỉ!";

  return (
    <Panel title="Chuỗi ngày" icon={<Flame aria-hidden className="size-5 text-streak" />}>
      <div className="flex items-end gap-3">
        <span aria-hidden className={cn("inline-flex size-14 items-center justify-center rounded-2xl", activeToday ? "bg-streak-soft text-streak" : "bg-muted text-muted-foreground")}>
          <Flame className={cn("size-8", activeToday && "fill-streak/25")} />
        </span>
        <p>
          <span className="num block text-4xl leading-none font-bold text-streak-text">{streak.currentStreak}</span>
          <span className="text-sm text-muted-foreground">ngày liên tiếp</span>
        </p>
      </div>
      <p className="mt-3 text-sm">{message}</p>
      {!activeToday && (
        <Button onClick={onLogToday} size="sm" className="mt-3 self-start max-md:h-11">
          Ghi giao dịch hôm nay
        </Button>
      )}
      {m && (
        <div className="mt-4 flex flex-col gap-1.5">
          <Bar value={streak.currentStreak} max={m.days} className="bg-streak" label={`Tiến tới mốc ${m.days} ngày`} />
          <p className="text-xs text-muted-foreground">
            Mốc tiếp theo: <span className="num font-medium text-foreground">{m.days} ngày</span> (+<span className="num">{m.xp}</span> XP)
          </p>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Kỷ lục</dt>
          <dd className="num font-semibold">{streak.longestStreak} ngày</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Thẻ đóng băng</dt>
          <dd className="flex items-center gap-1.5 font-semibold">
            <span className="num">{streak.freezeCount}</span>/2
            <span aria-hidden className="flex gap-0.5">
              {[0, 1].map((i) => (
                <Snowflake key={i} className={cn("size-4", i < streak.freezeCount ? "text-freeze" : "text-input/50")} />
              ))}
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">Mỗi 7 ngày liên tiếp nhận 1 thẻ; thẻ tự dùng khi bạn bỏ trống 1 ngày.</p>
    </Panel>
  );
}

function LevelCard({ data }: { data: AchievementsOverview }) {
  const { level, levelTitle, xpInLevel, xpForNextLevel } = data.status;
  return (
    <Panel title="Cấp độ" icon={<Star aria-hidden className="size-5 text-xp" />}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-2xl bg-xp-soft text-xp-text">
          <span className="num text-2xl font-bold">{level}</span>
        </span>
        <div>
          <p className="text-lg font-semibold">{levelTitle}</p>
          <p className="text-sm text-muted-foreground">
            Cấp <span className="num">{level}</span> · tổng <span className="num">{data.totalXp}</span> XP
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <Bar value={xpInLevel} max={xpForNextLevel} className="bg-xp" label={`XP trong cấp ${level}`} />
        <p className="flex justify-between text-xs text-muted-foreground">
          <span className="num">
            {xpInLevel}/{xpForNextLevel} XP
          </span>
          <span>
            Còn <span className="num">{xpForNextLevel - xpInLevel}</span> XP tới cấp <span className="num">{level + 1}</span>
          </span>
        </p>
      </div>
      <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
        Cấp kế tiếp: <strong className="font-semibold">{data.nextLevelTitle}</strong>
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        XP đến từ việc ghi chép đều đặn, không phụ thuộc bạn tiêu nhiều hay ít.
      </p>
    </Panel>
  );
}

function MissionList({ title, items }: { title: string; items: MissionProgress[] }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-3">
        {items.map(({ mission, progress, completed }) => (
          <li key={mission.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              {completed ? (
                <CircleCheck aria-hidden className="size-5 shrink-0 text-primary" />
              ) : (
                <Circle aria-hidden className="size-5 shrink-0 text-input" />
              )}
              <span className={cn("min-w-0 flex-1 text-sm", completed && "text-muted-foreground")}>
                <span className="sr-only">{completed ? "Đã xong: " : "Chưa xong: "}</span>
                {mission.title}
              </span>
              <span className="num shrink-0 text-xs text-muted-foreground">
                {Math.min(progress, mission.target)}/{mission.target}
              </span>
              <span className="num shrink-0 rounded-md bg-xp-soft px-1.5 py-0.5 text-xs font-semibold text-xp-text">+{mission.xp} XP</span>
            </div>
            {!completed && mission.target > 1 && (
              <div className="pl-7">
                <Bar value={progress} max={mission.target} className="bg-primary" label={`Tiến độ: ${mission.title}`} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BadgeCard({ v }: { v: BadgeView }) {
  const unlocked = !!v.unlockedAt;
  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border p-4",
        unlocked ? "border-2 border-xp/60 bg-xp-soft/50" : "bg-card",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex size-12 shrink-0 items-center justify-center rounded-full",
          unlocked ? "bg-xp-soft text-xp-text" : "bg-muted text-muted-foreground",
        )}
      >
        <AchievementIcon name={v.badge.icon} className="size-6" />
        {!unlocked && (
          <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full border bg-card">
            <Lock className="size-3" />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {v.badge.name}
          <span className="sr-only">{unlocked ? " — đã mở khoá" : " — chưa mở khoá"}</span>
        </p>
        <p className="text-[13px] text-muted-foreground">{v.badge.condition}</p>
        {unlocked ? (
          <p className="mt-1.5 text-xs font-medium text-xp-text">
            Mở khoá <span className="num">{formatDate(v.unlockedAt!.slice(0, 10))}</span>
          </p>
        ) : v.progress ? (
          <div className="mt-2 flex flex-col gap-1">
            <Bar value={v.progress.current} max={v.progress.target} className="bg-xp" label={`Tiến độ huy hiệu ${v.badge.name}`} />
            <p className="num text-xs text-muted-foreground">
              {v.progress.current}/{v.progress.target}
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">Được xét vào cuối tháng.</p>
        )}
      </div>
    </li>
  );
}

export function AchievementsPage() {
  const today = transactionService.getToday();
  const { openQuickAdd } = useQuickAdd();
  const query = useServiceQuery(() => gamificationService.getAchievements());
  const data = query.data;
  const unlocked = data?.badges.filter((b) => b.unlockedAt).length ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Thành tích"
        description="Thưởng cho thói quen ghi chép đều đặn. Chỉ mình bạn thấy trang này."
      />

      {query.error && !data ? (
        <section className="rounded-xl border bg-card">
          <ErrorState title="Không tải được thành tích" error={query.error} onRetry={query.refetch} className="min-h-[360px]" />
        </section>
      ) : query.loading || !data ? (
        <div aria-hidden className="flex flex-col gap-5">
          <div className="grid gap-4 md:gap-5 xl:grid-cols-3 xl:gap-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[320px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[220px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      ) : (
        <>
          <div className="grid items-start gap-4 md:gap-5 lg:grid-cols-2 xl:grid-cols-3 xl:gap-6">
            <StreakCard data={data} onLogToday={openQuickAdd} />
            <LevelCard data={data} />
            <Panel title="Nhiệm vụ" icon={<ListChecks aria-hidden className="size-5 text-muted-foreground" />} className="lg:col-span-2 xl:col-span-1">
              <div className="flex flex-col gap-5">
                <MissionList title="Hôm nay" items={data.dailyMissions} />
                <MissionList title="Tuần này" items={data.weeklyMissions} />
              </div>
            </Panel>
          </div>

          <ActivityHeatmap days={data.days} today={today} />

          <Panel
            title="Bộ sưu tập huy hiệu"
            icon={<Trophy aria-hidden className="size-5 text-xp" />}
            description={
              <>
                Đã mở <span className="num">{unlocked}</span>/<span className="num">{data.badges.length}</span> huy hiệu
                {unlocked === 0 && " — huy hiệu đầu tiên chỉ cách bạn một giao dịch!"}
              </>
            }
          >
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...data.badges]
                .sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt))
                .map((v) => (
                  <BadgeCard key={v.badge.id} v={v} />
                ))}
            </ul>
          </Panel>
        </>
      )}
    </PageContainer>
  );
}
