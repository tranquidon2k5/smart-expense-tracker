"use client";

import { Flame, NotebookPen, PiggyBank, Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useT } from "@/i18n/provider";
import { authMessages } from "@/i18n/messages/auth";

const POINT_ICONS = [Sparkles, PiggyBank, Flame] as const;

/**
 * Khung trang Đăng nhập / Đăng ký / Quên mật khẩu (khách, không có app shell).
 * ≥ 1024px: cột giới thiệu bên trái + form bên phải; nhỏ hơn: chỉ form.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT(authMessages).layout;
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between border-r bg-accent px-12 py-10 lg:flex xl:px-16">
        <Link href="/dang-nhap" className="flex w-fit items-center gap-2.5 rounded-lg" aria-label="Sổ Tiền">
          <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Sổ Tiền</span>
        </Link>
        <div className="max-w-md">
          <h2 className="text-[28px] leading-9 font-bold text-foreground">{t.headline}</h2>
          <ul className="mt-8 flex flex-col gap-6">
            {t.points.map((p, i) => {
              const Icon = POINT_ICONS[i];
              return (
              <li key={p.title} className="flex gap-3.5">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.text}</p>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">{t.footnote}</p>
      </aside>

      <main id="main" className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <LanguageSwitcher className="absolute top-4 right-4 sm:top-6 sm:right-6" />
        <Link href="/dang-nhap" className="mb-8 flex items-center gap-2.5 rounded-lg lg:hidden" aria-label="Sổ Tiền">
          <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPen className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Sổ Tiền</span>
        </Link>
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
