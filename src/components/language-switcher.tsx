"use client";

import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCALE_NAMES, LOCALES, isLocale } from "@/i18n/core";
import { useLocale, useSetLocale } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Chọn ngôn ngữ giao diện. Nhãn ghi "Language / Ngôn ngữ" để ai cũng tìm thấy dù đang ở ngôn ngữ nào. */
export function LanguageSwitcher({ id, className }: { id?: string; className?: string }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  return (
    <Select value={locale} onValueChange={(v) => isLocale(v) && setLocale(v)}>
      <SelectTrigger id={id} aria-label="Language / Ngôn ngữ" className={cn("w-auto gap-2", className)}>
        <Languages aria-hidden className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {LOCALES.map((l) => (
          <SelectItem key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
