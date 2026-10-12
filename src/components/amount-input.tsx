"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const vnd = new Intl.NumberFormat("vi-VN");

/** Ô nhập số tiền: tự chèn dấu chấm nghìn, hậu tố "đ", font số Inter tabular */
export function AmountInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type" | "inputMode"> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="relative">
      <Input
        inputMode="numeric"
        autoComplete="off"
        value={value != null && value > 0 ? vnd.format(value) : ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
          onChange(digits ? Number(digits) : undefined);
        }}
        className={cn("num pr-7 text-right", className)}
        {...props}
      />
      <span aria-hidden className="num pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground">
        đ
      </span>
    </div>
  );
}
