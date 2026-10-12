"use client";

import { Check, CircleAlert, Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Ô nhập chuẩn của MASTER.md › Inputs & Form: nhãn luôn hiện phía trên, lỗi ngay dưới ô
 * kèm icon CircleAlert, helper text khi cần; aria-invalid + aria-describedby đầy đủ.
 */
export function FormField({
  label,
  error,
  hint,
  action,
  className,
  children,
  id: idProp,
}: {
  label: React.ReactNode;
  error?: string | null;
  hint?: React.ReactNode;
  /** Liên kết nhỏ bên phải nhãn (vd. "Quên mật khẩu?") */
  action?: React.ReactNode;
  className?: string;
  id?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const autoId = React.useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </Label>
        {action}
      </div>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs text-danger">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** Ô mật khẩu có nút hiện/ẩn (aria-pressed + nhãn tiếng Việt) */
export function PasswordInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-11", props.className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        title={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {visible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
      </button>
    </div>
  );
}

/** Danh sách điều kiện mật khẩu, cập nhật khi gõ (không chỉ dựa vào màu: có dấu tích / chấm) */
export function PasswordChecklist({ checks }: { checks: { label: string; ok: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Yêu cầu mật khẩu">
      {checks.map((c) => (
        <li key={c.label} className={cn("flex items-center gap-1", c.ok ? "text-success" : "text-muted-foreground")}>
          {c.ok ? <Check aria-hidden className="size-3.5" /> : <span aria-hidden className="mx-1 size-1.5 rounded-full bg-current" />}
          <span>
            {c.label}
            <span className="sr-only">{c.ok ? ": đạt" : ": chưa đạt"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Thông báo lỗi chung của form (vd. sai mật khẩu) — đặt ngay trên nút gửi */
export function FormAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm",
        tone === "error" ? "bg-expense-soft" : "bg-info-soft",
      )}
    >
      <CircleAlert aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-danger" : "text-info")} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
