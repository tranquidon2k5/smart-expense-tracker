"use client";

import { AlertTriangle, CircleAlert, CircleCheck, Circle, ListChecks, PiggyBank, Sparkles } from "lucide-react";
import Link from "next/link";
import type { BudgetProgress, MissionProgress } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Panel } from "@/components/panel";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Câu khích lệ hôm nay — khối phẳng nền primary-soft (PRD §6.6) */
export function MotivationCard({ message, loading }: { message?: string; loading: boolean }) {
  return (
    <section aria-label="Câu khích lệ hôm nay" className="flex gap-3 rounded-xl bg-accent p-4 md:p-5">
      <Sparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      {loading || !message ? (
        <div aria-hidden className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-full bg-card/70" />
          <Skeleton className="h-4 w-2/3 bg-card/70" />
        </div>
      ) : (
        <p className="text-base leading-6 text-foreground">{message}</p>
      )}
    </section>
  );
}

export function MissionsPanel({ data, loading }: { data?: MissionProgress[]; loading: boolean }) {
  const done = data?.filter((m) => m.completed).length ?? 0;
  return (
    <Panel
      title="Nhiệm vụ hôm nay"
      icon={<ListChecks aria-hidden className="size-5 text-muted-foreground" />}
      action={
        data && (
          <span className="num text-[13px] text-muted-foreground" aria-label={`Đã xong ${done} trên ${data.length} nhiệm vụ`}>
            {done}/{data.length}
          </span>
        )
      }
    >
      {loading || !data ? (
        <div aria-hidden className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {data.map(({ mission, progress, completed }) => (
            <li key={mission.id} className="flex min-h-10 items-center gap-3">
              {completed ? (
                <CircleCheck aria-hidden className="size-5 shrink-0 text-primary" />
              ) : (
                <Circle aria-hidden className="size-5 shrink-0 text-input" />
              )}
              <span className={cn("min-w-0 flex-1 text-sm", completed && "text-muted-foreground line-through decoration-1")}>
                <span className="sr-only">{completed ? "Đã xong: " : "Chưa xong: "}</span>
                {mission.title}
              </span>
              <span className="num shrink-0 text-xs text-muted-foreground">
                {Math.min(progress, mission.target)}/{mission.target}
              </span>
              <span className="num shrink-0 rounded-md bg-xp-soft px-1.5 py-0.5 text-xs font-semibold text-xp-text">
                +{mission.xp} XP
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function BudgetRow({ item }: { item: BudgetProgress }) {
  const pct = item.ratio * 100;
  const over = item.ratio > 1;
  const warn = !over && item.ratio >= 0.8;
  const bar = over ? "bg-danger" : warn ? "bg-warning" : "bg-primary";
  return (
    <li className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          {over && <CircleAlert aria-hidden className="size-4 shrink-0 text-danger" />}
          {warn && <AlertTriangle aria-hidden className="size-4 shrink-0 text-warning" />}
          <span className="truncate">{item.category.name}</span>
        </span>
        <span className={cn("num shrink-0 text-[13px] font-medium", over ? "text-danger" : warn ? "text-warning" : "text-muted-foreground")}>
          {over ? "Vượt " : "Đã dùng "}
          {formatPercent(pct)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Ngân sách ${item.category.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`Đã dùng ${formatMoney(item.spent)} trên ${formatMoney(item.budget.limitAmount)}, ${formatPercent(pct)}`}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="num text-xs text-muted-foreground">
        {formatMoney(item.spent)} / {formatMoney(item.budget.limitAmount)}
      </p>
    </li>
  );
}

export function BudgetWatchPanel({ data, loading }: { data?: BudgetProgress[]; loading: boolean }) {
  return (
    <Panel
      title="Ngân sách tháng này"
      icon={<PiggyBank aria-hidden className="size-5 text-muted-foreground" />}
      action={
        data && data.length > 0 && (
          <Button variant="ghost" size="sm" asChild className="text-primary">
            <Link href="/ngan-sach">Chi tiết</Link>
          </Button>
        )
      }
    >
      {loading || !data ? (
        <div aria-hidden className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          className="py-6"
          title="Chưa đặt ngân sách"
          description="Đặt hạn mức cho vài danh mục để biết khi nào cần chậm lại."
          action={
            <Button variant="secondary" asChild>
              <Link href="/ngan-sach">Đặt ngân sách</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y">
          {data.map((b) => (
            <BudgetRow key={b.budget.id} item={b} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
