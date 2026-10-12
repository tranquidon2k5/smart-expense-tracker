"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickAddBar } from "@/components/quick-add/quick-add";
import { useServiceQuery } from "@/hooks/use-service-query";
import { gamificationService } from "@/services";
import { NAV_MAIN, NAV_SECONDARY } from "@/lib/nav";
import { StreakPill, XpMeter } from "./gamification-status";
import { SearchButton } from "./search-command";

function pageTitle(pathname: string) {
  const item = [...NAV_MAIN, ...NAV_SECONDARY].find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href),
  );
  return item?.label ?? "Sổ Tiền";
}

function PageTitle() {
  return <>{pageTitle(usePathname())}</>;
}

export function TopBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { data: status } = useServiceQuery(() => gamificationService.getGamificationStatus());
  const { data: user } = useServiceQuery(() => gamificationService.getCurrentUser());
  const initials = user?.fullName.split(" ").at(-1)?.charAt(0) ?? "";

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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded-full max-sm:hidden"
              aria-label={user ? `Tài khoản: ${user.fullName}` : "Tài khoản"}
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{user?.fullName}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
