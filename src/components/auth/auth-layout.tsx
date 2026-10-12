import { Flame, NotebookPen, PiggyBank, Sparkles } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const POINTS = [
  { icon: Sparkles, title: "Ghi một câu là xong", text: "Gõ “ăn phở 45k” — AI tách số tiền, ngày và danh mục giúp bạn." },
  { icon: PiggyBank, title: "Biết tiền đi đâu", text: "Ngân sách theo danh mục, biểu đồ thu chi và trợ lý trả lời bằng số liệu thật." },
  { icon: Flame, title: "Thói quen nhẹ nhàng", text: "Chuỗi ngày, nhiệm vụ và huy hiệu thưởng cho việc ghi đều — không phải tiêu ít hay nhiều." },
] as const;

/**
 * Khung trang Đăng nhập / Đăng ký / Quên mật khẩu (khách, không có app shell).
 * ≥ 1024px: cột giới thiệu bên trái + form bên phải; nhỏ hơn: chỉ form.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
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
          <h2 className="text-[28px] leading-9 font-bold text-foreground">Hiểu chi tiêu của mình với ít thao tác nhất</h2>
          <ul className="mt-8 flex flex-col gap-6">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">Bản demo đồ án · dữ liệu giả lập, không dùng dữ liệu tài chính thật.</p>
      </aside>

      <main id="main" className="flex flex-col items-center justify-center px-4 py-10 sm:px-6">
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
