"use client";

import { Bell, CheckCheck, Settings } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { AppNotification, NotificationType } from "@/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useServiceQuery } from "@/hooks/use-service-query";
import { notificationService, transactionService } from "@/services";
import { cn } from "@/lib/utils";
import { NotificationList, notificationFilters } from "./notification-list";
import { getMessages } from "@/i18n/core";
import { notificationsMessages } from "@/i18n/messages/notifications";

const msg = () => getMessages(notificationsMessages);

/** Kiểm tra giờ nhắc mỗi phút khi app đang mở (bản thật: job ở backend lúc 20:00) */
function useReminderSchedule() {
  React.useEffect(() => {
    notificationService.runReminderSchedule();
    const t = setInterval(() => notificationService.runReminderSchedule(), 60_000);
    return () => clearInterval(t);
  }, []);
}

export function FilterTabs({
  value,
  onChange,
  className,
}: {
  value: NotificationType | "all";
  onChange: (v: NotificationType | "all") => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={msg().filterLabel} className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}>
      {notificationFilters().map((f) => (
        <button
          key={f.value}
          type="button"
          aria-pressed={value === f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            "h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:h-9",
            value === f.value ? "bg-card text-foreground shadow-[0_1px_2px_rgb(19_42_38/0.08)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

/** Chuông thông báo trên top bar: số chưa đọc + popover danh sách (nhắc nhở, chúc mừng, ngân sách) */
export function NotificationBell() {
  useReminderSchedule();
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<NotificationType | "all">("all");
  const unread = useServiceQuery(() => notificationService.getUnreadCount());
  const list = useServiceQuery(() => notificationService.listNotifications(filter === "all" ? undefined : filter), filter);
  const count = unread.data ?? 0;
  const today = transactionService.getToday();

  const onOpenItem = (n: AppNotification) => {
    void notificationService.markRead(n.id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={msg().bellLabel(count)}
          className="relative inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:size-11"
        >
          <Bell aria-hidden className="size-5" />
          {count > 0 && (
            <span
              aria-hidden
              className="num absolute top-1 right-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground ring-2 ring-background"
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(400px,calc(100vw-24px))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-[15px] font-semibold">{msg().title}</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={!count}
            onClick={() => void notificationService.markAllRead()}
            className="text-muted-foreground"
          >
            <CheckCheck aria-hidden /> {msg().markRead}
          </Button>
        </div>
        <div className="border-b px-3 py-2">
          <FilterTabs value={filter} onChange={setFilter} className="w-full [&>button]:flex-1" />
        </div>
        <div className="max-h-[min(420px,60svh)] overflow-y-auto">
          <NotificationList
            dense
            items={list.data}
            loading={list.loading}
            error={list.error}
            onRetry={list.refetch}
            today={today}
            onOpen={onOpenItem}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <Button variant="ghost" size="sm" asChild onClick={() => setOpen(false)}>
            <Link href="/thong-bao">{msg().viewAll}</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground" onClick={() => setOpen(false)}>
            <Link href="/cai-dat#nhac-nho">
              <Settings aria-hidden /> {msg().reminderSettings}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
