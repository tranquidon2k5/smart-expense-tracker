"use client";

import * as React from "react";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { QuickAddProvider, useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { QuickAddDialog } from "@/components/quick-add/quick-add";
import { AuthGate } from "@/components/auth/auth-gate";
import { CelebrationHost } from "@/components/celebration";
import { AppSidebar } from "./app-sidebar";
import { BottomNav } from "./bottom-nav";
import { SearchCommand } from "./search-command";
import { TopBar } from "./top-bar";

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * Khôi phục trạng thái thu gọn đã lưu (cookie do shadcn Sidebar ghi).
 * Chưa từng chọn + màn 1024–1279px → mặc định thu gọn (MASTER.md › Responsive).
 * Đọc ở client để layout vẫn prerender tĩnh được (Cache Components).
 */
function RestoreSidebarState() {
  const { setOpen } = useSidebar();
  React.useEffect(() => {
    const saved = document.cookie.match(/(?:^|; )sidebar_state=(true|false)/)?.[1];
    if (saved === "false") setOpen(false);
    else if (!saved && window.matchMedia("(min-width: 1024px) and (max-width: 1279px)").matches) {
      setOpen(false);
      // setOpen ghi cookie; xoá đi vì đây là mặc định theo màn hình, không phải lựa chọn của người dùng
      document.cookie = "sidebar_state=; path=/; max-age=0";
    }
    // chỉ chạy một lần khi vào trang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function ShellBody({ children }: { children: React.ReactNode }) {
  const { openQuickAdd } = useQuickAdd();
  const [searchOpen, setSearchOpen] = React.useState(false);

  // Phím tắt: N ghi nhanh · Ctrl K hoặc / tìm kiếm (không kích hoạt khi đang gõ)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openQuickAdd();
      } else if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openQuickAdd]);

  return (
    <>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <TopBar onOpenSearch={() => setSearchOpen(true)} />
        <main id="main" tabIndex={-1} className="flex-1 outline-none max-md:pb-24">
          {children}
        </main>
      </SidebarInset>
      <BottomNav />
      <QuickAddDialog />
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <CelebrationHost />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AuthGate>{() => <AppShellInner>{children}</AppShellInner>}</AuthGate>;
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <a
        href="#main"
        className="fixed top-2 left-2 z-50 -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:translate-y-0"
      >
        Bỏ qua đến nội dung chính
      </a>
      <RestoreSidebarState />
      <QuickAddProvider>
        <ShellBody>{children}</ShellBody>
      </QuickAddProvider>
    </SidebarProvider>
  );
}
