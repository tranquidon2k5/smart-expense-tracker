"use client";

import { Bell, LogOut, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AuthSession } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authService } from "@/services";
import { useT } from "@/i18n/provider";
import { shellMessages } from "@/i18n/messages/shell";

export function initialsOf(name: string) {
  return name.split(" ").at(-1)?.charAt(0).toUpperCase() ?? "";
}

/** Menu tài khoản ở góc phải top bar: Cài đặt, Thông báo, Quản trị (admin), Đăng xuất */
export function AccountMenu({ session, className }: { session: AuthSession; className?: string }) {
  const router = useRouter();
  const t = useT(shellMessages).account;
  const logout = async () => {
    await authService.logout();
    router.replace("/dang-nhap");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={`rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none ${className ?? ""}`} aria-label={t.aria(session.fullName)}>
          <Avatar className="size-9">
            <AvatarFallback className="bg-accent font-semibold text-accent-foreground">{initialsOf(session.fullName)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-semibold text-foreground">{session.fullName}</span>
          <span className="truncate text-xs text-muted-foreground">{session.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/cai-dat">
            <Settings aria-hidden /> {t.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/thong-bao">
            <Bell aria-hidden /> {t.notifications}
          </Link>
        </DropdownMenuItem>
        {session.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/quan-tri">
              <ShieldCheck aria-hidden /> {t.admin}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden /> {t.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
