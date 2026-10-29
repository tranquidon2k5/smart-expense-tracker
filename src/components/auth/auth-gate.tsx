"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { AuthSession } from "@/types";
import { useSession } from "@/hooks/use-session";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";

/** Màn chờ khi chưa biết phiên (trước hydrate) hoặc đang chuyển sang trang Đăng nhập */
export function SessionPending({ label }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-svh items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
      <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
      {label ?? getMessages(commonMessages).sessionPending}
    </div>
  );
}

/**
 * Chỉ hiện nội dung khi đã đăng nhập; chưa đăng nhập → sang /dang-nhap kèm ?tiep= để quay lại đúng trang.
 *
 * Trong lúc chưa biết phiên (server render, hydrate), trang vẫn được render nhưng ẩn (`hidden`) — lúc này
 * nó chỉ có skeleton, chưa có dữ liệu. Nhờ vậy Next prerender được trang (instant navigation) và cây
 * component không phải mount lại khi phiên được xác định.
 * Bản thật kiểm tra JWT ở backend; chặn ở giao diện chỉ để trải nghiệm mượt.
 */
export function AuthGate({ children }: { children: (session: AuthSession | null) => React.ReactNode }) {
  const session = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (session !== null) return;
    const here = window.location.pathname + window.location.search;
    router.replace(here === "/" ? "/dang-nhap" : `/dang-nhap?tiep=${encodeURIComponent(here)}&ly-do=het-phien`);
  }, [session, router]);

  const ready = !!session;
  return (
    <>
      {!ready && <SessionPending />}
      {/* Đã biết là chưa đăng nhập (null) → bỏ hẳn nội dung, không gọi dữ liệu */}
      {session !== null && <div hidden={!ready}>{children(session ?? null)}</div>}
    </>
  );
}
