"use client";

import { NotebookPen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_MAIN, NAV_SECONDARY, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { shellMessages } from "@/i18n/messages/shell";

function isActive(pathname: string | null, href: string) {
  if (pathname === null) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavList({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <SidebarMenuItem key={item.href} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              asChild
              isActive={active}
              tooltip={item.label}
              className={cn(
                "relative h-9 gap-3 px-3 text-sm font-medium text-foreground [&_svg]:size-[18px]",
                "group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:sr-only",
                "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
                // Thanh 3px bên trái cho mục đang mở
                "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 data-[active=true]:before:opacity-100 group-data-[collapsible=icon]:before:hidden",
              )}
            >
              <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => isMobile && setOpenMobile(false)}>
                <item.icon aria-hidden />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function ActiveNavList({ items }: { items: NavItem[] }) {
  return <NavList items={items} pathname={usePathname()} />;
}

/**
 * usePathname cần Suspense khi có Cache Components (route có tham số động như /[...slug]);
 * fallback vẽ cùng danh sách nhưng chưa đánh dấu mục đang mở.
 */
function Nav({ items }: { items: NavItem[] }) {
  return (
    <React.Suspense fallback={<NavList items={items} pathname={null} />}>
      <ActiveNavList items={items} />
    </React.Suspense>
  );
}

export function AppSidebar() {
  const t = useT(shellMessages);
  return (
    <Sidebar collapsible="icon" aria-label={t.mainNav}>
      <SidebarHeader className="h-16 justify-center border-b px-4 group-data-[collapsible=icon]:px-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg group-data-[collapsible=icon]:justify-center"
          aria-label={t.homeLink}
        >
          <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">Sổ Tiền</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="py-3">
        <SidebarGroup className="px-3 group-data-[collapsible=icon]:px-0">
          <SidebarGroupContent>
            <Nav items={NAV_MAIN} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t px-3 py-3 group-data-[collapsible=icon]:px-0">
        <Nav items={NAV_SECONDARY} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
