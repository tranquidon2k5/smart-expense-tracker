"use client";

import { Activity, Award, ExternalLink, ListChecks, MessageSquareQuote, NotebookPen, Shapes, ShieldX, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import type { AuthSession } from "@/types";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/app-shell/account-menu";
import { AuthGate } from "@/components/auth/auth-gate";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export const ADMIN_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/quan-tri", label: "Thống kê hệ thống", icon: Activity },
  { href: "/quan-tri/nguoi-dung", label: "Người dùng", icon: Users },
  { href: "/quan-tri/danh-muc", label: "Danh mục mặc định", icon: Shapes },
  { href: "/quan-tri/cau-khich-le", label: "Câu khích lệ", icon: MessageSquareQuote },
  { href: "/quan-tri/nhiem-vu", label: "Nhiệm vụ", icon: ListChecks },
  { href: "/quan-tri/huy-hieu", label: "Huy hiệu", icon: Award },
];

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex gap-0.5 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ADMIN_NAV.map((n) => {
        const active = pathname !== null && (n.href === "/quan-tri" ? pathname === n.href : pathname.startsWith(n.href));
        return (
          <li key={n.href} className="shrink-0">
            <Link
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 max-lg:h-10",
                active ? "bg-accent text-primary" : "text-foreground hover:bg-row-hover",
                "before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 lg:aria-[current=page]:before:opacity-100",
              )}
            >
              <n.icon aria-hidden className="size-4 shrink-0" />
              {n.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

function Forbidden({ session }: { session: AuthSession }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <EmptyState
        icon={ShieldX}
        title="Trang này chỉ dành cho quản trị viên"
        description={`Tài khoản ${session.email} không có quyền quản trị. Nếu bạn cần quyền này, liên hệ quản trị viên hệ thống.`}
        action={
          <Button asChild>
            <Link href="/">Về trang Tổng quan</Link>
          </Button>
        }
      />
    </div>
  );
}

/**
 * Khung trang quản trị (F15): mật độ "Gọn" (dòng bảng 36px, chữ 13px), nav trái 216px trên desktop,
 * thanh nav cuộn ngang trên màn nhỏ. Chỉ vai trò admin; người dùng thường thấy trang 403 rõ ràng.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      {(session) =>
        session && session.role !== "admin" ? (
          <Forbidden session={session} />
        ) : (
          <div className="admin-dense flex min-h-svh flex-col bg-background">
            <a
              href="#admin-main"
              className="fixed top-2 left-2 z-50 -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:translate-y-0"
            >
              Bỏ qua đến nội dung chính
            </a>
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-5">
              <Link href="/quan-tri" className="flex items-center gap-2 rounded-lg" aria-label="Sổ Tiền — Quản trị">
                <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <NotebookPen className="size-[18px]" />
                </span>
                <span className="font-bold tracking-tight">Sổ Tiền</span>
                <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-primary">Quản trị</span>
              </Link>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground max-sm:hidden">
                <Link href="/">
                  <ExternalLink aria-hidden /> Mở ứng dụng
                </Link>
              </Button>
              {session && <AccountMenu session={session} />}
            </header>
            <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col lg:flex-row">
              <nav aria-label="Điều hướng quản trị" className="border-b bg-card px-3 py-2 lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:w-[216px] lg:shrink-0 lg:border-r lg:border-b-0 lg:py-4">
                <React.Suspense fallback={<NavLinks pathname={null} />}>
                  <ActiveNav />
                </React.Suspense>
              </nav>
              <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-5 outline-none lg:px-6 lg:py-6">
                {children}
              </main>
            </div>
          </div>
        )
      }
    </AuthGate>
  );
}

/** Tiêu đề trang quản trị: gọn hơn PageHeader của app (20px) */
export function AdminHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl leading-7 font-bold">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
