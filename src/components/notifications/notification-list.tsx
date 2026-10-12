"use client";

import { Bell, BellOff, TriangleAlert, Trophy } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import type { AppNotification, NotificationType } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const NOTIFICATION_FILTERS: { value: NotificationType | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "reminder", label: "Nhắc nhở" },
  { value: "celebration", label: "Chúc mừng" },
  { value: "budget_alert", label: "Ngân sách" },
];

const TYPE_STYLE: Record<NotificationType, { icon: typeof Bell; label: string; className: string }> = {
  reminder: { icon: Bell, label: "Nhắc nhở", className: "bg-accent text-primary" },
  // Màu ấm chỉ dùng cho gamification (MASTER.md)
  celebration: { icon: Trophy, label: "Chúc mừng", className: "bg-xp-soft text-xp-text" },
  budget_alert: { icon: TriangleAlert, label: "Ngân sách", className: "bg-warning-soft text-warning" },
};

/** "20:00" hôm nay · "Hôm qua, 20:00" · "05/10/2026, 21:10" */
export function formatWhen(iso: string, today: string): string {
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  if (date === today) return `Hôm nay, ${time}`;
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (date === y.toISOString().slice(0, 10)) return `Hôm qua, ${time}`;
  return `${formatDate(date)}, ${time}`;
}

export function NotificationList({
  items,
  loading,
  error,
  onRetry,
  today,
  onOpen,
  dense,
  emptyHint,
}: {
  items?: AppNotification[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  today: string;
  onOpen: (n: AppNotification) => void;
  /** Bản trong popover: gọn hơn, nội dung tối đa 2 dòng */
  dense?: boolean;
  emptyHint?: React.ReactNode;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} className="py-8" />;
  if (loading || !items) {
    return (
      <div aria-hidden className="flex flex-col gap-1 p-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-3 p-2">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        className="py-10"
        title="Chưa có thông báo nào"
        description="Nhắc nhở giữ chuỗi và lời chúc mừng thành tích sẽ xuất hiện ở đây."
        action={emptyHint}
      />
    );
  }
  return (
    <ul className={cn("flex flex-col", dense ? "p-1.5" : "divide-y")}>
      {items.map((n) => {
        const t = TYPE_STYLE[n.type];
        const body = (
          <>
            <span aria-hidden className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg", t.className)}>
              <t.icon className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-start justify-between gap-2">
                <span className={cn("text-sm", n.isRead ? "font-medium" : "font-semibold")}>{n.title ?? t.label}</span>
                {!n.isRead && (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                    <span className="sr-only">Chưa đọc</span>
                  </span>
                )}
              </span>
              <span className={cn("text-[13px] text-muted-foreground", dense && "line-clamp-2")}>{n.content}</span>
              <span className="num text-xs text-muted-foreground">
                <span className="sr-only">{t.label} · </span>
                {formatWhen(n.createdAt, today)}
              </span>
            </span>
          </>
        );
        const cls = cn(
          "flex w-full gap-3 rounded-lg p-2.5 text-left transition-colors duration-150 hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          !n.isRead && "bg-accent/50",
          !dense && "rounded-none px-4 py-3.5",
        );
        return (
          <li key={n.id}>
            {n.link ? (
              <Link href={n.link} onClick={() => onOpen(n)} className={cls}>
                {body}
              </Link>
            ) : (
              <button type="button" onClick={() => onOpen(n)} className={cls}>
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
