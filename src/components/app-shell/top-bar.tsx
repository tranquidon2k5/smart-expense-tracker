"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { QuickAddBar } from "@/components/quick-add/quick-add";
import { useSession } from "@/hooks/use-session";
import { useServiceQuery } from "@/hooks/use-service-query";
import { gamificationService } from "@/services";
import { NAV_MAIN, NAV_SECONDARY } from "@/lib/nav";
import { getMessages } from "@/i18n/core";
import { shellMessages } from "@/i18n/messages/shell";
import { AccountMenu } from "./account-menu";
import { StreakPill, XpMeter } from "./gamification-status";
import { SearchButton } from "./search-command";

function pageTitle(pathname: string) {
  const item = [...NAV_MAIN, ...NAV_SECONDARY].find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
  );
  if (item) return item.label;
  const t = getMessages(shellMessages);
  return pathname.startsWith("/thong-bao") ? t.nav["/thong-bao"] : t.brand;
}

function PageTitle() {
  return <>{pageTitle(usePathname())}</>;
}

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { data: status } = useServiceQuery(() => gamificationService.getGamificationStatus());
  const session = useSession();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/85 md:gap-3 md:px-6 xl:px-8">
      <SidebarTrigger className="-ml-1 size-10 max-md:size-11 [&_svg]:size-5" />
      <Separator orientation="vertical" className="h-6! max-md:hidden" />
      <p className="truncate text-base font-semibold md:min-w-28 lg:text-lg" aria-hidden>
        {/* usePathname cần Suspense khi có Cache Components */}
        <React.Suspense fallback="Sổ Tiền">
          <PageTitle />
        </React.Suspense>
      </p>

      <div className="flex min-w-0 flex-1 justify-center px-2 max-md:hidden">
        <QuickAddBar />
      </div>
      <div className="flex-1 md:hidden" />

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <SearchButton onClick={onOpenSearch} />
        <StreakPill status={status} />
        <XpMeter status={status} className="max-md:hidden" />
        <NotificationBell />
        {session && <AccountMenu session={session} className="max-sm:hidden" />}
      </div>
    </header>
  );
}
