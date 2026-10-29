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
import { getMessages } from "@/i18n/core";
import { achievementsMessages } from "@/i18n/messages/achievements";

const msg = () => getMessages(achievementsMessages);
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
        ? msg().streak.restart(streak.longestStreak)
        : msg().streak.first
      : !activeToday && m?.remaining === 1
        ? msg().streak.almost(m.days, m.xp)
        : !activeToday
          ? msg().streak.keep
          : m
            ? msg().streak.kept(m.remaining, m.days)
            : msg().streak.keptAll;

  return (
    <Panel title={msg().streak.title} icon={<Flame aria-hidden className="size-5 text-streak" />}>
      <div className="flex items-end gap-3">
        <span aria-hidden className={cn("inline-flex size-14 items-center justify-center rounded-2xl", activeToday ? "bg-streak-soft text-streak" : "bg-muted text-muted-foreground")}>
          <Flame className={cn("size-8", activeToday && "fill-streak/25")} />
        </span>
        <p>
          <span className="num block text-4xl leading-none font-bold text-streak-text">{streak.currentStreak}</span>
          <span className="text-sm text-muted-foreground">{msg().streak.daysInRow}</span>
        </p>
      </div>
      <p className="mt-3 text-sm">{message}</p>
      {!activeToday && (
        <Button onClick={onLogToday} size="sm" className="mt-3 self-start max-md:h-11">
          {msg().streak.logToday}
        </Button>
      )}
      {m && (
        <div className="mt-4 flex flex-col gap-1.5">
          <Bar value={streak.currentStreak} max={m.days} className="bg-streak" label={msg().streak.toward(m.days)} />
          <p className="text-xs text-muted-foreground">
            {msg().streak.next} <span className="num font-medium text-foreground">{msg().streak.days(m.days)}</span> (+<span className="num">{m.xp}</span> XP)
          </p>
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{msg().streak.best}</dt>
          <dd className="num font-semibold">{msg().streak.days(streak.longestStreak)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{msg().streak.freezes}</dt>
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
      <p className="mt-2 text-xs text-muted-foreground">{msg().streak.freezeNote}</p>
    </Panel>
  );
}

function LevelCard({ data }: { data: AchievementsOverview }) {
  const { level, levelTitle, xpInLevel, xpForNextLevel } = data.status;
  return (
    <Panel title={msg().level.title} icon={<Star aria-hidden className="size-5 text-xp" />}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-2xl bg-xp-soft text-xp-text">
          <span className="num text-2xl font-bold">{level}</span>
        </span>
        <div>
          <p className="text-lg font-semibold">{levelTitle}</p>
          <p className="text-sm text-muted-foreground">
            <span className="num">{msg().level.summary(level, data.totalXp)}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        <Bar value={xpInLevel} max={xpForNextLevel} className="bg-xp" label={msg().level.inLevel(level)} />
        <p className="flex justify-between text-xs text-muted-foreground">
          <span className="num">
            {xpInLevel}/{xpForNextLevel} XP
          </span>
          <span>
            <span className="num">{msg().level.toNext(xpForNextLevel - xpInLevel, level + 1)}</span>
          </span>
        </p>
      </div>
      <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
        {msg().level.nextTitle} <strong className="font-semibold">{data.nextLevelTitle}</strong>
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {msg().level.note}
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
                <span className="sr-only">{completed ? msg().missions.done : msg().missions.notDone}</span>
                {mission.title}
              </span>
              <span className="num shrink-0 text-xs text-muted-foreground">
                {Math.min(progress, mission.target)}/{mission.target}
              </span>
              <span className="num shrink-0 rounded-md bg-xp-soft px-1.5 py-0.5 text-xs font-semibold text-xp-text">+{mission.xp} XP</span>
            </div>
            {!completed && mission.target > 1 && (
              <div className="pl-7">
                <Bar value={progress} max={mission.target} className="bg-primary" label={msg().missions.progress(mission.title)} />
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
          <span className="sr-only">{unlocked ? msg().badges.unlockedSr : msg().badges.lockedSr}</span>
        </p>
        <p className="text-[13px] text-muted-foreground">{v.badge.condition}</p>
        {unlocked ? (
          <p className="mt-1.5 text-xs font-medium text-xp-text">
            {msg().badges.unlockedOn} <span className="num">{formatDate(v.unlockedAt!.slice(0, 10))}</span>
          </p>
        ) : v.progress ? (
          <div className="mt-2 flex flex-col gap-1">
            <Bar value={v.progress.current} max={v.progress.target} className="bg-xp" label={msg().badges.progress(v.badge.name)} />
            <p className="num text-xs text-muted-foreground">
              {v.progress.current}/{v.progress.target}
            </p>
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">{msg().badges.monthEnd}</p>
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
        title={msg().title}
        description={msg().intro}
      />

      {query.error && !data ? (
        <section className="rounded-xl border bg-card">
          <ErrorState title={msg().loadFailed} error={query.error} onRetry={query.refetch} className="min-h-[360px]" />
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
            <Panel title={msg().missions.title} icon={<ListChecks aria-hidden className="size-5 text-muted-foreground" />} className="lg:col-span-2 xl:col-span-1">
              <div className="flex flex-col gap-5">
                <MissionList title={msg().missions.today} items={data.dailyMissions} />
                <MissionList title={msg().missions.week} items={data.weeklyMissions} />
              </div>
            </Panel>
          </div>

          <ActivityHeatmap days={data.days} today={today} />

          <Panel
            title={msg().badges.title}
            icon={<Trophy aria-hidden className="size-5 text-xp" />}
            description={
              <>
                <span className="num">{msg().badges.unlockedOf(unlocked, data.badges.length)}</span>
                {unlocked === 0 && msg().badges.firstHint}
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
