"use client";

import { BellRing, BellOff, CheckCheck, Settings } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import type { NotificationType } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { notificationService, settingsService, transactionService } from "@/services";
import { FilterTabs } from "./notification-bell";
import { NotificationList } from "./notification-list";

/** Trung tâm thông báo (PRD §6.3): danh sách đầy đủ + tình trạng nhắc nhở */
export function NotificationsPage() {
  const [filter, setFilter] = React.useState<NotificationType | "all">("all");
  const list = useServiceQuery(() => notificationService.listNotifications(filter === "all" ? undefined : filter), filter);
  const unread = useServiceQuery(() => notificationService.getUnreadCount());
  const settings = useServiceQuery(() => settingsService.getSettings());
  const today = transactionService.getToday();
  const reminder = settings.data?.reminder;

  const sendTest = async () => {
    try {
      await notificationService.sendTestReminder();
      toast.success("Đã gửi một nhắc nhở thử");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không gửi được nhắc nhở thử");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Thông báo"
        description={
          unread.data ? (
            <>
              Bạn có <span className="num">{unread.data}</span> thông báo chưa đọc
            </>
          ) : (
            "Nhắc nhở giữ chuỗi, chúc mừng thành tích và cảnh báo ngân sách"
          )
        }
        actions={
          <Button variant="outline" disabled={!unread.data} onClick={() => void notificationService.markAllRead()}>
            <CheckCheck aria-hidden /> Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 md:gap-5 xl:grid-cols-12 xl:gap-6">
        <Panel className="p-0 md:p-0 xl:col-span-8">
          <div className="border-b px-4 py-3 md:px-5">
            <FilterTabs value={filter} onChange={setFilter} />
          </div>
          <NotificationList
            items={list.data}
            loading={list.loading}
            error={list.error}
            onRetry={list.refetch}
            today={today}
            onOpen={(n) => void notificationService.markRead(n.id)}
          />
        </Panel>

        <Panel
          title="Nhắc nhở ghi chép"
          icon={reminder?.enabled === false ? <BellOff aria-hidden className="size-5 text-muted-foreground" /> : <BellRing aria-hidden className="size-5 text-primary" />}
          className="xl:col-span-4"
        >
          {!reminder ? (
            <Skeleton className="h-16 w-full" />
          ) : reminder.enabled ? (
            <p className="text-sm">
              Nếu tới <span className="num font-semibold">{reminder.time}</span> mà hôm nay bạn chưa ghi khoản nào, Sổ Tiền sẽ nhắc một lần trong
              app{reminder.email ? " và qua email" : ""}.
            </p>
          ) : (
            <p className="text-sm">Nhắc nhở đang tắt. Bạn sẽ không nhận lời nhắc nào, chuỗi ngày vẫn được tính như bình thường.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/cai-dat#nhac-nho">
                <Settings aria-hidden /> Đổi giờ hoặc tắt
              </Link>
            </Button>
            {reminder?.enabled && (
              <Button variant="ghost" size="sm" onClick={() => void sendTest()}>
                Gửi thử một nhắc nhở
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}
